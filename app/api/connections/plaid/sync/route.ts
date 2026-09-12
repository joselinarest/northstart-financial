import {workspace,type DbStatement} from "@/lib/db";
import {decryptSecret} from "@/lib/crypto";
import {enqueueTransactionNotification,type TransactionEventType} from "@/lib/transaction-notifications";

const plaidHost=()=>process.env.PLAID_ENV==="production"?"https://production.plaid.com":process.env.PLAID_ENV==="development"?"https://development.plaid.com":"https://sandbox.plaid.com";
async function plaid(path:string,accessToken:string,extra:Record<string,unknown>={}){const response=await fetch(`${plaidHost()}${path}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:process.env.PLAID_CLIENT_ID,secret:process.env.PLAID_SECRET,access_token:accessToken,...extra})});if(!response.ok)throw new Error(`Plaid ${path} failed: ${response.status}`);return response.json() as Promise<Record<string,any>>}
async function optionalPlaid(path:string,accessToken:string){try{return await plaid(path,accessToken)}catch{return null}}
const cents=(value:unknown)=>Math.round(Number(value||0)*100);

export async function POST(request:Request){
 try{
  const{db,householdId,userId,role}=await workspace(request),body=await request.json() as{connectionId?:string};
  if(!body.connectionId)return Response.json({error:"connectionId required"},{status:400});
  const connection=await db.prepare("SELECT * FROM connections WHERE id=? AND household_id=? AND provider='plaid' AND status='active'").bind(body.connectionId,householdId).first<Record<string,string>>();
  if(!connection?.encrypted_access_token)return Response.json({error:"Connection not found"},{status:404});
  const connectionOwner=connection.connected_by_user_id||userId;
  if(connection.connected_by_user_id&&connectionOwner!==userId&&!['owner','co_owner','manager'].includes(role))return Response.json({error:"Only this connection's owner or a household manager can synchronize it"},{status:403});
  const entityId=`entity_${householdId}_${connectionOwner}_personal`,owner=await db.prepare("SELECT display_name FROM users WHERE id=?").bind(connectionOwner).first<{display_name?:string}>();
  await db.prepare("INSERT INTO entities(id,household_id,type,name) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(entityId,householdId,"personal",`${owner?.display_name||"Household member"} finances`).run();
  const token=await decryptSecret(connection.encrypted_access_token),accountData=await plaid("/accounts/get",token),accountWrites:DbStatement[]=[];
  const accountById=new Map<string,any>();
  for(const account of accountData.accounts||[]){accountById.set(account.account_id,account);accountWrites.push(db.prepare("INSERT INTO accounts(id,entity_id,connection_id,provider_account_id,name,official_name,type,subtype,currency,mask,current_balance_cents,available_balance_cents,credit_limit_cents,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=excluded.name,official_name=excluded.official_name,type=excluded.type,subtype=excluded.subtype,current_balance_cents=excluded.current_balance_cents,available_balance_cents=excluded.available_balance_cents,credit_limit_cents=excluded.credit_limit_cents,updated_at=CURRENT_TIMESTAMP").bind(`plaid_${account.account_id}`,entityId,body.connectionId,account.account_id,account.name,account.official_name||null,account.type,account.subtype||null,account.balances?.iso_currency_code||"USD",account.mask||null,cents(account.balances?.current),account.balances?.available==null?null:cents(account.balances.available),account.balances?.limit==null?null:cents(account.balances.limit)))}
  if(accountWrites.length)await db.batch(accountWrites);
  let cursor=connection.cursor||null,added=0,modified=0,removed=0,notificationsQueued=0,hasMore=true;
  while(hasMore){
   const data=await plaid("/transactions/sync",token,{cursor,count:250}),writes:DbStatement[]=[],events:Array<{transaction:any;type:TransactionEventType;previousPending?:boolean|null;riskScore:number;riskReasons:string[]}>=[];
   for(const transaction of[...(data.added||[]),...(data.modified||[])]){
    const transactionId=`plaid_txn_${transaction.transaction_id}`,existing=await db.prepare("SELECT pending,amount_cents,category,merchant,description FROM transactions WHERE id=?").bind(transactionId).first<Record<string,any>>();
    const priorPending=transaction.pending_transaction_id?await db.prepare("SELECT pending FROM transactions WHERE id=?").bind(`plaid_txn_${transaction.pending_transaction_id}`).first<{pending:number|boolean}>():null;
    let type:TransactionEventType=existing?"UPDATED":"IMPORTED";
    if(!transaction.pending&&(Boolean(existing?.pending)||Boolean(priorPending?.pending)))type="PENDING_POSTED";
    const amount=cents(Math.abs(transaction.amount||0)),reasons:string[]=[];let riskScore=0;
    if(amount>=100000){riskScore+=25;reasons.push("Large transaction of at least $1,000")}
    if(!existing&&amount>=25000){riskScore+=18;reasons.push("New transaction over $250")}
    if(/foreign|international|currency conversion/i.test(`${transaction.name||""} ${transaction.personal_finance_category?.detailed||""}`)){riskScore+=20;reasons.push("Possible foreign or international transaction")}
    if(riskScore>=45)type="SUSPICIOUS";
    writes.push(db.prepare("INSERT INTO transactions(id,account_id,provider_transaction_id,posted_at,authorized_at,merchant,description,amount_cents,direction,category,subcategory,entity_id,pending,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET posted_at=excluded.posted_at,merchant=excluded.merchant,description=excluded.description,amount_cents=excluded.amount_cents,direction=excluded.direction,category=excluded.category,subcategory=excluded.subcategory,pending=excluded.pending,updated_at=CURRENT_TIMESTAMP").bind(transactionId,`plaid_${transaction.account_id}`,transaction.transaction_id,transaction.datetime||transaction.date,transaction.authorized_datetime||transaction.authorized_date||null,transaction.merchant_name||null,transaction.name,amount,transaction.amount<0?"inflow":"outflow",transaction.personal_finance_category?.primary||transaction.category?.[0]||"Uncategorized",transaction.personal_finance_category?.detailed||transaction.category?.[1]||null,entityId,transaction.pending?1:0));
    events.push({transaction,type,previousPending:existing?.pending==null?null:Boolean(existing.pending),riskScore,riskReasons:reasons});
   }
   for(const transaction of data.removed||[])writes.push(db.prepare("DELETE FROM transactions WHERE id=? AND entity_id=?").bind(`plaid_txn_${transaction.transaction_id}`,entityId));
   if(writes.length)await db.batch(writes);
   for(const event of events){const transaction=event.transaction,account=accountById.get(transaction.account_id)||{};const result=await enqueueTransactionNotification(db,{householdId,accountId:`plaid_${transaction.account_id}`,transactionId:`plaid_txn_${transaction.transaction_id}`,providerTransactionId:transaction.transaction_id,eventType:event.type,institution:connection.institution_name,accountName:account.name||account.official_name||"Linked account",mask:account.mask,merchant:transaction.merchant_name,description:transaction.name||"Transaction",amountCents:cents(Math.abs(transaction.amount||0)),currency:transaction.iso_currency_code||account.balances?.iso_currency_code||"USD",postedAt:transaction.datetime||transaction.date,category:transaction.personal_finance_category?.primary||transaction.category?.[0]||"Uncategorized",direction:transaction.amount<0?"inflow":"outflow",pending:Boolean(transaction.pending),previousPending:event.previousPending,riskScore:event.riskScore,riskReasons:event.riskReasons,foreign:/foreign|international|currency conversion/i.test(`${transaction.name||""} ${transaction.personal_finance_category?.detailed||""}`)});notificationsQueued+=result.queued}
   added+=(data.added||[]).length;modified+=(data.modified||[]).length;removed+=(data.removed||[]).length;cursor=data.next_cursor;hasMore=Boolean(data.has_more);
  }
  const investments=await optionalPlaid("/investments/holdings/get",token);let holdingCount=0;
  if(investments){const writes:DbStatement[]=[];for(const security of investments.securities||[])writes.push(db.prepare("INSERT INTO securities(id,ticker,name,type,currency) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ticker=excluded.ticker,name=excluded.name,type=excluded.type,currency=excluded.currency").bind(`plaid_sec_${security.security_id}`,security.ticker_symbol||null,security.name||"Unknown security",security.type||null,security.iso_currency_code||"USD"));for(const holding of investments.holdings||[]){holdingCount++;writes.push(db.prepare("INSERT INTO holdings(id,account_id,security_id,quantity,cost_basis_cents,price_cents,price_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id,security_id) DO UPDATE SET quantity=excluded.quantity,cost_basis_cents=excluded.cost_basis_cents,price_cents=excluded.price_cents,price_at=excluded.price_at").bind(`plaid_hold_${holding.account_id}_${holding.security_id}`,`plaid_${holding.account_id}`,`plaid_sec_${holding.security_id}`,Number(holding.quantity||0),holding.cost_basis==null?null:cents(holding.cost_basis),cents(holding.institution_price),holding.institution_price_as_of||new Date().toISOString()))}if(writes.length)await db.batch(writes)}
  await db.prepare("UPDATE connections SET cursor=?,last_synced_at=CURRENT_TIMESTAMP,error_code=NULL WHERE id=? AND household_id=?").bind(cursor,body.connectionId,householdId).run();
  return Response.json({status:"synced",accounts:(accountData.accounts||[]).length,holdings:holdingCount,added,modified,removed,notificationsQueued});
 }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Sync failed"},{status:502})}
}
