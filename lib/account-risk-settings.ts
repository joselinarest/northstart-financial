import {investmentCash} from "@/lib/investment-cash";
import type {PostgresDatabase} from "@/lib/db";
import {recommendedTradingPolicy,type TradingPolicy} from "@/lib/trading-policy";
export async function accountRiskSettings(db:PostgresDatabase,householdId:string,accountId:string){
  const account=await db.prepare("SELECT a.id,s.maximum_risk_bps,s.goal_name,CASE WHEN a.investment_purpose='Mixed' THEN 'MIXED' ELSE COALESCE(s.strategy_type,a.investment_purpose,'GROWTH_5_7') END strategy,COALESCE(s.available_cash_cents,a.available_balance_cents,0)::text cash,COALESCE((SELECT SUM(h.quantity*h.price_cents) FROM holdings h WHERE h.account_id=a.id),0)::text invested,COALESCE((SELECT MAX(h.quantity*h.price_cents) FROM holdings h WHERE h.account_id=a.id),0)::text largest FROM accounts a JOIN entities e ON e.id=a.entity_id LEFT JOIN investment_account_settings s ON s.account_id=a.id WHERE a.id=? AND e.household_id=? AND a.type='investment'").bind(accountId,householdId).first<{id:string;maximum_risk_bps:number|null;goal_name:string|null;strategy:string;cash:string;invested:string;largest:string}>();
  if(!account)throw Error("INVESTMENT_ACCOUNT_NOT_FOUND");
  const cashMapping=await investmentCash(db,householdId,accountId);account.cash=String(cashMapping.cashCents);
  const value=(Number(account.cash)+Number(account.invested)-cashMapping.mappedCents)/100,cash=Number(account.cash)/100;
  // Unknown liquidity uses the conservative branch until market evidence confirms it.
  const recommended=recommendedTradingPolicy({accountType:account.strategy+" "+(account.goal_name||""),value,cash,largestPositionBps:value?cashMapping.largestInvestedCents/100/value*10000:0,liquid:false});
  await db.prepare("INSERT INTO account_risk_config(account_id,recommended_json) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET recommended_json=EXCLUDED.recommended_json").bind(accountId,JSON.stringify(recommended)).run();
  const strategy=/MIXED/i.test(account.strategy)?'SWING':/SWING/i.test(account.strategy)?'SWING':/RETIRE/i.test(account.strategy)?'RETIREMENT':/CHILD|CUSTODIAL/i.test(account.strategy)?'CHILD_GROWTH':/DIVIDEND/i.test(account.strategy)?'DIVIDEND_INCOME':'GROWTH_5_7';
  await db.prepare("INSERT INTO investment_account_settings(account_id,strategy_type,goal_name,risk_profile,maximum_position_bps,maximum_risk_bps,available_cash_cents,policy_json) VALUES(?,?,'Build wealth','CONSERVATIVE',?,?,?,?::jsonb) ON CONFLICT(account_id) DO NOTHING").bind(accountId,strategy,recommended.maxPositionBps,recommended.swingRiskBps,account.cash,JSON.stringify({tradingPolicy:recommended})).run();
  const saved=await db.prepare("SELECT custom_json FROM account_risk_config WHERE account_id=?").bind(accountId).first<{custom_json:TradingPolicy|null}>();
  const effective=saved?.custom_json||(account.maximum_risk_bps===0?{...recommended,swingRiskBps:0,dayRiskBps:0,optionsRiskBps:0}:recommended);
  await db.prepare("UPDATE investment_account_settings SET maximum_risk_bps=?,maximum_position_bps=?,policy_json=jsonb_set(COALESCE(policy_json,'{}'::jsonb),'{tradingPolicy}',?::jsonb) WHERE account_id=? AND (policy_json->'tradingPolicy'->>'label'='RECOMMENDED DEFAULTS')").bind(effective.swingRiskBps,effective.maxPositionBps,JSON.stringify(effective),accountId).run();
  return {accountId,value,cash,recommended,effective,cashMapping};
}

