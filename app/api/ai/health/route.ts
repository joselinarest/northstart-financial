import {workspace} from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{
    const {db,householdId}=await workspace(request);
    const health=await db.prepare("SELECT provider,last_success_at,last_failure_at,last_latency_ms,last_model,last_model_version,successes,failures,fallback_state,error_code,updated_at FROM ai_provider_health ORDER BY updated_at DESC").all();
    const models=await db.prepare("SELECT m.version,m.strategy,m.status,m.provider,m.provider_model,m.strategy_version,s.status strategy_status,m.released_at FROM ai_model_versions m LEFT JOIN ai_strategy_versions s ON s.version=m.strategy_version ORDER BY m.created_at DESC").all();
    const recent=await db.prepare("SELECT ticker,strategy,status,model_version,strategy_version,latency_ms,error_code,created_at FROM ai_decision_runs WHERE household_id=? ORDER BY created_at DESC LIMIT 10").bind(householdId).all();
    return Response.json({configured:Boolean(process.env.OPENAI_API_KEY),health:health.results,models:models.results,recent:recent.results,fallback:"DETERMINISTIC_FACTS_ONLY",executionAllowed:false},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){if(error instanceof Response)return error;return Response.json({error:"AI health unavailable"},{status:500});}
}
