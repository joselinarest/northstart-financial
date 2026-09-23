import {workspace} from "@/lib/db";
import {authoritativeRecommendation} from "@/lib/authoritative-recommendation";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function POST(request:Request){
  try{
    const {db,householdId}=await workspace(request),body=await request.json() as Record<string,unknown>;
    if(Object.keys(body).some(k=>!["accountId","ticker","refresh"].includes(k)))return Response.json({error:"Only accountId, ticker and refresh are accepted. Market/account facts are loaded server-side."},{status:400});
    if(typeof body.accountId!=="string"||typeof body.ticker!=="string"||!/^[A-Za-z0-9.-]{1,24}$/.test(body.ticker))return Response.json({error:"accountId and valid ticker are required"},{status:400});
    const result=await authoritativeRecommendation(db,{householdId,accountId:body.accountId,symbol:body.ticker.toUpperCase(),force:body.refresh===true});
    return Response.json({decision:result.checks.aiEvidence,deterministicFacts:result.checks,readOnly:true},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Decision engine unavailable"},{status:500});}
}
export async function GET(request:Request){
  try{const {db,householdId}=await workspace(request),url=new URL(request.url),accountId=url.searchParams.get("accountId"),ticker=url.searchParams.get("ticker");
    const result=await db.prepare("SELECT d.output_json,d.input_snapshot_json,d.status,c.expires_at FROM ai_current_decisions c JOIN ai_decision_runs d ON d.id=c.decision_id WHERE d.household_id=? AND c.account_id=? AND c.ticker=? AND c.expires_at>CURRENT_TIMESTAMP ORDER BY c.captured_at DESC LIMIT 1").bind(householdId,accountId,ticker?.toUpperCase()).first();
    return result?Response.json(result,{headers:{"Cache-Control":"private, no-store"}}):Response.json({status:"UNAVAILABLE",error:"No current account decision; request server-side analysis."},{status:404});
  }catch(error){if(error instanceof Response)return error;return Response.json({error:"Decision unavailable"},{status:500});}
}
