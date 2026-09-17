import { database, workspace, type DbStatement } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import {
  enqueueTransactionNotification,
  type TransactionEventType,
} from "@/lib/transaction-notifications";
import { loadRuntimeSecrets } from "@/lib/runtime-secrets";
import { after } from "next/server";

const plaidHost = () =>
  process.env.PLAID_ENV === "production"
    ? "https://production.plaid.com"
    : process.env.PLAID_ENV === "development"
      ? "https://development.plaid.com"
      : "https://sandbox.plaid.com";
async function plaid(
  path: string,
  accessToken: string,
  extra: Record<string, unknown> = {},
) {
  const response = await fetch(`${plaidHost()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      access_token: accessToken,
      ...extra,
    }),
  });
  const payload=await response.json().catch(()=>({})) as Record<string,any>;
  if (!response.ok) {
    const error=new Error(String(payload.error_message||payload.error_code||`Plaid ${path} failed: ${response.status}`)) as Error&{code?:string;type?:string;requestId?:string};
    error.code=String(payload.error_code||"PLAID_API_ERROR");error.type=String(payload.error_type||"API_ERROR");error.requestId=payload.request_id?String(payload.request_id):undefined;throw error;
  }
  return payload;
}
const safePlaidMessage=(code:string)=>code==="INSTITUTION_DOWN"?"The financial institution is temporarily unavailable.":code==="ADDITIONAL_CONSENT_REQUIRED"||code==="ACCESS_NOT_GRANTED"?"Additional investment-account consent is required.":code==="PRODUCTS_NOT_SUPPORTED"?"This institution does not support the requested Investments configuration.":code==="NO_INVESTMENT_ACCOUNTS"?"Plaid did not return an eligible investment account.":code==="PRODUCT_NOT_READY"?"Plaid is still preparing the investment data.":code==="ITEM_LOGIN_REQUIRED"?"The institution requires authentication again.":"The provider could not synchronize investment data.";
const plaidError=(error:unknown)=>{const code=String((error as any)?.code||"PLAID_API_ERROR"),referenceId=`plaid_sync_${crypto.randomUUID()}`;console.error("PLAID_INVESTMENT_REQUEST_FAILED",{referenceId,code,type:String((error as any)?.type||"API_ERROR"),requestId:String((error as any)?.requestId||"")||null,message:error instanceof Error?error.message:"Plaid request failed",occurredAt:new Date().toISOString()});return{code,message:`${safePlaidMessage(code)} Reference ${referenceId}.`}};
const investmentReconnectCodes=new Set(["ADDITIONAL_CONSENT_REQUIRED","ACCESS_NOT_GRANTED","ITEM_LOGIN_REQUIRED"]);
const investmentUnsupportedCodes=new Set(["NO_INVESTMENT_ACCOUNTS","PRODUCTS_NOT_SUPPORTED"]);
const investmentStatusFor=(code:string)=>code==="PRODUCT_NOT_READY"?"PENDING":investmentUnsupportedCodes.has(code)?"UNSUPPORTED":code==="INSTITUTION_DOWN"?"TEMPORARILY_UNAVAILABLE":investmentReconnectCodes.has(code)?"RECONNECT_REQUIRED":"ERROR";
const cents = (value: unknown) => Math.round(Number(value || 0) * 100);

export async function POST(request: Request) {
  try {
    await loadRuntimeSecrets();
    const body = (await request.json()) as {
        connectionId?: string;
        householdId?: string;
        investmentOnly?: boolean;
        trigger?: string;
        webhookHash?: string;
      },
      internal =
        Boolean(process.env.CRON_SECRET) &&
        request.headers.get("authorization") ===
          `Bearer ${process.env.CRON_SECRET}`;
    const context = internal
        ? {
            db: await database(),
            householdId: String(body.householdId || ""),
            userId: "system",
            role: "owner",
          }
        : await workspace(request),
      { db, householdId, role } = context;
    if (!body.connectionId)
      return Response.json({ error: "connectionId required" }, { status: 400 });
    if (internal && !householdId)
      return Response.json({ error: "householdId required" }, { status: 400 });
    const connection = await db
      .prepare(
        "SELECT * FROM connections WHERE id=? AND household_id=? AND provider='plaid' AND status='active'",
      )
      .bind(body.connectionId, householdId)
      .first<Record<string, string>>();
    if (!connection?.encrypted_access_token)
      return Response.json({ error: "Connection not found" }, { status: 404 });
    const connectionOwner = connection.connected_by_user_id || context.userId;
    if (
      !internal &&
      connection.connected_by_user_id &&
      connectionOwner !== context.userId &&
      !["owner", "co_owner", "manager"].includes(role)
    )
      return Response.json(
        {
          error:
            "Only this connection's owner or a household manager can synchronize it",
        },
        { status: 403 },
      );
    const entityId = `entity_${householdId}_${connectionOwner}_personal`,
      owner = await db
        .prepare("SELECT display_name FROM users WHERE id=?")
        .bind(connectionOwner)
        .first<{ display_name?: string }>();
    await db
      .prepare(
        "INSERT INTO entities(id,household_id,type,name) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING",
      )
      .bind(
        entityId,
        householdId,
        "personal",
        `${owner?.display_name || "Household member"} finances`,
      )
      .run();
    const token = await decryptSecret(connection.encrypted_access_token),
      itemData = await plaid("/item/get", token),
      accountData = await plaid("/accounts/get", token),
      accountWrites: DbStatement[] = [];
    if (itemData?.item?.item_id && !connection.provider_item_id)
      await db
        .prepare(
          "UPDATE connections SET provider_item_id=? WHERE id=? AND household_id=?",
        )
        .bind(itemData.item.item_id, body.connectionId, householdId)
        .run();
    await db.prepare("UPDATE connections SET provider_item_id=COALESCE(provider_item_id,?),plaid_products_json=?::jsonb,plaid_consented_products_json=?::jsonb,plaid_billed_products_json=?::jsonb,plaid_consent_expiration_at=? WHERE id=? AND household_id=?")
      .bind(itemData?.item?.item_id||null,JSON.stringify(itemData?.item?.products||[]),JSON.stringify(itemData?.item?.consented_products||[]),JSON.stringify(itemData?.item?.billed_products||[]),itemData?.item?.consent_expiration_time||null,body.connectionId,householdId).run();
    const accountById = new Map<string, any>();
    for (const account of accountData.accounts || []) {
      accountById.set(account.account_id, account);
      accountWrites.push(
        db
          .prepare(
            "INSERT INTO accounts(id,entity_id,connection_id,provider_account_id,name,official_name,type,subtype,currency,mask,current_balance_cents,available_balance_cents,credit_limit_cents,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=excluded.name,official_name=excluded.official_name,type=excluded.type,subtype=excluded.subtype,current_balance_cents=excluded.current_balance_cents,available_balance_cents=excluded.available_balance_cents,credit_limit_cents=excluded.credit_limit_cents,updated_at=CURRENT_TIMESTAMP",
          )
          .bind(
            `plaid_${account.account_id}`,
            entityId,
            body.connectionId,
            account.account_id,
            account.name,
            account.official_name || null,
            account.type,
            account.subtype || null,
            account.balances?.iso_currency_code || "USD",
            account.mask || null,
            cents(account.balances?.current),
            account.balances?.available == null
              ? null
              : cents(account.balances.available),
            account.balances?.limit == null
              ? null
              : cents(account.balances.limit),
          ),
      );
    }
    if (accountWrites.length) await db.batch(accountWrites);
    let cursor = connection.cursor || null,
      added = 0,
      modified = 0,
      removed = 0,
      notificationsQueued = 0,
      hasMore = !body.investmentOnly;
    while (hasMore) {
      const data = await plaid("/transactions/sync", token, {
          cursor,
          count: 250,
        }),
        writes: DbStatement[] = [],
        events: Array<{
          transaction: any;
          type: TransactionEventType;
          previousPending?: boolean | null;
          riskScore: number;
          riskReasons: string[];
          newMerchant: boolean;
          recurring: boolean;
          recurringIdentified: boolean;
        }> = [],
        removedEvents: Array<{
          transaction: any;
          type: TransactionEventType;
          previousPending: null;
          riskScore: number;
          riskReasons: string[];
          newMerchant: boolean;
          recurring: boolean;
          recurringIdentified: boolean;
        }> = [];
      for (const transaction of [
        ...(data.added || []),
        ...(data.modified || []),
      ]) {
        const transactionId = `plaid_txn_${transaction.transaction_id}`,
          existing = await db
            .prepare(
              "SELECT pending,amount_cents,category,merchant,description,recurring_id FROM transactions WHERE id=?",
            )
            .bind(transactionId)
            .first<Record<string, any>>(),
          merchantName = String(
            transaction.merchant_name || transaction.name || "",
          ).trim(),
          merchantHistory = merchantName
            ? await db
                .prepare(
                  "SELECT COUNT(*) count,COALESCE(AVG(ABS(amount_cents)),0) average_cents,COALESCE(MIN(ABS(amount_cents)),0) minimum_cents,COALESCE(MAX(ABS(amount_cents)),0) maximum_cents FROM transactions WHERE entity_id=? AND LOWER(COALESCE(merchant,description))=LOWER(?) AND id<>?",
                )
                .bind(entityId, merchantName, transactionId)
                .first<{
                  count: string;
                  average_cents: string;
                  minimum_cents: string;
                  maximum_cents: string;
                }>()
            : null,
          merchantCount = Number(merchantHistory?.count || 0),
          merchantAverage = Number(merchantHistory?.average_cents || 0),
          recurring =
            merchantCount >= 2 &&
            Number(merchantHistory?.maximum_cents || 0) -
              Number(merchantHistory?.minimum_cents || 0) <=
              Math.max(300, merchantAverage * 0.15);
        const priorPending = transaction.pending_transaction_id
          ? await db
              .prepare("SELECT pending FROM transactions WHERE id=?")
              .bind(`plaid_txn_${transaction.pending_transaction_id}`)
              .first<{ pending: number | boolean }>()
          : null;
        let type: TransactionEventType = existing ? "UPDATED" : "IMPORTED";
        if (
          !transaction.pending &&
          (Boolean(existing?.pending) || Boolean(priorPending?.pending))
        )
          type = "PENDING_POSTED";
        const amount = cents(Math.abs(transaction.amount || 0)),
          reasons: string[] = [];
        let riskScore = 0;
        if (amount >= 100000) {
          riskScore += 25;
          reasons.push("Large transaction of at least $1,000");
        }
        if (!existing && amount >= 25000) {
          riskScore += 18;
          reasons.push("New transaction over $250");
        }
        if (
          merchantAverage > 0 &&
          amount > merchantAverage * 3 &&
          amount - merchantAverage >= 10000
        ) {
          riskScore += 30;
          reasons.push("Amount is more than 3× this merchant’s prior average");
        }
        const duplicate = await db
          .prepare(
            "SELECT id FROM transactions WHERE account_id=? AND id<>? AND LOWER(COALESCE(merchant,description))=LOWER(?) AND ABS(amount_cents)=? AND ABS(EXTRACT(EPOCH FROM (NULLIF(posted_at,'')::timestamptz-?::timestamptz)))<=86400 LIMIT 1",
          )
          .bind(
            `plaid_${transaction.account_id}`,
            transactionId,
            merchantName,
            amount,
            transaction.datetime || transaction.date,
          )
          .first();
        if (duplicate) {
          riskScore += 35;
          reasons.push("Possible duplicate charge within 24 hours");
        }
        const classificationText = `${transaction.name || ""} ${transaction.personal_finance_category?.detailed || ""}`,
          isAtm = /atm|cash withdrawal/i.test(classificationText),
          isFee = /fee|overdraft|late fee|interest charge/i.test(classificationText),
          isForeign = /foreign|international|currency conversion/i.test(classificationText),
          subscriptionIncrease = recurring && merchantAverage > 0 && amount > merchantAverage * 1.1 && amount - merchantAverage >= 100;
        if (subscriptionIncrease)
          reasons.push(`Recurring charge increased from its ${Math.round(merchantAverage / 100)} dollar average`);
        if (isAtm && amount >= 40000) {
          riskScore += 25;
          reasons.push("Unusually large ATM withdrawal");
        }
        if (isFee) {
          riskScore += 10;
          reasons.push("Bank, card, overdraft, late, or interest fee");
        }
        if (isForeign) {
          riskScore += 20;
          reasons.push("Possible foreign or international transaction");
        }
        riskScore = Math.min(100, riskScore);
        if (riskScore >= 45) type = "SUSPICIOUS";
        else if (type === "PENDING_POSTED") type = "PENDING_POSTED";
        else if (duplicate) type = "DUPLICATE_CHARGE";
        else if (subscriptionIncrease) type = "SUBSCRIPTION_INCREASE";
        else if (isForeign) type = "FOREIGN_TRANSACTION";
        else if (isAtm) type = "ATM_WITHDRAWAL";
        else if (isFee) type = "FEE";
        else if (amount >= 100000) type = "LARGE_TRANSACTION";
        else if (merchantCount === 0 && transaction.amount >= 0) type = "NEW_MERCHANT";
        else if (!existing && transaction.amount < 0) type = "DEPOSIT";
        else if (!existing && accountById.get(transaction.account_id)?.type === "credit") type = "CARD_PURCHASE";
        else if (!existing) type = "WITHDRAWAL";
        writes.push(
          db
            .prepare(
              "INSERT INTO transactions(id,account_id,provider_transaction_id,posted_at,authorized_at,merchant,description,amount_cents,direction,category,subcategory,entity_id,pending,recurring_id,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET posted_at=excluded.posted_at,merchant=excluded.merchant,description=excluded.description,amount_cents=excluded.amount_cents,direction=excluded.direction,category=excluded.category,subcategory=excluded.subcategory,pending=excluded.pending,recurring_id=COALESCE(transactions.recurring_id,excluded.recurring_id),updated_at=CURRENT_TIMESTAMP",
            )
            .bind(
              transactionId,
              `plaid_${transaction.account_id}`,
              transaction.transaction_id,
              transaction.datetime || transaction.date,
              transaction.authorized_datetime ||
                transaction.authorized_date ||
                null,
              transaction.merchant_name || null,
              transaction.name,
              amount,
              transaction.amount < 0 ? "inflow" : "outflow",
              transaction.personal_finance_category?.primary ||
                transaction.category?.[0] ||
                "Uncategorized",
              transaction.personal_finance_category?.detailed ||
                transaction.category?.[1] ||
                null,
              entityId,
              transaction.pending ? 1 : 0,
              recurring
                ? `merchant_${merchantName
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "_")
                    .slice(0, 80)}`
                : null,
            ),
        );
        events.push({
          transaction,
          type,
          previousPending:
            existing?.pending == null ? null : Boolean(existing.pending),
          riskScore,
          riskReasons: reasons,
          newMerchant: merchantCount === 0,
          recurring,
          recurringIdentified: recurring && !existing?.recurring_id,
        });
      }
      for (const transaction of data.removed || []) {
        const stored = await db
          .prepare(
            "SELECT t.*,a.provider_account_id,a.name account_name,a.mask FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.id=? AND t.entity_id=?",
          )
          .bind(`plaid_txn_${transaction.transaction_id}`, entityId)
          .first<Record<string, any>>();
        if (stored)
          removedEvents.push({
            transaction: {
              transaction_id: transaction.transaction_id,
              account_id: stored.provider_account_id,
              name: stored.description,
              merchant_name: stored.merchant,
              amount: Number(stored.amount_cents || 0) / 100,
              date: stored.posted_at,
              iso_currency_code: "USD",
              personal_finance_category: { primary: stored.category },
            },
            type: "REMOVED",
            previousPending: null,
            riskScore: 0,
            riskReasons: [],
            newMerchant: false,
            recurring: Boolean(stored.recurring_id),
            recurringIdentified: false,
          });
        writes.push(
          db
            .prepare("DELETE FROM transactions WHERE id=? AND entity_id=?")
            .bind(`plaid_txn_${transaction.transaction_id}`, entityId),
        );
      }
      if (writes.length) await db.batch(writes);
      for (const event of [...events, ...removedEvents]) {
        const transaction = event.transaction,
          account = accountById.get(transaction.account_id) || {};
        const input = {
          householdId,
          accountId: `plaid_${transaction.account_id}`,
          transactionId: `plaid_txn_${transaction.transaction_id}`,
          providerTransactionId: transaction.transaction_id,
          institution: connection.institution_name,
          accountName:
            account.name || account.official_name || "Linked account",
          mask: account.mask,
          merchant: transaction.merchant_name,
          description: transaction.name || "Transaction",
          amountCents: cents(Math.abs(transaction.amount || 0)),
          currency:
            transaction.iso_currency_code ||
            account.balances?.iso_currency_code ||
            "USD",
          postedAt: transaction.datetime || transaction.date,
          category:
            transaction.personal_finance_category?.primary ||
            transaction.category?.[0] ||
            "Uncategorized",
          direction: (transaction.amount < 0 ? "inflow" : "outflow") as
            "inflow" | "outflow",
          pending: Boolean(transaction.pending),
          previousPending: event.previousPending,
          riskScore: event.riskScore,
          riskReasons: event.riskReasons,
          foreign: /foreign|international|currency conversion/i.test(
            `${transaction.name || ""} ${transaction.personal_finance_category?.detailed || ""}`,
          ),
          newMerchant: event.newMerchant,
          recurring: event.recurring,
        };
        const result = await enqueueTransactionNotification(db, {
          ...input,
          eventType: event.type,
        });
        notificationsQueued += result.queued;
        if (event.recurringIdentified) {
          const recurring = await enqueueTransactionNotification(db, {
            ...input,
            eventType: "RECURRING_IDENTIFIED",
          });
          notificationsQueued += recurring.queued;
        }
      }
      added += (data.added || []).length;
      modified += (data.modified || []).length;
      removed += (data.removed || []).length;
      cursor = data.next_cursor;
      hasMore = Boolean(data.has_more);
    }
    let investments:Record<string,any>|null=null,investmentError:{code:string;message:string}|null=null;
    try{investments=await plaid("/investments/holdings/get",token)}catch(error){investmentError=plaidError(error)}
    let holdingCount = 0,holdingsAdded=0,holdingsChanged=0,holdingsClosed=0;
    if (investments) {
      const writes: DbStatement[] = [];
      const priorHoldings=await db.prepare("SELECT h.id,h.account_id,h.provider_security_id,h.quantity,h.cost_basis_cents,h.price_cents FROM holdings h JOIN accounts a ON a.id=h.account_id WHERE a.connection_id=? AND h.provider_security_id IS NOT NULL").bind(body.connectionId).all<Record<string,any>>(),priorByKey=new Map(priorHoldings.results.map(row=>[`${row.account_id}|${row.provider_security_id}`,row])),seen=new Set<string>();
      for (const security of investments.securities || [])
        writes.push(
          db
            .prepare(
              "INSERT INTO securities(id,ticker,name,type,currency,provider_security_id) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ticker=excluded.ticker,name=excluded.name,type=excluded.type,currency=excluded.currency,provider_security_id=excluded.provider_security_id",
            )
            .bind(
              `plaid_sec_${security.security_id}`,
              security.ticker_symbol || null,
              security.name || "Unknown security",
              security.type || null,
              security.iso_currency_code || "USD",
              security.security_id,
            ),
        );
      for (const holding of investments.holdings || []) {
        holdingCount++;
        const accountId=`plaid_${holding.account_id}`,key=`${accountId}|${holding.security_id}`,prior=priorByKey.get(key),quantity=Number(holding.quantity||0),cost=holding.cost_basis==null?null:cents(holding.cost_basis),price=cents(holding.institution_price);seen.add(key);if(!prior)holdingsAdded++;else if(Number(prior.quantity)!==quantity||Number(prior.cost_basis_cents??0)!==Number(cost??0)||Number(prior.price_cents??0)!==price)holdingsChanged++;
        writes.push(
          db
            .prepare(
              "INSERT INTO holdings(id,account_id,security_id,quantity,cost_basis_cents,price_cents,price_at,provider_holding_id,provider_account_id,provider_security_id,provider_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(account_id,security_id) DO UPDATE SET quantity=excluded.quantity,cost_basis_cents=excluded.cost_basis_cents,price_cents=excluded.price_cents,price_at=excluded.price_at,provider_holding_id=excluded.provider_holding_id,provider_account_id=excluded.provider_account_id,provider_security_id=excluded.provider_security_id,provider_updated_at=CURRENT_TIMESTAMP",
            )
            .bind(
              `plaid_hold_${holding.account_id}_${holding.security_id}`,
              `plaid_${holding.account_id}`,
              `plaid_sec_${holding.security_id}`,
              Number(holding.quantity || 0),
              holding.cost_basis == null ? null : cents(holding.cost_basis),
              cents(holding.institution_price),
              holding.institution_price_as_of || new Date().toISOString(),
              `${holding.account_id}:${holding.security_id}`,
              holding.account_id,
              holding.security_id,
            ),
        );
      }
      for(const prior of priorHoldings.results)if(!seen.has(`${prior.account_id}|${prior.provider_security_id}`)){holdingsClosed++;writes.push(db.prepare("DELETE FROM holdings WHERE id=?").bind(prior.id))}
      if (writes.length) await db.batch(writes);
      await db.batch([db.prepare("UPDATE connections SET last_holdings_sync_at=CURRENT_TIMESTAMP,investment_access_status='ENABLED',latest_plaid_error_message=NULL WHERE id=? AND household_id=?").bind(body.connectionId,householdId),db.prepare("UPDATE accounts SET last_investment_sync_at=CURRENT_TIMESTAMP,last_provider_update_at=CURRENT_TIMESTAMP,investment_sync_status='SYNCED',investment_sync_error=NULL WHERE connection_id=? AND type='investment'").bind(body.connectionId)]);
    }
    let investmentTransactionCount=0;
    if(investments){
      const now=new Date(),start=new Date(now);start.setUTCFullYear(start.getUTCFullYear()-2);const iso=(date:Date)=>date.toISOString().slice(0,10);let offset=0,total=1;
      try{
        while(offset<total){const page=await plaid("/investments/transactions/get",token,{start_date:iso(start),end_date:iso(now),options:{count:500,offset}});total=Number(page.total_investment_transactions||0);const writes:DbStatement[]=[];
          for(const security of page.securities||[])writes.push(db.prepare("INSERT INTO securities(id,ticker,name,type,currency,provider_security_id) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ticker=excluded.ticker,name=excluded.name,type=excluded.type,currency=excluded.currency,provider_security_id=excluded.provider_security_id").bind(`plaid_sec_${security.security_id}`,security.ticker_symbol||null,security.name||"Unknown security",security.type||null,security.iso_currency_code||"USD",security.security_id));
          for(const transaction of page.investment_transactions||[]){const rawType=String(transaction.type||"").toLowerCase(),subtype=String(transaction.subtype||"").toLowerCase(),existingInvestment=await db.prepare("SELECT id FROM investment_transactions WHERE account_id=? AND source='PLAID' AND external_id=?").bind(`plaid_${transaction.account_id}`,transaction.investment_transaction_id).first();const type=rawType==="buy"?"BUY":rawType==="sell"?"SELL":rawType==="fee"?"FEE":/dividend/.test(subtype)?"DIVIDEND":/interest/.test(subtype)?"INTEREST":rawType==="transfer"?"TRANSFER":rawType==="cash"&&Number(transaction.amount)<0?"WITHDRAWAL":"DEPOSIT";writes.push(db.prepare(`INSERT INTO investment_transactions(id,household_id,account_id,security_id,transaction_type,trade_at,settle_at,quantity,price_cents,amount_cents,fee_cents,currency,source,external_id,notes,created_by_user_id)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'PLAID',?,?,?) ON CONFLICT(account_id,source,external_id) DO UPDATE SET security_id=excluded.security_id,transaction_type=excluded.transaction_type,trade_at=excluded.trade_at,settle_at=excluded.settle_at,quantity=excluded.quantity,price_cents=excluded.price_cents,amount_cents=excluded.amount_cents,fee_cents=excluded.fee_cents,currency=excluded.currency,notes=excluded.notes`).bind(`plaid_inv_tx_${transaction.investment_transaction_id}`,householdId,`plaid_${transaction.account_id}`,transaction.security_id?`plaid_sec_${transaction.security_id}`:null,type,transaction.date,transaction.date,transaction.quantity==null?null:Number(transaction.quantity),transaction.price==null?null:cents(transaction.price),cents(transaction.amount),cents(transaction.fees),transaction.iso_currency_code||"USD",transaction.investment_transaction_id,[transaction.name,transaction.subtype].filter(Boolean).join(" · ")||null,connectionOwner));writes.push(db.prepare("UPDATE investment_transactions SET provider_account_id=?,provider_security_id=? WHERE account_id=? AND source='PLAID' AND external_id=?").bind(transaction.account_id,transaction.security_id||null,`plaid_${transaction.account_id}`,transaction.investment_transaction_id));if(!existingInvestment)investmentTransactionCount++}
          if(writes.length)await db.batch(writes);offset+=(page.investment_transactions||[]).length;if(!(page.investment_transactions||[]).length)break}
        await db.prepare("UPDATE connections SET last_investment_transactions_sync_at=CURRENT_TIMESTAMP,investment_access_status='ENABLED',latest_plaid_error_message=NULL WHERE id=? AND household_id=?").bind(body.connectionId,householdId).run();
      }catch(error){investmentError=plaidError(error)}
    }
    if(investmentError){const status=investmentStatusFor(investmentError.code);await db.batch([db.prepare("UPDATE connections SET investment_access_status=?,error_code=?,latest_plaid_error_message=? WHERE id=? AND household_id=?").bind(status,investmentError.code,investmentError.message.slice(0,300),body.connectionId,householdId),db.prepare("UPDATE accounts SET investment_sync_status=?,investment_sync_error=? WHERE connection_id=? AND type='investment'").bind(status,investmentError.message.slice(0,300),body.connectionId),db.prepare("INSERT INTO investment_sync_history(id,household_id,connection_id,trigger,status,error_code,error_message,completed_at) VALUES(?,?,?,?,'FAILED',?,?,CURRENT_TIMESTAMP)").bind(`inv_sync_${crypto.randomUUID()}`,householdId,body.connectionId,body.trigger||'DIRECT_SYNC',investmentError.code,investmentError.message.slice(0,300))])}else if(investments){const changed=holdingsAdded+holdingsChanged+holdingsClosed+investmentTransactionCount>0;await db.prepare("INSERT INTO investment_sync_history(id,household_id,connection_id,trigger,status,holdings_added,holdings_changed,holdings_closed,transactions_added,result_json,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?::jsonb,CURRENT_TIMESTAMP)").bind(`inv_sync_${crypto.randomUUID()}`,householdId,body.connectionId,body.trigger||'DIRECT_SYNC',changed?'SUCCEEDED':'NO_CHANGES',holdingsAdded,holdingsChanged,holdingsClosed,investmentTransactionCount,JSON.stringify({holdings:holdingCount,reconciliation:changed?'provider changes applied':'no provider changes'})).run();if(body.webhookHash)await db.prepare("UPDATE plaid_webhook_events SET processed_at=CURRENT_TIMESTAMP,processing_error=NULL WHERE request_hash=?").bind(body.webhookHash).run()}
    await db
      .prepare(
        "UPDATE connections SET cursor=?,last_synced_at=CURRENT_TIMESTAMP,error_code=CASE WHEN investment_access_status IN ('RECONNECT_REQUIRED','PENDING','UNSUPPORTED','TEMPORARILY_UNAVAILABLE','ERROR') THEN error_code ELSE NULL END WHERE id=? AND household_id=?",
      )
      .bind(cursor, body.connectionId, householdId)
      .run();
    if (!internal && notificationsQueued && process.env.CRON_SECRET) {
      const base = process.env.APP_URL || new URL(request.url).origin;
      after(() =>
        fetch(`${base}/api/notifications/process`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        }).catch(() => undefined),
      );
    }
    return Response.json({
      status: "synced",
      accounts: (accountData.accounts || []).length,
      holdings: holdingCount,
      investmentTransactions:investmentTransactionCount,
      reconciliation:{holdingsAdded,holdingsChanged,holdingsClosed,result:holdingsAdded+holdingsChanged+holdingsClosed+investmentTransactionCount>0?"provider changes applied":"no provider changes"},
      investmentAccess:investmentError?{status:investmentStatusFor(investmentError.code),...investmentError}:{status:"ENABLED"},
      added,
      modified,
      removed,
      notificationsQueued,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const referenceId=`plaid_sync_${crypto.randomUUID()}`;console.error("PLAID_SYNC_FAILED",{referenceId,error,occurredAt:new Date().toISOString()});return Response.json(
      { error: `The provider synchronization could not be completed. Reference ${referenceId}.`, referenceId },
      { status: 502 },
    );
  }
}
