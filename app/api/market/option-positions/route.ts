import {workspace} from '@/lib/db';
import {parseOptionContract,optionPositionValues} from '@/lib/option-position';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const {db,householdId}=await workspace(request),query=new URL(request.url).searchParams,accountId=query.get('accountId')||'',symbol=(query.get('symbol')||'').toUpperCase();
  if(!accountId||!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))return Response.json({error:'Account and stock symbol are required'},{status:400});
  const account=await db.prepare('SELECT a.id FROM accounts a JOIN entities e ON e.id=a.entity_id WHERE a.id=? AND e.household_id=?').bind(accountId,householdId).first();
  if(!account)return Response.json({error:'Account not found'},{status:404});
  const imported=await db.prepare('SELECT h.id,h.quantity,h.cost_basis_cents,s.ticker FROM holdings h JOIN securities s ON s.id=h.security_id WHERE h.account_id=? AND h.quantity<>0').bind(accountId).all<any>();
  const saved=await db.prepare("SELECT * FROM option_positions WHERE household_id=? AND account_id=? AND underlying_symbol=? AND status IN ('OPEN','INVALIDATED')").bind(householdId,accountId,symbol).all<any>();
  const positions=new Map<string,Record<string,any>>();
  for(const row of imported.results){const contract=parseOptionContract(row.ticker);if(!contract||contract.underlying!==symbol)continue;const quantity=Number(row.quantity),cost=row.cost_basis_cents==null?null:Number(row.cost_basis_cents)/100;const prior=positions.get(contract.symbol),signedCost=cost==null?null:quantity<0?-Math.abs(cost):cost;positions.set(contract.symbol,{...contract,id:row.id,quantity:quantity+Number(prior?.quantity||0),costBasis:prior?(prior.costBasis==null||signedCost==null?null:prior.costBasis+signedCost):signedCost,source:'Broker holding',savedPremium:null});}
  for(const row of saved.results){const contract=parseOptionContract(row.contract_symbol);if(!contract||positions.has(contract.symbol))continue;const quantity=Number(row.quantity),premium=Number(row.entry_premium_cents)/100;positions.set(contract.symbol,{...contract,id:row.id,quantity,costBasis:contract.multiplier==null?null:quantity*contract.multiplier*premium,savedPremium:row.current_premium_cents==null?null:Number(row.current_premium_cents)/100,savedAsOf:row.updated_at,source:'Recorded position',greeks:row.greeks_json});}
  const feed=process.env.ALPACA_OPTIONS_FEED||'indicative';let snapshots:Record<string,any>={},quoteError:string|null=null;
  const symbols=[...positions.keys()];
  if(symbols.length){
   try{
    if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)throw Error('Quote credentials unavailable');
    for(let i=0;i<symbols.length;i+=100){
     const params=new URLSearchParams({symbols:symbols.slice(i,i+100).join(','),feed});
     const response=await fetch('https://data.alpaca.markets/v1beta1/options/snapshots?'+params,{headers:{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY,'APCA-API-SECRET-KEY':process.env.ALPACA_API_SECRET},signal:AbortSignal.timeout(8000),cache:'no-store'});
     if(!response.ok)throw Error('Quote provider unavailable');
     const data=await response.json();Object.assign(snapshots,data.snapshots||{});
    }
   }catch{quoteError='Current option quotes are unavailable. Saved values, where present, are dated below.';}
  }
  return Response.json({positions:[...positions.values()].map(p=>optionPositionValues(p,snapshots[p.symbol])),feed,quoteError,checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){if(error instanceof Response)return error;return Response.json({error:'Option positions could not be loaded'},{status:500});}
}
