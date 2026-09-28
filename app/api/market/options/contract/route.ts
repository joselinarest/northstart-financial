import {workspace} from '@/lib/db';
import {selectChartContracts} from '@/lib/option-chart-link';
import {optionQuoteResearchFresh} from '@/lib/options-next-open';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const {db,householdId}=await workspace(request),q=new URL(request.url).searchParams,accountId=q.get('accountId')||'',symbol=(q.get('symbol')||'').toUpperCase(),contract=q.get('contract')||'';
 if(!/^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol)||contract&&!/^[A-Z0-9. -]{1,40}$/.test(contract))return Response.json({error:'Invalid stock or contract identifier'},{status:400});
 const account=await db.prepare("SELECT a.id,a.name FROM accounts a JOIN entities e ON e.id=a.entity_id WHERE a.id=? AND e.household_id=? AND a.hidden=0 AND a.type='investment'").bind(accountId,householdId).first<any>();if(!account)return Response.json({error:'Account not found'},{status:404});
 const row=await db.prepare('SELECT decision_json,updated_at FROM options_account_decisions WHERE account_id=? AND symbol=?').bind(accountId,symbol).first<any>();
 const contracts=selectChartContracts(row?.decision_json||{},symbol,contract).map(c=>({...c,accountId,stale:!optionQuoteResearchFresh(c.quoteAsOf||'')||!optionQuoteResearchFresh(c.underlyingAsOf||''),executionReady:c.executionReady===true&&optionQuoteResearchFresh(c.quoteAsOf||'')&&optionQuoteResearchFresh(c.underlyingAsOf||'')}));
 return Response.json({accountId,accountName:account.name,symbol,requestedContract:contract||null,contracts,updatedAt:row?.updated_at||null,holding:row?.decision_json?.holdingComparison||null,message:contracts.length?null:contract?'This exact contract is no longer in saved research. Refresh this stock to re-evaluate it; no different contract has been substituted.':'No saved CALL/PUT contract research for this account and stock. Refresh research to start.'},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){if(e instanceof Response)return e;return Response.json({error:'Saved contract research could not load. Retry preserves the selected contract.'},{status:503});}}
