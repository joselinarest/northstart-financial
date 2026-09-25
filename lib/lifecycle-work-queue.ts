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
  // Discovery must reach account research even when the symbol has never been owned.
  // Shared watchlists are research interests; the central engine still determines account fit.
  const candidateJobs=await db.prepare(`WITH interests AS (
    SELECT symbol,30 minutes,0 priority FROM market_watchlist WHERE household_id=?
    UNION ALL
    SELECT symbol,60 minutes,1 priority FROM market_discovery_candidates
    WHERE status IN ('RESEARCH_NOW','POSSIBLE_BUY_SETUP','DISCOVERED_TODAY')
      AND discovery_confidence>=75 AND source_as_of>CURRENT_TIMESTAMP-INTERVAL '2 days'
  ), ranked AS (
    SELECT symbol,MIN(minutes) minutes,MIN(priority) priority FROM interests GROUP BY symbol
  ), due AS (
    SELECT r.symbol,r.priority FROM ranked r
    WHERE NOT EXISTS(SELECT 1 FROM background_jobs b WHERE b.job_type='AI_EVENT_REVIEW'
      AND b.payload_json->>'accountId'=? AND b.payload_json->>'symbol'=r.symbol
      AND (b.status IN ('QUEUED','RUNNING','FAILED') OR b.created_at>CURRENT_TIMESTAMP-r.minutes*INTERVAL '1 minute'))
    ORDER BY r.priority,r.symbol LIMIT 2
  ) INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json)
    SELECT ?||':'||symbol,?,'AI_EVENT_REVIEW',?||':'||symbol,
      jsonb_build_object('accountId',?::text,'symbol',symbol,'reason','WATCHLIST_OR_DISCOVERY') FROM due
    ON CONFLICT(idempotency_key) DO NOTHING`).bind(householdId,accountId,crypto.randomUUID(),householdId,`candidate:${accountId}:${cycleKey}`,accountId).run();
return analysisJobs.meta.changes+candidateJobs.meta.changes;
}
