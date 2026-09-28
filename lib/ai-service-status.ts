import type {PostgresDatabase} from './db';

export function aiRetrySeconds(code:string){
  return ['AI_QUOTA_EXHAUSTED','AI_NOT_CONFIGURED','AI_DISABLED'].includes(code)?900:code==='AI_RATE_LIMITED'||code==='AI_HTTP_429'?60:30;
}
export function aiFailureMessage(code:string){
  if(code==='AI_QUOTA_EXHAUSTED')return 'Optional AI review is paused because API credits are exhausted. The rules-based decision engine and market research continue independently.';
  if(code==='AI_RATE_LIMITED'||code==='AI_HTTP_429')return 'Optional AI review is rate limited and will retry automatically. Core account decisions continue independently.';
  return 'Optional AI commentary could not complete. The rules-based engine continues to evaluate market evidence and account risk.';
}
export async function aiServiceStatus(db:PostgresDatabase,provider='OPENAI',now=Date.now()){
  if(provider==='OPENAI'&&process.env.AI_REVIEW_ENABLED==='false')return {code:'AI_DISABLED',state:'AI_ERROR',mode:'CORE_ONLY_MODE',message:'Core Engine Active · optional AI review is disabled.',retryAt:null,coolingDown:false};
  if(provider==='OPENAI'&&!process.env.OPENAI_API_KEY)return {code:'AI_NOT_CONFIGURED',state:'AI_ERROR',mode:'CORE_ONLY_MODE',message:'Core Engine Active · optional AI review is not configured.',retryAt:null,coolingDown:false};
  const row=await db.prepare('SELECT error_code,last_failure_at,last_success_at FROM ai_provider_health WHERE provider=?').bind(provider).first<{error_code:string|null;last_failure_at:string;last_success_at:string|null}>();
  if(!row?.error_code||!row.last_failure_at||Date.parse(row.last_success_at||'')>=Date.parse(row.last_failure_at))return null;
  const retryAt=new Date(Date.parse(row.last_failure_at)+aiRetrySeconds(row.error_code)*1000).toISOString();
  return {code:row.error_code,state:row.error_code==='AI_QUOTA_EXHAUSTED'?'AI_CREDITS_EXHAUSTED':['AI_RATE_LIMITED','AI_HTTP_429'].includes(row.error_code)?'AI_RATE_LIMITED':'AI_ERROR',mode:'CORE_ONLY_MODE',message:aiFailureMessage(row.error_code),retryAt,coolingDown:Date.parse(retryAt)>now};
}

/** Never mark an attempted provider decision as a successful research job. */
export function requireCompletedDecision(checks:Record<string,any>){
  const status=checks.aiEvidence?.providerStatus;
  if(status!=='AVAILABLE')throw new Error(typeof status==='string'&&/^[A-Z0-9_]+$/.test(status)?status:'CENTRAL_DECISION_UNAVAILABLE');
}
