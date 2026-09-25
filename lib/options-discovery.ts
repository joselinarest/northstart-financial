import {optionsChain} from '@/lib/providers/options-chain';
import {id,type PostgresDatabase} from '@/lib/db';
import {providerSignal,remainingWorkMs} from '@/lib/work-budget';
type Row=Record<string,any>;
export function optionScreen(seed:Row|null){
 if(!seed?.metrics)return {stage:'DATA_UNAVAILABLE',reason:'Price/volume history unavailable; retry scheduled.'};
 if(seed.metrics.averageDollarVolume<2_000_000)return {stage:'REJECTED',reason:'Average dollar volume below the $2m option-underlying liquidity floor.'};
 if(seed.seed<65&&seed.metrics.relativeVolume<1.5&&Math.abs(seed.metrics.dayChange)<3)return {stage:'WATCH',reason:'No qualifying price/volume anomaly or technical screen yet.'};
 return {stage:'CHAIN_PENDING',reason:'Underlying price/liquidity screen passed; chain and full account thesis still required.'};
}
export async function runOptionsDiscovery(db:PostgresDatabase){
 await db.prepare('INSERT INTO options_discovery(symbol) SELECT symbol FROM discovery_queue WHERE active ON CONFLICT DO NOTHING').run();
 const batch=await db.transaction(async tx=>{const rows=(await tx.prepare(`SELECT o.symbol,d.seed_json FROM options_discovery o JOIN discovery_queue d USING(symbol) WHERE d.active AND d.last_screened_at IS NOT NULL AND o.next_check_at<=CURRENT_TIMESTAMP AND (o.lease_until IS NULL OR o.lease_until<CURRENT_TIMESTAMP) ORDER BY o.checked_at NULLS FIRST,o.next_check_at,o.symbol FOR UPDATE OF o SKIP LOCKED LIMIT 80`).all<Row>()).results;
 if(rows.length)await tx.prepare("UPDATE options_discovery SET lease_until=CURRENT_TIMESTAMP+INTERVAL '3 minutes' WHERE symbol=ANY(?::text[])").bind(rows.map(r=>r.symbol)).run();return rows;});
 let chains=0,screened=0;
 for(const row of batch){
  if(remainingWorkMs()<5000)break;
  const screen=optionScreen(row.seed_json?.seed);let stage=screen.stage,reason=screen.reason,payload:Row={};
  if(stage==='CHAIN_PENDING'){
   if(chains>=4){await db.prepare('UPDATE options_discovery SET lease_until=NULL WHERE symbol=?').bind(row.symbol).run();continue;}chains++;
   try{
    const data=await optionsChain(row.symbol);const all=Object.entries(data.snapshots||{});const liquid=all.filter(([symbol,v]:[string,any])=>{const match=symbol.match(/(\d{6})[CP]\d{8}$/);if(!match)return false;const dte=(Date.parse(`20${match[1].slice(0,2)}-${match[1].slice(2,4)}-${match[1].slice(4,6)}T20:00:00Z`)-Date.now())/86400000;const bid=Number(v.latestQuote?.bp),ask=Number(v.latestQuote?.ap);return dte>=14&&dte<=120&&bid>0&&ask>=bid&&(ask-bid)/((ask+bid)/2)<=.08;});
    stage=liquid.length?'CHAIN_QUALIFIED':data.partial?'DATA_UNAVAILABLE':all.length?'REJECTED':'NO_OPTIONS';reason=liquid.length?'Quoted multi-day contracts found; volume, OI, full underlying, volatility and account decision required.':all.length?'No sampled contract passed spread and DTE checks.':'Provider returned no option contracts.';
    payload={sampledContracts:all.length,liquidContracts:liquid.length,chainPaginationRemaining:Boolean(data.partial),provider:'Alpaca',asOf:new Date().toISOString()};
   }catch(error){stage='DATA_UNAVAILABLE';reason=error instanceof Error?error.message:'OPTION_CHAIN_UNAVAILABLE';}
  }
  screened++;await db.prepare("UPDATE options_discovery SET stage=?,reason=?,payload_json=?::jsonb,checked_at=CURRENT_TIMESTAMP,next_check_at=CURRENT_TIMESTAMP+(?::int*INTERVAL '1 minute'),lease_until=NULL WHERE symbol=?").bind(stage,reason,JSON.stringify(payload),stage==='DATA_UNAVAILABLE'?15:stage==='CHAIN_QUALIFIED'?30:240,row.symbol).run();
  if(stage==='CHAIN_QUALIFIED')await db.prepare(`INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) SELECT ?||a.id,e.household_id,'OPTIONS_ACCOUNT_REVIEW',?||a.id,jsonb_build_object('accountId',a.id,'symbol',?) FROM accounts a JOIN entities e ON e.id=a.entity_id JOIN account_risk_config r ON r.account_id=a.id WHERE a.hidden=0 AND a.type='investment' AND NOT EXISTS(SELECT 1 FROM background_jobs j WHERE j.job_type='OPTIONS_ACCOUNT_REVIEW' AND j.payload_json->>'accountId'=a.id AND j.payload_json->>'symbol'=? AND j.status IN ('QUEUED','RUNNING','FAILED')) ON CONFLICT(idempotency_key) DO NOTHING`).bind(id('option_review'),`${row.symbol}:${Math.floor(Date.now()/1800000)}:`,row.symbol,row.symbol).run();
 }
 return {screened,chainRequests:chains};
}
export async function optionsDiscoveryCoverage(db:PostgresDatabase){return (await db.prepare(`SELECT count(*)::int universe,count(*) FILTER(WHERE o.checked_at IS NOT NULL)::int screened,count(*) FILTER(WHERE o.stage='CHAIN_QUALIFIED')::int chain_qualified,count(*) FILTER(WHERE o.stage='WATCH')::int watching,count(*) FILTER(WHERE o.stage='REJECTED')::int rejected,count(*) FILTER(WHERE o.stage='NO_OPTIONS')::int no_options,count(*) FILTER(WHERE o.stage='DATA_UNAVAILABLE')::int unavailable,max(o.checked_at) last_scan FROM discovery_queue d LEFT JOIN options_discovery o USING(symbol) WHERE d.active`).first())}
