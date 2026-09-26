import {database} from '@/lib/db';
import {loadRuntimeSecrets} from '@/lib/runtime-secrets';
import {withWorkBudget} from '@/lib/work-budget';
import {runOptionsResearch} from '@/lib/options-research-engine';
import {reviewAccountOpportunity} from '@/lib/account-market-search';
/** Independent consumer: research cannot occupy the transaction delivery worker. */
export async function handler(){
 await loadRuntimeSecrets();const db=await database(),deadline=Date.now()+240000;let completed=0,failed=0;
 console.log('RESEARCH_BUILD',{commit:process.env.NORTHSTAR_WORKER_COMMIT});
 await db.prepare("INSERT INTO worker_heartbeats(worker_name,status,metadata_json,heartbeat_at) VALUES('aws-research-worker','RUNNING','{}',CURRENT_TIMESTAMP) ON CONFLICT(worker_name) DO UPDATE SET status='RUNNING',heartbeat_at=CURRENT_TIMESTAMP").run();
 while(Date.now()+55000<deadline){
 const job=await db.prepare(`WITH candidate AS (SELECT id FROM background_jobs WHERE job_type IN ('OPTIONS_ACCOUNT_REVIEW','ACCOUNT_OPPORTUNITY_REVIEW') AND attempts<6 AND available_at<=CURRENT_TIMESTAMP AND (status IN ('QUEUED','FAILED') OR (status='RUNNING' AND locked_at<CURRENT_TIMESTAMP-INTERVAL '6 minutes')) ORDER BY CASE WHEN payload_json->>'manual'='true' THEN 0 ELSE 1 END,CASE WHEN created_at<CURRENT_TIMESTAMP-INTERVAL '2 hours' THEN 0 ELSE 1 END,COALESCE((payload_json->>'priority')::numeric,0)+EXTRACT(EPOCH FROM(CURRENT_TIMESTAMP-created_at))/300 DESC,created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE background_jobs j SET status='RUNNING',attempts=j.attempts+1,locked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP FROM candidate c WHERE j.id=c.id RETURNING j.*`).first<Record<string,any>>();if(!job)break;
 const body={...job.payload_json,jobId:job.id};try{
 await withWorkBudget(50000,async()=>{if(job.job_type==='OPTIONS_ACCOUNT_REVIEW'){const result=await runOptionsResearch(db,job.household_id,body);if(result.retryable)throw Error('PARTIAL_RESEARCH_RETRY');}else{const result=await reviewAccountOpportunity(db,job.household_id,body);if(result.partial)throw Error('PARTIAL_RESEARCH_RETRY');}});
 await db.prepare("UPDATE background_jobs SET status='SUCCEEDED',completed_at=CURRENT_TIMESTAMP,error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(job.id).run();completed++;
 }catch(error){const message=String(error instanceof Error?error.message:'RESEARCH_FAILED').slice(0,200),delay=Math.min(3600,30*2**(Number(job.attempts)-1)),dead=Number(job.attempts)>=6;
 await db.prepare("UPDATE background_jobs SET status=?,error_code=?,available_at=CURRENT_TIMESTAMP+(?*INTERVAL '1 second'),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(dead?'DEAD':'FAILED',message,delay,job.id).run();
 if(job.job_type==='OPTIONS_ACCOUNT_REVIEW')await db.prepare("UPDATE options_research_stages SET status='TIMED_OUT',freshness='TIMED_OUT',last_error=?,next_retry_at=CASE WHEN ? THEN NULL ELSE CURRENT_TIMESTAMP+(?*INTERVAL '1 second') END,updated_at=CURRENT_TIMESTAMP WHERE account_id=? AND symbol=? AND status='REFRESHING'").bind(message,dead,delay,body.accountId,body.symbol).run();
 else{await db.prepare("UPDATE account_search_candidates SET status=CASE WHEN decision_json->>'symbol' IS NOT NULL THEN 'PARTIAL' ELSE 'FAILED' END,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE run_id=? AND symbol=?").bind(message,body.runId,body.symbol).run();await db.prepare("UPDATE account_search_runs SET last_error=?,counts_json=counts_json||jsonb_build_object('failed',(SELECT count(*) FROM account_search_candidates WHERE run_id=? AND status='FAILED')) WHERE id=?").bind(message,body.runId,body.runId).run();await db.prepare("UPDATE account_search_runs SET status='PARTIAL',stage='RETRY_RESEARCH',completed_at=CURRENT_TIMESTAMP WHERE id=? AND NOT EXISTS(SELECT 1 FROM account_search_candidates WHERE run_id=? AND status IN ('QUEUED','RUNNING'))").bind(body.runId,body.runId).run();}failed++;
 }
 }
 await db.prepare("UPDATE worker_heartbeats SET status='IDLE',jobs_succeeded=jobs_succeeded+?,jobs_failed=jobs_failed+?,metadata_json=?,heartbeat_at=CURRENT_TIMESTAMP WHERE worker_name='aws-research-worker'").bind(completed,failed,JSON.stringify({commit:process.env.NORTHSTAR_WORKER_COMMIT})).run();return {completed,failed};
}
