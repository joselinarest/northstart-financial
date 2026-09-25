import {workspace} from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{
    const {db,householdId}=await workspace(request);
    const health=await db.prepare("SELECT provider,last_success_at,last_failure_at,last_latency_ms,last_model,last_model_version,successes,failures,fallback_state,error_code,updated_at FROM ai_provider_health ORDER BY updated_at DESC").all();
    const models=await db.prepare("SELECT m.version,m.strategy,m.status,m.provider,m.provider_model,m.strategy_version,s.status strategy_status,m.released_at FROM ai_model_versions m LEFT JOIN ai_strategy_versions s ON s.version=m.strategy_version ORDER BY m.created_at DESC").all();
    const recent=await db.prepare("SELECT ticker,strategy,status,model_version,strategy_version,latency_ms,error_code,created_at FROM ai_decision_runs WHERE household_id=? ORDER BY created_at DESC LIMIT 10").bind(householdId).all();
    const decisions=await db.prepare("SELECT DISTINCT ON (r.account_id,r.ticker,r.strategy) r.account_id,COALESCE(a.nickname,a.name) account_name,r.ticker,r.strategy,r.status,r.output_json->>'action' action,r.output_json->>'interpretation' explanation,r.output_json->>'providerStatus' provider_status,r.output_json->'reasoningFactors' reasons,r.output_json->'contradictingEvidence' conflicts,r.data_timestamp,r.created_at FROM ai_decision_runs r JOIN accounts a ON a.id=r.account_id WHERE r.household_id=? AND a.hidden=0 ORDER BY r.account_id,r.ticker,r.strategy,r.created_at DESC").bind(householdId).all();
    const pending=await db.prepare("SELECT count(*)::int count FROM background_jobs WHERE household_id=? AND job_type='ACCOUNT_INTELLIGENCE_LOOP' AND status IN ('QUEUED','RUNNING')").bind(householdId).first();
    return Response.json({decisions:decisions.results,pending,configured:Boolean(process.env.OPENAI_API_KEY),health:health.results,models:models.results,recent:recent.results,fallback:"DETERMINISTIC_FACTS_ONLY",executionAllowed:false},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){if(error instanceof Response)return error;return Response.json({error:"AI health unavailable"},{status:500});}
}
