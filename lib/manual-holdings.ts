import {id,type PostgresDatabase} from '@/lib/db';

export type ManualHoldingInput={accountId?:string;ticker?:string;name?:string;quantity?:number;averageCost?:number|string|null;currentPrice?:number|null;currentValue?:number|null;acquisitionDate?:string|null;mode?:'ADD'|'REPLACE'|'MERGE'|'DELETE'};
export class ManualHoldingError extends Error {constructor(message:string,public status=400){super(message)}}
/** Explicit duplicate semantics and account locking prevent silent replacement and lost updates. */
export async function saveManualHolding(db:PostgresDatabase,scope:{householdId:string;userId:string},input:ManualHoldingInput){
 const ticker=String(input.ticker||'').trim().toUpperCase(),mode=input.mode||'ADD',quantity=Number(input.quantity);
 const averageCost=input.averageCost==null||input.averageCost===''?null:Number(input.averageCost);
 const date=input.acquisitionDate||null;
 if(!/^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(ticker)||!['ADD','REPLACE','MERGE','DELETE'].includes(mode))throw new ManualHoldingError('Valid ticker and holding operation are required');
 if(mode!=='DELETE'&&(!Number.isFinite(quantity)||quantity<=0||(averageCost!==null&&(!Number.isFinite(averageCost)||averageCost<0))))throw new ManualHoldingError('Positive shares and a valid optional average cost are required');
 if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw new ManualHoldingError('Invalid purchase date');
 const price=input.currentPrice==null?input.currentValue==null?null:Number(input.currentValue)/quantity:Number(input.currentPrice);
 if(price!==null&&(!Number.isFinite(price)||price<0))throw new ManualHoldingError('Invalid saved price');
 return db.transaction(async tx=>{
  const account=await tx.prepare("SELECT a.id FROM accounts a JOIN entities e ON e.id=a.entity_id WHERE a.id=? AND e.household_id=? AND a.connection_id IS NULL AND a.type='investment' FOR UPDATE OF a").bind(input.accountId,scope.householdId).first();
  if(!account)throw new ManualHoldingError('Manual investment account not found',404);
  const existing=await tx.prepare('SELECT h.id,h.security_id,h.quantity,h.cost_basis_cents,h.price_cents,h.acquisition_date FROM holdings h JOIN securities s ON s.id=h.security_id WHERE h.account_id=? AND s.ticker=?').bind(input.accountId,ticker).first<Record<string,any>>();
  if(existing&&mode==='ADD')throw new ManualHoldingError('This ticker already exists. Select Edit to replace it or Merge to add shares.',409);
  if(!existing&&(mode==='REPLACE'||mode==='DELETE'))throw new ManualHoldingError('Holding not found',404);
  let holdingId=existing?.id||id('manual_hold');
  if(mode==='DELETE')await tx.prepare('DELETE FROM holdings WHERE id=? AND account_id=?').bind(holdingId,input.accountId).run();
  else {
   const security=existing?{id:existing.security_id}:await tx.prepare("INSERT INTO securities(id,ticker,name,type,currency) VALUES(?,?,?,'stock','USD') ON CONFLICT(ticker,type) DO UPDATE SET ticker=EXCLUDED.ticker RETURNING id").bind(id('manual_sec'),ticker,String(input.name||ticker).slice(0,120)).first<{id:string}>();
   const merge=mode==='MERGE'&&existing,newQuantity=quantity+(merge?Number(existing.quantity):0),cost=averageCost===null||merge&&existing.cost_basis_cents==null?null:Math.round(quantity*averageCost*100)+(merge?Number(existing.cost_basis_cents):0);
   await tx.prepare('INSERT INTO holdings(id,account_id,security_id,quantity,cost_basis_cents,price_cents,price_at,acquisition_date) VALUES(?,?,?,?,?,?,NULL,?) ON CONFLICT(account_id,security_id) DO UPDATE SET quantity=EXCLUDED.quantity,cost_basis_cents=EXCLUDED.cost_basis_cents,price_cents=EXCLUDED.price_cents,price_at=NULL,acquisition_date=EXCLUDED.acquisition_date').bind(holdingId,input.accountId,security!.id,newQuantity,cost,price===null?existing?.price_cents??null:Math.round(price*100),merge?(existing.acquisition_date&&date?[existing.acquisition_date,date].sort()[0]:existing.acquisition_date||date):date).run();
  }
  await tx.prepare('UPDATE accounts a SET current_balance_cents=COALESCE(available_balance_cents,0)+COALESCE((SELECT SUM(ROUND(h.quantity*COALESCE(h.price_cents,0))) FROM holdings h WHERE h.account_id=a.id),0),updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(input.accountId).run();
  await tx.prepare('INSERT INTO audit_log(id,household_id,user_id,action,target_type,target_id,metadata_json) VALUES(?,?,?,?,?,?,?)').bind(id('audit'),scope.householdId,scope.userId,`manual_holding_${mode.toLowerCase()}`,'holding',holdingId,JSON.stringify({accountId:input.accountId,ticker,mode})).run();
  return {ok:true,ticker,holdingId,mode,priceStatus:'SAVED_PRICE_NOT_LIVE'};
 });
}
