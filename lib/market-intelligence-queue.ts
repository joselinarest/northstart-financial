import {id,type PostgresDatabase} from '@/lib/db';

/** A rotation is an auditable attempt at every member of a fixed universe snapshot.
 * Unavailable/failed work is reported separately, never counted as successful research. */
export async function advanceMarketRotation(db:PostgresDatabase){
 return db.transaction(async tx=>{
  await tx.prepare("INSERT INTO discovery_control(id) VALUES('rotation-lock') ON CONFLICT DO NOTHING").run();
  await tx.prepare("SELECT id FROM discovery_control WHERE id='rotation-lock' FOR UPDATE").first();
  let rotation=await tx.prepare('SELECT * FROM market_intelligence_rotations WHERE completed_at IS NULL FOR UPDATE').first<any>();
  if(rotation){
   const counts=await rotationCounts(tx,rotation.id,rotation.started_at);
   await tx.prepare('UPDATE market_intelligence_rotations SET counts_json=?::jsonb,completed_at=CASE WHEN ?=0 THEN CURRENT_TIMESTAMP END WHERE id=?').bind(JSON.stringify(counts),counts.pending,rotation.id).run();
   if(counts.pending)return rotation.id;
  }
  const universe=await tx.prepare('SELECT count(*)::int n FROM discovery_queue WHERE active').first<any>();
  if(!universe?.n)return null;
  const rotationId=id('rotation');
  await tx.prepare('INSERT INTO market_intelligence_rotations(id) VALUES(?)').bind(rotationId).run();
  await tx.prepare('INSERT INTO market_intelligence_rotation_symbols(rotation_id,symbol) SELECT ?,symbol FROM discovery_queue WHERE active').bind(rotationId).run();
  // Make every member eligible once per rotation. The claim reserves half its
  // capacity for oldest work, so priority lanes cannot starve this snapshot.
  await tx.prepare('UPDATE discovery_queue SET next_screen_at=LEAST(next_screen_at,CURRENT_TIMESTAMP) WHERE active').run();
  return rotationId;
 });
}
async function rotationCounts(db:PostgresDatabase,rotationId:string,startedAt:string){
 return (await db.prepare(`SELECT count(*)::int universe,
 count(*) FILTER(WHERE d.last_attempt_at>=?::timestamptz)::int attempted,
 count(*) FILTER(WHERE d.last_screened_at>=?::timestamptz AND d.seed_json IS NOT NULL)::int screened,
 count(*) FILTER(WHERE d.active AND (d.last_attempt_at IS NULL OR d.last_attempt_at<?::timestamptz))::int pending,
 count(*) FILTER(WHERE d.last_attempt_at>=?::timestamptz AND d.seed_json IS NULL)::int unavailable,
 count(*) FILTER(WHERE d.last_attempt_at>=?::timestamptz AND d.screen_error IS NOT NULL)::int failed, count(*) FILTER(WHERE d.active IS DISTINCT FROM TRUE)::int retired
 FROM market_intelligence_rotation_symbols m LEFT JOIN discovery_queue d ON d.symbol=m.symbol WHERE m.rotation_id=?`).bind(startedAt,startedAt,startedAt,startedAt,startedAt,rotationId).first<any>())!;
}
export async function scheduleScannerWork(db:PostgresDatabase){
 for(const kind of ['MARKET_DISCOVERY','OPTIONS_DISCOVERY']){
  await db.prepare(`INSERT INTO background_jobs(id,job_type,idempotency_key,payload_json)
  SELECT ?,?,?, '{}'::jsonb WHERE NOT EXISTS(SELECT 1 FROM background_jobs WHERE job_type=? AND status IN ('QUEUED','RUNNING','FAILED') AND attempts<6)
  ON CONFLICT DO NOTHING`).bind(id('scan'),kind,id('continuous'),kind).run();
 }
}
export async function intelligenceProof(db:PostgresDatabase,accountId:string){
 const rotation=await db.prepare('SELECT * FROM market_intelligence_rotations WHERE completed_at IS NULL').first<any>();
 const last=await db.prepare('SELECT completed_at,counts_json FROM market_intelligence_rotations WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1').first<any>();
 const counts=await db.prepare(`SELECT count(*)::int universe,
 count(*) FILTER(WHERE last_screened_at>=date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York')::int screened_today,
 count(*) FILTER(WHERE last_researched_at IS NOT NULL)::int deep_researched,
 count(*) FILTER(WHERE next_screen_at<=CURRENT_TIMESTAMP)::int queued,
 count(*) FILTER(WHERE retry_count>0 OR screen_error IS NOT NULL)::int failed,
 count(*) FILTER(WHERE seed_json IS NULL)::int unavailable,
 count(*) FILTER(WHERE last_screened_at<CURRENT_TIMESTAMP-INTERVAL '1 day')::int stale,
 count(*) FILTER(WHERE stage='REJECTED')::int rejected,
 count(*) FILTER(WHERE stage='NEAR_MISS')::int near_miss,
 count(*) FILTER(WHERE priority>=100)::int priority_lane
 FROM discovery_queue WHERE active`).first<any>();
 const account=await db.prepare(`SELECT count(DISTINCT c.symbol)::int account_scored,max(c.updated_at) latest_account_research
 FROM account_search_candidates c JOIN account_search_runs r ON r.id=c.run_id
 WHERE r.account_id=? AND c.decision_json->>'symbol' IS NOT NULL`).bind(accountId).first<any>();
 const options=await db.prepare(`SELECT count(*) FILTER(WHERE o.payload_json->>'sampledContracts' IS NOT NULL)::int option_chain_analyzed,
 count(*) FILTER(WHERE o.stage='CHAIN_QUALIFIED')::int chain_qualified FROM options_discovery o JOIN discovery_queue d USING(symbol) WHERE d.active`).first<any>();
 const groups=(await db.prepare("SELECT COALESCE(sector,'Unknown') sector,COALESCE(cap_bucket,'UNKNOWN') cap_bucket,count(*)::int count FROM market_discovery_candidates c JOIN discovery_queue d USING(symbol) WHERE d.active GROUP BY 1,2 ORDER BY 3 DESC").all<any>()).results;
 const workers=(await db.prepare("SELECT worker_name,status,heartbeat_at,metadata_json->>'commit' commit FROM worker_heartbeats WHERE worker_name IN ('aws-scanner-worker','aws-research-worker')").all<any>()).results;
 return {counts:{...counts,...account,...options},rotation:rotation?{id:rotation.id,startedAt:rotation.started_at,...await rotationCounts(db,rotation.id,rotation.started_at)}:null,lastCompletedRotation:last,groups,workers};
}
