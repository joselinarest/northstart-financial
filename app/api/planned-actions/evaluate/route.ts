import{workspace,id}from"@/lib/db";
import{marketDataProvider}from"@/lib/providers/alpaca-market-data";
import{MarketProviderError}from"@/lib/providers/market-data";

export const dynamic="force-dynamic";
const buyActions=new Set(["BUY_NOW","WAIT_FOR_PRICE","BUY_ON_CONFIRMATION"]);

export async function POST(request:Request){
 try{
  const{db,householdId,userId}=await workspace(request),body=await request.json().catch(()=>({}))as{accountId?:string},clauses=["p.household_id=?","p.lifecycle IN ('PROPOSED','MONITORING','READY')"],values:unknown[]=[householdId];
  if(body.accountId){clauses.push("p.account_id=?");values.push(body.accountId)}
  const result=await db.prepare(`SELECT p.id,p.account_id,p.action_type,p.lifecycle,p.entry_low_cents::text,p.entry_high_cents::text,p.invalidation_cents::text,p.expires_at,s.ticker symbol,r.lifecycle recommendation_lifecycle,r.actionable recommendation_actionable,t.state thesis_state FROM planned_actions p LEFT JOIN securities s ON s.id=p.security_id LEFT JOIN recommendations r ON r.id=p.recommendation_id LEFT JOIN investment_theses t ON t.account_id=p.account_id AND t.security_id=p.security_id WHERE ${clauses.join(" AND ")} ORDER BY p.created_at`).bind(...values).all<any>(),now=new Date(),expired=result.results.filter(row=>Date.parse(row.expires_at)<=now.getTime()),active=result.results.filter(row=>row.symbol&&Date.parse(row.expires_at)>now.getTime()),symbols=[...new Set(active.map(row=>String(row.symbol)))],changes=[]as Array<Record<string,unknown>>;
  let quoteData:Awaited<ReturnType<ReturnType<typeof marketDataProvider>["getQuotes"]>>|null=null;
  if(symbols.length)quoteData=await marketDataProvider().getQuotes(symbols);
  await db.transaction(async tx=>{
   for(const row of expired){await tx.prepare("UPDATE planned_actions SET lifecycle='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND lifecycle IN ('PROPOSED','MONITORING','READY')").bind(row.id).run();changes.push({id:row.id,symbol:row.symbol,from:row.lifecycle,to:"EXPIRED",reason:"The monitoring window ended."})}
   for(const row of active){
    const quote=quoteData?.quotes[String(row.symbol)],price=quote?.ask||quote?.last;
    if(row.thesis_state==="BROKEN"||["INVALIDATED","CANCELLED","EXPIRED"].includes(String(row.recommendation_lifecycle))){await tx.prepare("UPDATE planned_actions SET lifecycle='INVALIDATED',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();changes.push({id:row.id,symbol:row.symbol,from:row.lifecycle,to:"INVALIDATED",reason:row.thesis_state==="BROKEN"?"The investment thesis is broken.":"The supporting recommendation is no longer valid."});continue}
    if(!buyActions.has(row.action_type)||!price||quote?.freshness!=="FRESH")continue;
    const cents=BigInt(Math.round(price*100)),low=/^\d+$/.test(String(row.entry_low_cents))?BigInt(row.entry_low_cents):null,high=/^\d+$/.test(String(row.entry_high_cents))?BigInt(row.entry_high_cents):null,invalidation=/^\d+$/.test(String(row.invalidation_cents))?BigInt(row.invalidation_cents):null;
    if(invalidation!==null&&cents<=invalidation){await tx.prepare("UPDATE planned_actions SET lifecycle='INVALIDATED',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();changes.push({id:row.id,symbol:row.symbol,from:row.lifecycle,to:"INVALIDATED",reason:"Fresh price crossed the stored invalidation level."});continue}
    const inRange=low!==null&&high!==null&&cents>=low&&cents<=high,requirementsPass=row.recommendation_actionable==null||row.recommendation_actionable===true;
    if(inRange&&requirementsPass&&row.lifecycle!=="READY"){
     const alertId=`alert_planned_action_ready_${row.id}`;await tx.prepare("UPDATE planned_actions SET lifecycle='READY',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();await tx.prepare("INSERT INTO alerts(id,household_id,severity,type,title,explanation,evidence_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(alertId,householdId,"high","planned_action_ready",`${row.symbol} planned action is ready`,`Fresh price entered the planned range and stored evidence remains valid. Verify the live quote and decide manually; Northstar placed no order.`,JSON.stringify({plannedActionId:row.id,accountId:row.account_id,symbol:row.symbol,currentPriceCents:cents.toString(),freshness:quote.freshness,source:quote.source,asOf:quote.timestamp})).run();await tx.prepare("INSERT INTO alert_deliveries(id,alert_id,user_id,channel,status) VALUES(?,?,?,'IN_APP','PENDING') ON CONFLICT(alert_id,user_id,channel) DO NOTHING").bind(id("alert_delivery"),alertId,userId).run();changes.push({id:row.id,symbol:row.symbol,from:row.lifecycle,to:"READY",reason:"Fresh price entered the stored range."})
    }else if(!inRange&&row.lifecycle==="READY"){await tx.prepare("UPDATE planned_actions SET lifecycle='MONITORING',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();changes.push({id:row.id,symbol:row.symbol,from:"READY",to:"MONITORING",reason:"Price left the planned range before manual confirmation."})}
   }
  });
  return Response.json({evaluated:result.results.length,quoteFeed:quoteData?.feed||null,quoteAsOf:quoteData?.asOf||null,changes},{headers:{"Cache-Control":"private, no-store"}})
 }catch(error){if(error instanceof Response)return error;const known=error instanceof MarketProviderError;return Response.json({error:error instanceof Error?error.message:"Planned actions could not be evaluated"},{status:known?error.status:400})}
}
