import{workspace}from"@/lib/db";
export const dynamic="force-dynamic";

export async function GET(request:Request){
 try{
  const{db,householdId}=await workspace(request),accountId=new URL(request.url).searchParams.get("accountId");
  if(!accountId)return Response.json({error:"accountId is required"},{status:400});
  const account=await db.prepare("SELECT a.id FROM accounts a JOIN entities e ON e.id=a.entity_id WHERE a.id=? AND e.household_id=? AND a.type='investment'").bind(accountId,householdId).first();
  if(!account)return Response.json({error:"Investment account not found"},{status:404});
  const[opportunities,changes,events,history,predictions]=await Promise.all([
   db.prepare("SELECT DISTINCT ON (r.security_id) r.id,s.ticker symbol,s.name,r.action,r.lifecycle,r.suggested_quantity::text quantity,r.entry_low_cents::text,r.entry_high_cents::text,r.confidence,r.reason,r.actionable,r.evidence_as_of,r.expires_at FROM recommendations r JOIN securities s ON s.id=r.security_id WHERE r.household_id=? AND r.account_id=? AND r.lifecycle IN ('MONITORING','TRIGGERED') AND r.expires_at>CURRENT_TIMESTAMP ORDER BY r.security_id,r.created_at DESC").bind(householdId,accountId).all(),
   db.prepare("SELECT id,severity,type,title,explanation,evidence_json,created_at FROM alerts WHERE household_id=? AND created_at>=CURRENT_TIMESTAMP-INTERVAL '30 days' AND (evidence_json IS NULL OR evidence_json NOT LIKE '%\"accountId\"%' OR evidence_json LIKE ?) ORDER BY created_at DESC LIMIT 8").bind(householdId,`%${accountId}%`).all(),
   db.prepare("SELECT p.id,p.action_type,p.lifecycle,p.priority,p.suggested_quantity::text quantity,p.entry_low_cents::text,p.entry_high_cents::text,p.expires_at,p.rationale,s.ticker symbol FROM planned_actions p LEFT JOIN securities s ON s.id=p.security_id WHERE p.household_id=? AND p.account_id=? AND p.lifecycle IN ('PROPOSED','MONITORING','READY','TRIGGERED') ORDER BY p.expires_at LIMIT 8").bind(householdId,accountId).all(),
   db.prepare("SELECT r.id,s.ticker symbol,r.action,r.lifecycle,r.suggested_quantity::text quantity,r.entry_low_cents::text,r.entry_high_cents::text,r.confidence,r.reason,r.evidence_as_of,r.created_at FROM recommendations r JOIN securities s ON s.id=r.security_id WHERE r.household_id=? AND r.account_id=? ORDER BY r.created_at DESC LIMIT 10").bind(householdId,accountId).all(),
   db.prepare("SELECT DISTINCT ON (p.security_id) p.id,s.ticker symbol,p.horizon,p.confidence,p.evidence_as_of,p.expires_at,pp.price_cents::text base_price_cents,pp.lower_cents::text lower_cents,pp.upper_cents::text upper_cents,pp.point_at FROM predictions p JOIN securities s ON s.id=p.security_id LEFT JOIN LATERAL (SELECT price_cents,lower_cents,upper_cents,point_at FROM prediction_points WHERE prediction_id=p.id AND scenario='BASE' ORDER BY point_at DESC LIMIT 1) pp ON TRUE WHERE p.household_id=? AND p.account_id=? AND p.expires_at>CURRENT_TIMESTAMP ORDER BY p.security_id,p.created_at DESC LIMIT 5").bind(householdId,accountId).all(),
  ]);
  const ranked=[...(opportunities.results as Array<Record<string,any>>)].sort((a,b)=>Number(b.actionable)-Number(a.actionable)||Number(b.confidence)-Number(a.confidence));
  return Response.json({opportunities:ranked.slice(0,5),changes:changes.results,events:events.results,history:history.results,predictions:predictions.results},{headers:{"Cache-Control":"private, no-store"}})
 }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Dashboard intelligence unavailable"},{status:500})}
}
