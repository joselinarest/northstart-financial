import {workspace} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const {db,householdId}=await workspace(request),accountId=new URL(request.url).searchParams.get('accountId');
 if(!accountId)return Response.json({error:'Account required'},{status:400});
 const account=await db.prepare("SELECT a.id FROM accounts a JOIN entities e ON e.id=a.entity_id WHERE a.id=? AND e.household_id=? AND a.type='investment'").bind(accountId,householdId).first();
 if(!account)return Response.json({error:'Investment account not found'},{status:404});
 const [snapshots,transactions,holdings]=await Promise.all([
 db.prepare("SELECT DISTINCT ON ((captured_at AT TIME ZONE 'UTC')::date) captured_at,market_value_cents::text,cash_cents::text,cost_basis_cents::text,allocation_json,source_freshness_json FROM portfolio_snapshots WHERE account_id=? AND household_id=? ORDER BY (captured_at AT TIME ZONE 'UTC')::date DESC,captured_at DESC LIMIT 1500").bind(accountId,householdId).all(),
 db.prepare("SELECT t.id,t.trade_at,t.transaction_type,t.quantity::text,t.price_cents::text,t.amount_cents::text,s.ticker FROM investment_transactions t LEFT JOIN securities s ON s.id=t.security_id WHERE t.account_id=? AND t.household_id=? AND t.reverses_transaction_id IS NULL AND NOT EXISTS(SELECT 1 FROM investment_transactions r WHERE r.reverses_transaction_id=t.id) ORDER BY t.trade_at DESC LIMIT 1000").bind(accountId,householdId).all(),
 db.prepare("SELECT s.ticker,h.quantity::text,h.price_cents::text,h.cost_basis_cents::text FROM holdings h JOIN securities s ON s.id=h.security_id WHERE h.account_id=?").bind(accountId).all()
 ]);
 return Response.json({accountId,snapshots:snapshots.results.reverse(),transactions:transactions.results,holdings:holdings.results,historyLimit:1500,transactionLimit:1000},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){if(e instanceof Response)return e;return Response.json({error:'Account history could not be loaded'},{status:503})}}
