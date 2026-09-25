import type {PostgresDatabase} from "@/lib/db";
import {recommendedTradingPolicy,type TradingPolicy} from "@/lib/trading-policy";
export async function accountRiskSettings(db:PostgresDatabase,householdId:string,accountId:string){
  const account=await db.prepare("SELECT a.id,COALESCE(s.strategy_type,a.investment_purpose,'GROWTH_5_7') strategy,COALESCE(s.available_cash_cents,a.available_balance_cents,0)::text cash,COALESCE((SELECT SUM(h.quantity*h.price_cents) FROM holdings h WHERE h.account_id=a.id),0)::text invested,COALESCE((SELECT MAX(h.quantity*h.price_cents) FROM holdings h WHERE h.account_id=a.id),0)::text largest FROM accounts a JOIN entities e ON e.id=a.entity_id LEFT JOIN investment_account_settings s ON s.account_id=a.id WHERE a.id=? AND e.household_id=? AND a.type='investment'").bind(accountId,householdId).first<{id:string;strategy:string;cash:string;invested:string;largest:string}>();
  if(!account)throw Error("INVESTMENT_ACCOUNT_NOT_FOUND");
  const value=(Number(account.cash)+Number(account.invested))/100,cash=Number(account.cash)/100;
  // Unknown liquidity uses the conservative branch until market evidence confirms it.
  const recommended=recommendedTradingPolicy({accountType:account.strategy,value,cash,largestPositionBps:value?Number(account.largest)/100/value*10000:0,liquid:false});
  await db.prepare("INSERT INTO account_risk_config(account_id,recommended_json) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET recommended_json=EXCLUDED.recommended_json").bind(accountId,JSON.stringify(recommended)).run();
  const strategy=/SWING/i.test(account.strategy)?'SWING':/RETIRE/i.test(account.strategy)?'RETIREMENT':/CHILD|CUSTODIAL/i.test(account.strategy)?'CHILD_GROWTH':/DIVIDEND/i.test(account.strategy)?'DIVIDEND_INCOME':'GROWTH_5_7';
  await db.prepare("INSERT INTO investment_account_settings(account_id,strategy_type,goal_name,risk_profile,maximum_position_bps,maximum_risk_bps,available_cash_cents,policy_json) VALUES(?,?,'Build wealth','CONSERVATIVE',?,?,?,?::jsonb) ON CONFLICT(account_id) DO NOTHING").bind(accountId,strategy,recommended.maxPositionBps,recommended.swingRiskBps,account.cash,JSON.stringify({tradingPolicy:recommended})).run();
  const saved=await db.prepare("SELECT custom_json FROM account_risk_config WHERE account_id=?").bind(accountId).first<{custom_json:TradingPolicy|null}>();
  return {accountId,value,cash,recommended,effective:saved?.custom_json||recommended};
}
