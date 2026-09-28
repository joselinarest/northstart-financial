import {id,type PostgresDatabase} from './db';
import {sessionWindow} from './research-market-freshness';
import {exchangeDay} from './exchange-calendar';
import {barsFor,technicalSeed} from './market-discovery-engine';
import {screeningPolicy} from './market-scan-policy';
import {nextSessionContext,eventHypotheses,materialContextChange} from './next-session-context';
import {startAccountSearch} from './account-market-search';
import {queueOptionResearch} from './options-research-queue';
type Row=Record<string,any>;

export async function scheduleNextSession(db:PostgresDatabase,now=Date.now(),manual=false){
 const window=sessionWindow(now);if(!window.supported||!window.close)return null;
 const closeAt=new Date(window.close).toISOString(),cycleId='next-session:'+closeAt;
 await db.transaction(async tx=>{
  await tx.prepare('INSERT INTO next_session_cycles(id,close_at) VALUES(?,?) ON CONFLICT DO NOTHING').bind(cycleId,closeAt).run();
  await tx.prepare('SELECT id FROM next_session_cycles WHERE id=? FOR UPDATE').bind(cycleId).first();
  await tx.prepare("INSERT INTO next_session_symbols(cycle_id,symbol,sector,cap_bucket) SELECT ?,d.symbol,c.sector,c.cap_bucket FROM discovery_queue d LEFT JOIN market_discovery_candidates c USING(symbol) WHERE d.active ON CONFLICT DO NOTHING").bind(cycleId).run();
  await tx.prepare("INSERT INTO next_session_accounts(cycle_id,account_id) SELECT ?,a.id FROM accounts a WHERE a.type='investment' AND a.hidden=0 ON CONFLICT DO NOTHING").bind(cycleId).run();
  const active=await tx.prepare("SELECT id,status FROM background_jobs WHERE job_type='NEXT_SESSION_RESEARCH' AND payload_json->>'cycleId'=? AND status IN ('QUEUED','RUNNING','FAILED') AND attempts<6").bind(cycleId).first<Row>();
  if(active){if(manual&&active.status!=='RUNNING')await tx.prepare("UPDATE background_jobs SET available_at=CURRENT_TIMESTAMP WHERE id=?").bind(active.id).run();return;}
  const cycle=await tx.prepare('SELECT status,context_at FROM next_session_cycles WHERE id=?').bind(cycleId).first<Row>();
  const age=cycle?.context_at?now-Date.parse(cycle.context_at):Infinity;
  if(!manual&&(cycle?.status==='FAILED'||cycle?.status==='SCREENED'&&age<15*60000))return;
  const jobId=id('next_session');await tx.prepare("INSERT INTO background_jobs(id,job_type,idempotency_key,payload_json) VALUES(?,'NEXT_SESSION_RESEARCH',?,?::jsonb)").bind(jobId,jobId,JSON.stringify({cycleId,manual})).run();
 });return cycleId;
}

async function notifyRevision(db:PostgresDatabase,cycleId:string,revision:number,changes:string[]){
 const households=(await db.prepare("SELECT DISTINCT e.household_id FROM next_session_accounts n JOIN accounts a ON a.id=n.account_id JOIN entities e ON e.id=a.entity_id WHERE n.cycle_id=?").bind(cycleId).all<Row>()).results;
 for(const {household_id} of households){const alertId=`next-session:${cycleId}:${revision}:${household_id}`;
  await db.prepare("INSERT INTO alerts(id,household_id,severity,type,title,explanation,evidence_json) VALUES(?,?,'important','market_intelligence','Next-session evidence changed — plans require revalidation',?,?::jsonb) ON CONFLICT DO NOTHING").bind(alertId,household_id,changes.join('; '),JSON.stringify({cycleId,revision,changes,deepLink:'/workspace/trading',state:'REVALIDATION_REQUIRED'})).run();
  // Normal notification indexing owns recipient preferences, quiet hours and delivery.
  await db.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,'NOTIFICATION_DELIVERY',?,'{}') ON CONFLICT DO NOTHING").bind(id('delivery'),household_id,alertId).run();
 }
}

export async function runNextSessionBatch(db:PostgresDatabase,cycleId:string){
 const cycle=await db.prepare('SELECT * FROM next_session_cycles WHERE id=?').bind(cycleId).first<Row>();if(!cycle)throw Error('NEXT_SESSION_NOT_FOUND');
 const closeAt=new Date(cycle.close_at).toISOString();
 if(!cycle.context_at||Date.now()-Date.parse(cycle.context_at)>=15*60000){
  await db.prepare("UPDATE next_session_cycles SET status='RUNNING',stage='MACRO_REGIME',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(cycleId).run();
  const context=await nextSessionContext(db,closeAt),changes=cycle.context_at?materialContextChange(cycle.context_json,context):[];
  const universe=(await db.prepare('SELECT symbol,sector FROM next_session_symbols WHERE cycle_id=?').bind(cycleId).all<Row>()).results;
  const edges=eventHypotheses(context.events,universe);
  await db.transaction(async tx=>{
   await tx.prepare('DELETE FROM next_session_edges WHERE cycle_id=?').bind(cycleId).run();
   for(const edge of edges)await tx.prepare('INSERT INTO next_session_edges(cycle_id,event_id,symbol,evidence_json) VALUES(?,?,?,?::jsonb) ON CONFLICT DO NOTHING').bind(cycleId,edge.eventId,edge.symbol,JSON.stringify(edge)).run();
   await tx.prepare('UPDATE next_session_cycles SET context_json=?::jsonb,context_at=CURRENT_TIMESTAMP,revision=revision+?,stage=\'FULL_MARKET_SCAN\',last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(JSON.stringify({...context,materialChanges:changes}),changes.length?1:0,cycleId).run();
   await tx.prepare("UPDATE next_session_symbols s SET priority=GREATEST(priority,10) WHERE cycle_id=? AND EXISTS(SELECT 1 FROM next_session_edges e WHERE e.cycle_id=s.cycle_id AND e.symbol=s.symbol)").bind(cycleId).run();
   if(changes.length)await tx.prepare("UPDATE next_session_accounts SET status='REVALIDATION_REQUIRED',updated_at=CURRENT_TIMESTAMP WHERE cycle_id=?").bind(cycleId).run();
  });if(changes.length)await notifyRevision(db,cycleId,Number(cycle.revision)+1,changes);
  return {more:true};
 }
 const batch=(await db.prepare("SELECT n.*,d.asset_json FROM next_session_symbols n JOIN discovery_queue d USING(symbol) WHERE n.cycle_id=? AND n.status='QUEUED' ORDER BY n.priority DESC,n.symbol LIMIT 100").bind(cycleId).all<Row>()).results;
 if(batch.length){
  const history=await barsFor(batch.map(r=>r.symbol),{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY||'','APCA-API-SECRET-KEY':process.env.ALPACA_API_SECRET||''});
  await db.transaction(async tx=>{for(const row of batch){
   const bars=(history[row.symbol]||[]).filter(b=>exchangeDay(b.t).date<=exchangeDay(closeAt).date),last=bars.at(-1),seed=technicalSeed(row.asset_json,bars,null),policy=screeningPolicy(0,seed);
   const stale=!!last&&exchangeDay(last.t).date!==exchangeDay(closeAt).date;
   const status=!seed?'UNAVAILABLE':stale?'STALE':policy.stage==='RESEARCH_PENDING'?'SCREENED':'REJECTED';
   const reason=!seed?'Insufficient completed price history':stale?'Latest daily bar predates this close':policy.reason;
   await tx.prepare('UPDATE next_session_symbols SET status=?,score=?,seed_json=?::jsonb,reason=?,screened_at=CURRENT_TIMESTAMP WHERE cycle_id=? AND symbol=?').bind(status,seed?.seed??null,JSON.stringify(seed?{seed,priceAsOf:last!.t,lastRegularClose:last!.c}:{}),reason,cycleId,row.symbol).run();
   if(seed&&!stale)await tx.prepare("UPDATE discovery_queue SET seed_json=?::jsonb,last_screened_at=CURRENT_TIMESTAMP,stage=?,next_research_at=CURRENT_TIMESTAMP WHERE symbol=?").bind(JSON.stringify({seed,priceAsOf:last!.t}),policy.stage,row.symbol).run();
  }});
  const counts=await nextSessionCounts(db,cycleId);
  await db.prepare("UPDATE next_session_cycles SET status='RUNNING',stage='FULL_MARKET_SCAN',counts_json=?::jsonb,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(counts),cycleId).run();return {more:true};
 }
 const counts=await nextSessionCounts(db,cycleId);if(!counts?.universe)throw Error('SUPPORTED_UNIVERSE_NOT_LOADED');
 const pending=(await db.prepare("SELECT n.*,e.household_id FROM next_session_accounts n JOIN accounts a ON a.id=n.account_id JOIN entities e ON e.id=a.entity_id JOIN next_session_cycles c ON c.id=n.cycle_id WHERE n.cycle_id=? AND (n.revision<c.revision OR n.run_id IS NULL) ORDER BY n.updated_at LIMIT 1").bind(cycleId).all<Row>()).results;
 if(pending.length){const account=pending[0],run=await startAccountSearch(db,account.household_id,account.account_id,true,cycleId);
  await db.prepare("UPDATE next_session_accounts SET run_id=?,revision=?,status='DEEP_RESEARCH',updated_at=CURRENT_TIMESTAMP WHERE cycle_id=? AND account_id=?").bind(run.runId,cycle.revision,cycleId,account.account_id).run();
  const symbols=(await db.prepare('SELECT symbol,rank_score FROM account_search_candidates WHERE run_id=? ORDER BY rank_score DESC LIMIT 8').bind(run.runId).all<Row>()).results;
  for(const row of symbols)await queueOptionResearch(db,account.household_id,account.account_id,row.symbol,false,Number(row.rank_score));
  return {more:true};
 }
 await db.prepare("UPDATE next_session_cycles SET status='SCREENED',stage='ACCOUNT_RESEARCH',counts_json=?::jsonb,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(counts),cycleId).run();return {more:false};
}

export async function nextSessionCounts(db:PostgresDatabase,cycleId:string){return db.prepare(`SELECT count(*)::int universe,count(*) FILTER(WHERE status<>'QUEUED')::int screened,count(*) FILTER(WHERE status='QUEUED')::int pending,count(*) FILTER(WHERE status='SCREENED')::int candidates,count(*) FILTER(WHERE status='REJECTED')::int rejected,count(*) FILTER(WHERE status='STALE')::int stale,count(*) FILTER(WHERE status='UNAVAILABLE')::int unavailable,count(DISTINCT sector) FILTER(WHERE screened_at IS NOT NULL AND sector IS NOT NULL)::int sectors,count(DISTINCT cap_bucket) FILTER(WHERE screened_at IS NOT NULL AND cap_bucket<>'UNKNOWN')::int market_cap_buckets,count(*) FILTER(WHERE screened_at IS NOT NULL AND sector IS NULL)::int sector_unknown,max(screened_at) last_scan FROM next_session_symbols WHERE cycle_id=?`).bind(cycleId).first<Row>();}

export async function nextSessionStatus(db:PostgresDatabase,accountId:string){
 const cycle=await db.prepare('SELECT c.*,n.run_id,n.status account_status FROM next_session_cycles c LEFT JOIN next_session_accounts n ON n.cycle_id=c.id AND n.account_id=? ORDER BY c.close_at DESC LIMIT 1').bind(accountId).first<Row>();if(!cycle)return null;
 const jobs=(await db.prepare("SELECT id,status,attempts,error_code,available_at,updated_at FROM background_jobs WHERE job_type='NEXT_SESSION_RESEARCH' AND payload_json->>'cycleId'=? ORDER BY created_at DESC LIMIT 1").bind(cycle.id).all<Row>()).results;
 const edges=(await db.prepare('SELECT symbol,evidence_json FROM next_session_edges WHERE cycle_id=? ORDER BY symbol LIMIT 30').bind(cycle.id).all<Row>()).results;
 const research=cycle.run_id?await db.prepare("SELECT count(*) FILTER(WHERE status IN ('COMPLETE','PARTIAL'))::int deep_researched,count(*) FILTER(WHERE status='FAILED')::int failed,count(*) FILTER(WHERE status='PARTIAL')::int partial,count(*) FILTER(WHERE decision_json->>'decision'='PREPARE' AND decision_json->'evidenceAgainst'='[]'::jsonb)::int prepared,count(*) FILTER(WHERE jsonb_array_length(COALESCE(decision_json->'evidenceAgainst','[]'::jsonb))>0)::int near_misses FROM account_search_candidates WHERE run_id=?").bind(cycle.run_id).first():null;
 return {...cycle,counts_json:{...await nextSessionCounts(db,cycle.id),...research as Row},jobs,edges};
}
