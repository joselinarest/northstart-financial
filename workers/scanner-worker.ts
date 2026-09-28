import {database} from '@/lib/db';
import {loadRuntimeSecrets} from '@/lib/runtime-secrets';
import {withWorkBudget} from '@/lib/work-budget';
import {runMarketDiscovery} from '@/lib/market-discovery-engine';
import {runOptionsDiscovery} from '@/lib/options-discovery';
import {advanceMarketRotation,scheduleScannerWork} from '@/lib/market-intelligence-queue';

/** Dedicated scanner; runs with no browser session and cannot occupy finance delivery. */
export async function handler(){
 await loadRuntimeSecrets();const db=await database(),deadline=Date.now()+240000;let completed=0,failed=0,lastKind='';
 await db.prepare("INSERT INTO worker_heartbeats(worker_name,status,metadata_json,heartbeat_at) VALUES('aws-scanner-worker','RUNNING',?::jsonb,CURRENT_TIMESTAMP) ON CONFLICT(worker_name) DO UPDATE SET status='RUNNING',metadata_json=EXCLUDED.metadata_json,heartbeat_at=CURRENT_TIMESTAMP").bind(JSON.stringify({commit:process.env.NORTHSTAR_WORKER_COMMIT})).run();
 while(Date.now()+60000<deadline && completed+failed<8){
  await advanceMarketRotation(db);await scheduleScannerWork(db);
  const job=await db.prepare(`WITH candidate AS (SELECT id FROM background_jobs WHERE job_type IN ('MARKET_DISCOVERY','OPTIONS_DISCOVERY') AND attempts<6 AND available_at<=CURRENT_TIMESTAMP AND (status IN ('QUEUED','FAILED') OR (status='RUNNING' AND locked_at<CURRENT_TIMESTAMP-INTERVAL '6 minutes')) ORDER BY CASE WHEN job_type=? THEN 1 ELSE 0 END,created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE background_jobs j SET status='RUNNING',attempts=j.attempts+1,locked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP FROM candidate c WHERE j.id=c.id RETURNING j.*`).bind(lastKind).first<any>();
  if(!job)break;lastKind=job.job_type;
  try{
   await withWorkBudget(55000,async()=>{if(job.job_type==='MARKET_DISCOVERY')await runMarketDiscovery(db,{researchLimit:2});else await runOptionsDiscovery(db);});
   await db.prepare("UPDATE background_jobs SET status='SUCCEEDED',error_code=NULL,completed_at=CURRENT_TIMESTAMP,locked_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(job.id).run();completed++;
  }catch(error){
   await db.prepare("UPDATE background_jobs SET status=?,error_code=?,available_at=CURRENT_TIMESTAMP+(?*INTERVAL '1 second'),locked_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(job.attempts>=6?'DEAD':'FAILED',String(error instanceof Error?error.message:'SCANNER_FAILED').slice(0,200),Math.min(3600,30*2**(job.attempts-1)),job.id).run();failed++;
  }
  await db.prepare("UPDATE worker_heartbeats SET heartbeat_at=CURRENT_TIMESTAMP WHERE worker_name='aws-scanner-worker'").run();
 }
 await advanceMarketRotation(db);
 await db.prepare("UPDATE worker_heartbeats SET status='IDLE',jobs_succeeded=jobs_succeeded+?,jobs_failed=jobs_failed+?,heartbeat_at=CURRENT_TIMESTAMP WHERE worker_name='aws-scanner-worker'").bind(completed,failed).run();
 return {completed,failed};
}
