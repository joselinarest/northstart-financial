import type {PostgresDatabase} from './db';
export const DEFAULT_CASH_SYMBOLS=['QDERQ','SPAXX'];
export function cashSymbols(policy:any):string[]{const p=typeof policy==='string'?JSON.parse(policy):policy||{};return Array.isArray(p.cashSymbols)?p.cashSymbols.map((s:unknown)=>String(s).trim().toUpperCase()):DEFAULT_CASH_SYMBOLS;}
export function reconcileCash(base:number,reported:number,holdings:{symbol:string;valueCents:number;securityType?:string}[],symbols:string[]){
 const mapped=holdings.filter(h=>(h.securityType==='cash'||symbols.includes(h.symbol.toUpperCase()))),mappedCents=mapped.reduce((n,h)=>n+Math.max(0,Math.round(h.valueCents)||0),0);
 // Provider balances often already include the sweep. Never add the same cash twice.
 return {cashCents:Math.max(0,base||0,reported||0,mappedCents),mappedCents,mapped,symbols,largestInvestedCents:Math.max(0,...holdings.filter(h=>!symbols.includes(h.symbol.toUpperCase())).map(h=>h.valueCents))};
}
export async function investmentCash(db:PostgresDatabase,householdId:string,accountId:string){
 const a=await db.prepare(`SELECT a.id,a.connection_id,a.available_balance_cents,s.available_cash_cents,s.policy_json FROM accounts a JOIN entities e ON e.id=a.entity_id LEFT JOIN investment_account_settings s ON s.account_id=a.id WHERE a.id=? AND e.household_id=? AND a.type='investment'`).bind(accountId,householdId).first<any>();
 if(!a)throw Error('Investment account not found');
 const rows=(await db.prepare(`SELECT s.ticker symbol,s.type security_type,ROUND(h.quantity*h.price_cents)::text value_cents FROM holdings h JOIN securities s ON s.id=h.security_id WHERE h.account_id=? AND h.quantity>0 AND COALESCE(s.currency,'USD')='USD'`).bind(accountId).all<any>()).results;
 return reconcileCash(a.connection_id?0:Number(a.available_cash_cents??a.available_balance_cents??0),a.connection_id?Number(a.available_balance_cents||0):0,rows.map(h=>({symbol:String(h.symbol||(h.security_type==='cash'?'USD cash':'')),securityType:h.security_type,valueCents:Number(h.value_cents)})),cashSymbols(a.policy_json));
}
