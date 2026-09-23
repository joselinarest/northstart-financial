import type {PostgresDatabase} from "@/lib/db";
export async function queueLifecycleTickers(db:PostgresDatabase,householdId:string,accountId:string,cycleKey:string){
  const analysisJobs=await db.prepare(`INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json)
    SELECT ?||':'||sec.id,?,'AI_EVENT_REVIEW',?||':'||sec.id,jsonb_build_object('accountId',?::text,'symbol',sec.ticker,'reason','SCHEDULED_LIFECYCLE')
    FROM securities sec WHERE sec.ticker IS NOT NULL AND sec.id IN (
      SELECT security_id FROM holdings WHERE account_id=? AND quantity>0 UNION
      SELECT security_id FROM position_states WHERE account_id=? UNION
      SELECT security_id FROM investment_transactions WHERE account_id=? AND transaction_type='SELL')
    AND NOT EXISTS(SELECT 1 FROM background_jobs b WHERE b.job_type='AI_EVENT_REVIEW' AND b.status IN ('QUEUED','RUNNING','FAILED') AND b.payload_json->>'accountId'=? AND b.payload_json->>'symbol'=sec.ticker)
    ON CONFLICT(idempotency_key) DO NOTHING`).bind(crypto.randomUUID(),householdId,`lifecycle:${accountId}:${cycleKey}`,accountId,accountId,accountId,accountId,accountId).run();
return analysisJobs.meta.changes;
}
