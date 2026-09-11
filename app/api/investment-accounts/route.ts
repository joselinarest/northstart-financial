import { id, workspace } from "@/lib/db";
import { parseInvestmentAccountSettings } from "@/lib/domain/investment-accounts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { db, householdId } = await workspace(request);
    const accounts = await db.prepare(`SELECT a.id,a.name,a.official_name,a.nickname,a.type,a.subtype,a.currency,
      CASE WHEN a.connection_id IS NULL THEN 'MANUAL' ELSE 'CONNECTED' END source,a.updated_at,
      s.strategy_type,s.share_mode,s.benchmark_symbol,s.goal_name,s.horizon_months,s.risk_profile,
      s.maximum_position_bps,s.maximum_risk_bps,s.available_cash_cents,s.policy_json
      FROM accounts a JOIN entities e ON e.id=a.entity_id
      LEFT JOIN investment_account_settings s ON s.account_id=a.id
      WHERE e.household_id=? AND a.type='investment' AND a.hidden=0 ORDER BY a.updated_at DESC`).bind(householdId).all();
    return Response.json({ accounts: accounts.results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Investment accounts unavailable" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { db, householdId, userId } = await workspace(request);
    const body = await request.json() as Record<string, unknown>;
    const accountId = String(body.accountId || "");
    const account = await db.prepare(`SELECT a.id FROM accounts a JOIN entities e ON e.id=a.entity_id
      WHERE a.id=? AND e.household_id=? AND a.type='investment'`).bind(accountId, householdId).first();
    if (!account) return Response.json({ error: "Investment account not found" }, { status: 404 });
    const settings = parseInvestmentAccountSettings(body);
    await db.batch([
      db.prepare(`INSERT INTO investment_account_settings(account_id,strategy_type,share_mode,benchmark_symbol,goal_name,horizon_months,risk_profile,maximum_position_bps,maximum_risk_bps,available_cash_cents,policy_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,?::jsonb)
        ON CONFLICT(account_id) DO UPDATE SET strategy_type=excluded.strategy_type,share_mode=excluded.share_mode,benchmark_symbol=excluded.benchmark_symbol,goal_name=excluded.goal_name,horizon_months=excluded.horizon_months,risk_profile=excluded.risk_profile,maximum_position_bps=excluded.maximum_position_bps,maximum_risk_bps=excluded.maximum_risk_bps,available_cash_cents=excluded.available_cash_cents,policy_json=excluded.policy_json,updated_at=CURRENT_TIMESTAMP`)
        .bind(accountId,settings.strategyType,settings.shareMode,settings.benchmarkSymbol,settings.goalName,settings.horizonMonths,settings.riskProfile,settings.maximumPositionBps,settings.maximumRiskBps,settings.availableCashCents.toString(),JSON.stringify(settings.policy)),
      db.prepare("INSERT INTO audit_log(id,household_id,user_id,action,target_type,target_id,metadata_json) VALUES(?,?,?,?,?,?,?)")
        .bind(id("audit"),householdId,userId,"investment_account.strategy_saved","account",accountId,JSON.stringify({strategyType:settings.strategyType,shareMode:settings.shareMode})),
    ]);
    return Response.json({ ok: true, accountId, settings: { ...settings, availableCashCents: settings.availableCashCents.toString() } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save investment strategy" }, { status: 400 });
  }
}

