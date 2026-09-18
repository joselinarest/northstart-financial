import { workspace } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { db, householdId } = await workspace(request);
    const connections = await db
      .prepare(
        "SELECT c.id,c.institution_name || ' · ' || COALESCE(u.display_name,'Household member') institution_name,c.status,c.last_synced_at,c.error_code,c.created_at,c.connected_by_user_id,COALESCE(u.display_name,'Household member') owner_name,c.plaid_products_json,c.plaid_consented_products_json,c.plaid_billed_products_json,c.plaid_consent_expiration_at,c.investment_access_status,c.last_holdings_sync_at,c.last_investment_transactions_sync_at,c.latest_plaid_error_message FROM connections c LEFT JOIN users u ON u.id=c.connected_by_user_id WHERE c.household_id=? AND c.provider='plaid' ORDER BY c.created_at DESC",
      )
      .bind(householdId)
      .all();
    const accounts = await db
      .prepare(
        `SELECT a.id,a.connection_id,a.name,a.official_name,a.nickname,a.investment_purpose,a.type,a.subtype,a.currency,a.mask,a.current_balance_cents,a.available_balance_cents,a.credit_limit_cents,a.updated_at,a.last_investment_sync_at,a.last_provider_update_at,a.investment_sync_status,a.investment_sync_error,c.institution_name,COALESCE(a.manual_owner_name,u.display_name,'Household member') owner_name,a.manual_owner_name,
      s.strategy_type,s.share_mode,s.benchmark_symbol,s.goal_name,s.horizon_months,s.risk_profile,s.maximum_position_bps,s.maximum_risk_bps,s.available_cash_cents,s.policy_json,
      (a.type='investment' OR a.subtype ~* '(brokerage|401|403|457|ira|roth|sep|retirement|pension|custodial|stock)' OR s.account_id IS NOT NULL OR EXISTS(SELECT 1 FROM holdings ih WHERE ih.account_id=a.id)) is_investment_account
      FROM accounts a JOIN entities e ON e.id=a.entity_id
      LEFT JOIN connections c ON c.id=a.connection_id LEFT JOIN users u ON u.id=c.connected_by_user_id
      LEFT JOIN investment_account_settings s ON s.account_id=a.id
      WHERE e.household_id=? AND a.hidden=0 ORDER BY a.updated_at DESC`,
      )
      .bind(householdId)
      .all();
    const holdings = await db
      .prepare(
        "SELECT h.id holding_id,h.account_id,a.nickname,a.investment_purpose,a.subtype account_subtype,s.ticker,s.name,s.type,h.quantity,h.cost_basis_cents,h.price_cents,h.price_at,(h.quantity*h.price_cents) market_value_cents,COALESCE(a.manual_owner_name,u.display_name,'Household member') owner_name,h.acquisition_date,CASE WHEN a.connection_id IS NULL THEN 'manual' ELSE 'plaid' END source FROM holdings h JOIN securities s ON s.id=h.security_id JOIN accounts a ON a.id=h.account_id JOIN entities e ON e.id=a.entity_id LEFT JOIN connections c ON c.id=a.connection_id LEFT JOIN users u ON u.id=c.connected_by_user_id WHERE e.household_id=? ORDER BY market_value_cents DESC",
      )
      .bind(householdId)
      .all();
    const canonical = new Map<string, Record<string, any>>(),
      accountMap = new Map<string, string>();
    for (const raw of accounts.results as Array<Record<string, any>>) {
      const key = raw.connection_id
        ? [
            raw.institution_name || "",
            raw.official_name || raw.name || "",
            raw.type || "",
            raw.subtype || "",
            raw.mask || "",
          ]
            .map((value) => String(value).trim().toLowerCase())
            .join("|")
        : `manual|${raw.id}`;
      const existing = canonical.get(key);
      if (existing) {
        accountMap.set(String(raw.id), String(existing.id));
        const owners = new Set([
          ...(existing.owner_names || [existing.owner_name]),
          raw.owner_name,
        ]);
        existing.owner_names = [...owners];
        existing.owner_name = [...owners].join(", ");
        if (!existing.nickname && raw.nickname)
          existing.nickname = raw.nickname;
        if (!existing.investment_purpose && raw.investment_purpose)
          existing.investment_purpose = raw.investment_purpose;
        continue;
      }
      const account = { ...raw, owner_names: [raw.owner_name] };
      canonical.set(key, account);
      accountMap.set(String(raw.id), String(raw.id));
    }
    const dedupedHoldings = new Map<string, Record<string, any>>();
    for (const raw of holdings.results as Array<Record<string, any>>) {
      const accountId =
          accountMap.get(String(raw.account_id)) || String(raw.account_id),
        key = `${accountId}|${String(raw.ticker || raw.name || "").toUpperCase()}`,
        existing = dedupedHoldings.get(key),
        candidate: Record<string, any> = { ...raw, account_id: accountId };
      if (
        !existing ||
        Date.parse(String(candidate.price_at || "")) >
          Date.parse(String(existing.price_at || ""))
      )
        dedupedHoldings.set(key, candidate);
    }
    const syncHistory = await db
      .prepare(
        "SELECT id,connection_id,account_id,trigger,status,holdings_added,holdings_changed,holdings_closed,transactions_added,result_json,error_code,error_message,started_at,completed_at FROM investment_sync_history WHERE household_id=? ORDER BY started_at DESC LIMIT 50",
      )
      .bind(householdId)
      .all();
    return Response.json({
      connections: connections.results,
      accounts: [...canonical.values()],
      holdings: [...dedupedHoldings.values()],
      investmentSyncHistory: syncHistory.results,
      duplicateAccountsCollapsed: accounts.results.length - canonical.size,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load connections",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { db, householdId } = await workspace(request),
      body = (await request.json()) as {
        accountId?: string;
        nickname?: string;
        investmentPurpose?: string;
      };
    const purposes = [
      "Swing",
      "Options",
      "Long-term",
      "Retirement",
      "Dividend income",
      "Mixed",
    ];
    if (!body.accountId)
      return Response.json({ error: "accountId required" }, { status: 400 });
    if (body.investmentPurpose && !purposes.includes(body.investmentPurpose))
      return Response.json(
        { error: "Invalid investment purpose" },
        { status: 400 },
      );
    const account = await db
      .prepare(
        "SELECT a.id FROM accounts a JOIN entities e ON e.id=a.entity_id WHERE a.id=? AND e.household_id=?",
      )
      .bind(body.accountId, householdId)
      .first();
    if (!account)
      return Response.json({ error: "Account not found" }, { status: 404 });
    await db
      .prepare(
        "UPDATE accounts SET nickname=?,investment_purpose=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .bind(
        String(body.nickname || "")
          .trim()
          .slice(0, 80) || null,
        body.investmentPurpose || null,
        body.accountId,
      )
      .run();
    const saved = await db
      .prepare(
        "SELECT id,nickname,investment_purpose,updated_at FROM accounts WHERE id=?",
      )
      .bind(body.accountId)
      .first();
    return Response.json({ ok: true, account: saved });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update account",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { db, householdId, entityId, userId } = await workspace(request),
      body = (await request.json()) as {
        action?: string;
        alias?: string;
        accountType?: string;
        purpose?: string;
        source?: string;
        institutionName?: string;
        accountId?: string;
        ticker?: string;
        name?: string;
        quantity?: number;
        averageCost?: number | string;
        currentPrice?: number;
        currentValue?: number;
        acquisitionDate?: string;
        owner?: string;
        cashBalance?: number;
      },
      accountTypes = [
        "Taxable brokerage",
        "401(k)",
        "Traditional IRA",
        "Roth IRA",
        "SEP IRA",
        "Custodial investment",
        "Other investment",
      ],
      purposes = [
        "Swing",
        "Options",
        "Long-term",
        "Retirement",
        "Dividend income",
        "Mixed",
      ];
    if (body.action === "add_manual_holding") {
      const ticker = String(body.ticker || "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9.-]/g, "")
          .slice(0, 12),
        name = String(body.name || ticker)
          .trim()
          .slice(0, 120),
        quantity = Number(body.quantity),
        averageCost =
          body.averageCost === undefined ||
          body.averageCost === null ||
          body.averageCost === ""
            ? null
            : Number(body.averageCost),
        currentValue = Number(body.currentValue),
        currentPrice = Number.isFinite(Number(body.currentPrice))
          ? Number(body.currentPrice)
          : Number.isFinite(currentValue) && quantity > 0
            ? currentValue / quantity
            : NaN,
        acquisitionDate = String(body.acquisitionDate || "").trim() || null;
      if (
        !ticker ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        (averageCost !== null &&
          (!Number.isFinite(averageCost) || averageCost < 0)) ||
        !Number.isFinite(currentPrice) ||
        currentPrice < 0
      )
        return Response.json(
          {
            error:
              "Ticker, positive quantity, and current price are required; average cost is optional",
          },
          { status: 400 },
        );
      const account = await db
        .prepare(
          "SELECT a.id FROM accounts a JOIN entities e ON e.id=a.entity_id WHERE a.id=? AND e.household_id=? AND a.connection_id IS NULL AND a.type='investment'",
        )
        .bind(body.accountId, householdId)
        .first();
      if (!account)
        return Response.json(
          { error: "Manual investment account not found" },
          { status: 404 },
        );
      const security = await db
          .prepare(
            "INSERT INTO securities(id,ticker,name,type,currency) VALUES(?,?,?,'stock','USD') ON CONFLICT(ticker,type) DO UPDATE SET name=excluded.name RETURNING id",
          )
          .bind(`manual_sec_${crypto.randomUUID()}`, ticker, name || ticker)
          .first<{ id: string }>(),
        holdingId = `manual_hold_${crypto.randomUUID()}`;
      await db.batch([
        db
          .prepare(
            "INSERT INTO holdings(id,account_id,security_id,quantity,cost_basis_cents,price_cents,price_at,acquisition_date) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP,?) ON CONFLICT(account_id,security_id) DO UPDATE SET quantity=excluded.quantity,cost_basis_cents=excluded.cost_basis_cents,price_cents=excluded.price_cents,price_at=CURRENT_TIMESTAMP",
          )
          .bind(
            holdingId,
            body.accountId,
            security!.id,
            quantity,
            averageCost === null
              ? null
              : Math.round(quantity * averageCost * 100),
            Math.round(currentPrice * 100),
            acquisitionDate,
          ),
        db
          .prepare(
            "INSERT INTO audit_log(id,household_id,user_id,action,target_type,target_id,metadata_json) VALUES(?,?,?,?,?,?,?)",
          )
          .bind(
            `audit_${crypto.randomUUID()}`,
            householdId,
            userId,
            "manual_holding_saved",
            "holding",
            holdingId,
            JSON.stringify({ accountId: body.accountId, ticker, quantity }),
          ),
      ]);
      return Response.json({ ok: true, ticker }, { status: 201 });
    }
    const alias = String(body.alias || "")
      .trim()
      .slice(0, 80);
    if (body.source !== "manual")
      return Response.json(
        { error: "Invalid account source" },
        { status: 400 },
      );
    if (!alias)
      return Response.json(
        { error: "Account alias is required" },
        { status: 400 },
      );
    if (!accountTypes.includes(String(body.accountType)))
      return Response.json({ error: "Invalid account type" }, { status: 400 });
    if (!purposes.includes(String(body.purpose)))
      return Response.json(
        { error: "Invalid investment purpose" },
        { status: 400 },
      );
    const accountId = `manual_account_${crypto.randomUUID()}`,
      owner =
        String(body.owner || "Household member")
          .trim()
          .slice(0, 80) || "Household member",
      cashBalance = Number(body.cashBalance || 0),
      institutionName =
        String(body.institutionName || "Manual investment institution")
          .trim()
          .slice(0, 100) || "Manual investment institution";
    if (!Number.isFinite(cashBalance) || cashBalance < 0)
      return Response.json(
        { error: "Cash balance must be zero or greater" },
        { status: 400 },
      );
    await db.batch([
      db
        .prepare(
          "INSERT INTO accounts(id,entity_id,provider_account_id,name,official_name,nickname,investment_purpose,type,subtype,currency,current_balance_cents,available_balance_cents,investment_sync_status,manual_owner_name,updated_at) VALUES(?,?,?,?,?,?,?,'investment',?,'USD',?,?,'MANUAL',?,CURRENT_TIMESTAMP)",
        )
        .bind(
          accountId,
          entityId,
          accountId,
          `${institutionName} manual investment account`,
          `${institutionName} Investment Account`,
          alias,
          body.purpose,
          body.accountType,
          Math.round(cashBalance * 100),
          Math.round(cashBalance * 100),
          owner,
        ),
      db
        .prepare(
          "INSERT INTO audit_log(id,household_id,user_id,action,target_type,target_id,metadata_json) VALUES(?,?,?,?,?,?,?)",
        )
        .bind(
          `audit_${crypto.randomUUID()}`,
          householdId,
          userId,
          "manual_investment_account_created",
          "account",
          accountId,
          JSON.stringify({
            institutionName,
            accountType: body.accountType,
            purpose: body.purpose,
          }),
        ),
    ]);
    return Response.json(
      {
        ok: true,
        account: {
          id: accountId,
          nickname: alias,
          subtype: body.accountType,
          investment_purpose: body.purpose,
          institutionName,
          source: "manual",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("MANUAL_INVESTMENT_WRITE_FAILED", error);
    return Response.json(
      {
        error: "Manual investment data could not be saved.",
        code: "MANUAL_INVESTMENT_WRITE_FAILED",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { db, householdId, userId, role } = await workspace(request),
      body = (await request.json()) as {
        connectionId?: string;
        accountId?: string;
      };

    if (body.accountId) {
      const account = await db
        .prepare(
          `SELECT a.id,COALESCE(NULLIF(a.nickname,''),NULLIF(a.name,''),'Manual investment account') account_name
           FROM accounts a
           JOIN entities e ON e.id=a.entity_id
           WHERE a.id=? AND e.household_id=? AND a.type='investment' AND a.connection_id IS NULL`,
        )
        .bind(body.accountId, householdId)
        .first<Record<string, string>>();
      if (!account)
        return Response.json(
          { error: "Manual investment account not found. Plaid accounts must be disconnected from their institution card." },
          { status: 404 },
        );

      await db.batch([
        db
          .prepare(
            `DELETE FROM tax_lot_disposals
             WHERE lot_id IN (SELECT id FROM tax_lots WHERE account_id=?)
                OR sell_transaction_id IN (SELECT id FROM investment_transactions WHERE account_id=?)`,
          )
          .bind(body.accountId, body.accountId),
        db.prepare("DELETE FROM tax_lots WHERE account_id=?").bind(body.accountId),
        db
          .prepare("UPDATE investment_transactions SET transfer_account_id=NULL WHERE transfer_account_id=?")
          .bind(body.accountId),
        db
          .prepare("DELETE FROM investment_transactions WHERE account_id=?")
          .bind(body.accountId),
        db.prepare("DELETE FROM holdings WHERE account_id=?").bind(body.accountId),
        db.prepare("DELETE FROM transactions WHERE account_id=?").bind(body.accountId),
        db
          .prepare(
            "DELETE FROM accounts WHERE id=? AND connection_id IS NULL AND entity_id IN (SELECT id FROM entities WHERE household_id=?)",
          )
          .bind(body.accountId, householdId),
      ]);
      return Response.json({
        ok: true,
        accountId: account.id,
        accountName: account.account_name,
      });
    }

    if (!body.connectionId)
      return Response.json(
        { error: "accountId or connectionId required" },
        { status: 400 },
      );
    const connection = await db
      .prepare(
        "SELECT id,institution_name,connected_by_user_id,encrypted_access_token FROM connections WHERE id=? AND household_id=? AND provider='plaid'",
      )
      .bind(body.connectionId, householdId)
      .first<Record<string, string>>();
    if (!connection)
      return Response.json(
        { error: "Plaid connection not found" },
        { status: 404 },
      );
    if (
      connection.connected_by_user_id !== userId &&
      !["owner", "co_owner"].includes(role)
    )
      return Response.json(
        {
          error:
            "Only the connection owner or a household owner can remove this connection",
        },
        { status: 403 },
      );
    if (connection.encrypted_access_token) {
      const host =
          process.env.PLAID_ENV === "production"
            ? "https://production.plaid.com"
            : process.env.PLAID_ENV === "development"
              ? "https://development.plaid.com"
              : "https://sandbox.plaid.com",
        token = await decryptSecret(connection.encrypted_access_token),
        revocation = await fetch(`${host}/item/remove`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: process.env.PLAID_CLIENT_ID,
            secret: process.env.PLAID_SECRET,
            access_token: token,
          }),
          cache: "no-store",
        });
      if (!revocation.ok)
        return Response.json(
          {
            error: `Plaid could not revoke this connection (${revocation.status}). Nothing was deleted.`,
          },
          { status: 502 },
        );
    }
    await db.batch([
      db
        .prepare(
          "DELETE FROM holdings WHERE account_id IN (SELECT id FROM accounts WHERE connection_id=?)",
        )
        .bind(body.connectionId),
      db
        .prepare(
          "DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE connection_id=?)",
        )
        .bind(body.connectionId),
      db
        .prepare("DELETE FROM accounts WHERE connection_id=?")
        .bind(body.connectionId),
      db
        .prepare("DELETE FROM connections WHERE id=? AND household_id=?")
        .bind(body.connectionId, householdId),
    ]);
    return Response.json({
      ok: true,
      institution: connection.institution_name || "Plaid institution",
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to remove connection",
      },
      { status: 500 },
    );
  }
}