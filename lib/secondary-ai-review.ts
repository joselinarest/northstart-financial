import type {PostgresDatabase} from './db';
import {runCentralDecision} from './ai-decision-core';
import {aiServiceStatus} from './ai-service-status';
import type {DecisionInput,DecisionOutput} from './ai-investment-decision-engine';
import {id} from './db';
import type {AIProvider} from './ai-provider';

/** Optional commentary on an immutable core result. Never updates core decisions or recommendations. */
export async function reviewCoreDecision(db:PostgresDatabase,householdId:string,decisionId:string,aiProvider?:AIProvider){
  const service=await aiServiceStatus(db);if(service?.coolingDown)throw Error(service.code);
  const row=await db.prepare("SELECT * FROM ai_decision_runs WHERE id=? AND household_id=? AND provider='RULES' AND status='COMPLETED'").bind(decisionId,householdId).first<any>();
  if(!row)throw Error('CORE_DECISION_NOT_FOUND');
  const core=row.output_json as DecisionOutput;
  const input:DecisionInput={householdId,accountId:row.account_id,accountName:'Investment account',ticker:row.ticker,strategy:row.strategy,requestType:'SECONDARY_EXPLANATION',features:row.input_snapshot_json,evidence:row.evidence_json,dataTimestamp:new Date(row.data_timestamp).toISOString(),requiredFacts:[],candidates:(core.deterministicCandidates||[]).filter(c=>c.id===core.candidateId)};
  const result=await runCentralDecision(input,{db,persist:false,aiProvider});
  const code=result.providerStatus==='AVAILABLE'?null:result.providerStatus||'AI_PROVIDER_FAILED';
  const challenged=!code&&result.aiReviewPosition==='CHALLENGE'&&result.contradictingEvidence.length>0;
  await db.prepare("INSERT INTO secondary_ai_reviews(decision_id,status,analysis_json,error_code) VALUES(?,?,?::jsonb,?) ON CONFLICT(decision_id) DO UPDATE SET status=EXCLUDED.status,analysis_json=EXCLUDED.analysis_json,error_code=EXCLUDED.error_code,updated_at=CURRENT_TIMESTAMP").bind(decisionId,code?'FAILED':'COMPLETE',JSON.stringify({position:result.aiReviewPosition||'NEUTRAL',reconciliation:challenged?'CORE_RECHECK_REQUESTED':code?'CORE_ONLY_MODE':'CORE_DECISION_RETAINED',interpretation:result.interpretation,reasonsFor:result.reasoningFactors,reasonsAgainst:result.contradictingEvidence,whatWouldChange:result.whatWouldChange,modelVersion:result.modelVersion}),code).run();
  if(challenged)await db.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,'AI_EVENT_REVIEW',?,?::jsonb) ON CONFLICT DO NOTHING").bind(id('core_recheck'),householdId,'ai-challenge:'+decisionId,JSON.stringify({accountId:row.account_id,symbol:row.ticker,reason:'AI_CHALLENGE',coreDecisionId:decisionId})).run();
  if(!code||code.startsWith('AI_'))await db.prepare("INSERT INTO ai_provider_health(provider,last_success_at,last_failure_at,successes,failures,fallback_state,error_code) VALUES('OPENAI',CASE WHEN ? THEN CURRENT_TIMESTAMP END,CASE WHEN ? THEN CURRENT_TIMESTAMP END,?,?,?,?) ON CONFLICT(provider) DO UPDATE SET last_success_at=COALESCE(EXCLUDED.last_success_at,ai_provider_health.last_success_at),last_failure_at=COALESCE(EXCLUDED.last_failure_at,ai_provider_health.last_failure_at),successes=ai_provider_health.successes+EXCLUDED.successes,failures=ai_provider_health.failures+EXCLUDED.failures,fallback_state=EXCLUDED.fallback_state,error_code=EXCLUDED.error_code,updated_at=CURRENT_TIMESTAMP").bind(!code,Boolean(code),code?0:1,code?1:0,code?'CORE_RULES_ACTIVE':'NONE',code).run();
  if(code)throw Error(code);
  return result;
}
