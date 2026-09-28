import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {schemaStatements} from '../db/schema.ts';
import {migrations} from '../db/migrations.ts';
await build({entryPoints:['lib/market-research-inputs.ts','lib/market-intelligence-queue.ts','lib/discovery-queue.ts','lib/account-strategy-research.ts','lib/account-market-search.ts','lib/options-research-queue.ts','app/intelligence-coverage.tsx'],outdir:'work/always-on-check',bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','pg-native'],outExtension:{'.js':'.cjs'},logLevel:'silent'});
const require=createRequire(import.meta.url),queue=require('../work/always-on-check/lib/market-intelligence-queue.cjs'),discovery=require('../work/always-on-check/lib/discovery-queue.cjs'),strategy=require('../work/always-on-check/lib/account-strategy-research.cjs'),search=require('../work/always-on-check/lib/account-market-search.cjs'),options=require('../work/always-on-check/lib/options-research-queue.cjs');
const pg=new PGlite(),wrap=c=>({prepare(sql){let v=[];return{bind(...values){v=values;return this;},async all(){let n=0;return{results:(await c.query(sql.replace(/\?/g,()=>'$'+(++n)),v)).rows};},async first(){return(await this.all()).results[0]||null;},async run(){return this.all();}};},transaction:fn=>c===pg?pg.transaction(t=>fn(wrap(t))):fn(wrap(c))}),db=wrap(pg);
try{
 for(const s of schemaStatements)await pg.exec(s);for(const m of migrations)for(const s of m.statements)await pg.exec(s);
 await pg.exec("INSERT INTO households(id,name) VALUES('h','Test');INSERT INTO entities(id,household_id,type,name) VALUES('e','h','investment','Test');INSERT INTO accounts(id,entity_id,name,type) VALUES('a','e','Test','investment');INSERT INTO investment_account_settings(account_id,strategy_type,goal_name) VALUES('a','SWING','Growth')");
 for(let i=0;i<12;i++)await pg.query('INSERT INTO discovery_queue(symbol,priority,asset_json,seed_json) VALUES($1,$2,$3,$4)',['S'+String(i).padStart(2,'0'),i<6?150:0,{name:'Company '+i},{seed:{metrics:{price:20,averageDollarVolume:4000000},buckets:{swing:75,quiet:50}}}]);
 const rotation=await queue.advanceMarketRotation(db);assert.equal(await queue.advanceMarketRotation(db),rotation);
 const first=await discovery.claimDiscovery(db,'SCREEN',4);assert.equal(first.length,4);assert.ok(first.some(r=>r.priority===150));
 // Oldest background work wins its reserved slots even when urgent work remains.
 await pg.exec("UPDATE discovery_queue SET lease_until=NULL,next_screen_at=CASE WHEN priority=0 THEN CURRENT_TIMESTAMP-INTERVAL '2 days' ELSE CURRENT_TIMESTAMP END");
 const fair=await discovery.claimDiscovery(db,'SCREEN',4);assert.equal(fair.filter(r=>r.priority===0).length,2);
 await pg.exec("UPDATE discovery_queue SET last_attempt_at=CURRENT_TIMESTAMP,last_screened_at=CURRENT_TIMESTAMP,lease_until=NULL WHERE symbol<>'S11';UPDATE discovery_queue SET seed_json=NULL,screen_error='PROVIDER_429' WHERE symbol='S10'");
 let proof=await queue.intelligenceProof(db,'a');assert.equal(proof.rotation.pending,1);assert.equal(proof.rotation.screened,10);assert.equal(proof.rotation.failed,1);assert.equal(proof.lastCompletedRotation,null);
 await pg.exec("UPDATE discovery_queue SET active=false WHERE symbol='S11'");const next=await queue.advanceMarketRotation(db);assert.notEqual(next,rotation);proof=await queue.intelligenceProof(db,'a');assert.equal(proof.lastCompletedRotation.counts_json.retired,1);assert.equal(proof.rotation.universe,11);
 await queue.scheduleScannerWork(db);await queue.scheduleScannerWork(db);assert.equal((await pg.query("SELECT count(*)::int n FROM background_jobs WHERE job_type IN ('MARKET_DISCOVERY','OPTIONS_DISCOVERY')")).rows[0].n,2);
 const accountRun=await search.startAccountSearch(db,'h','a');await pg.query("UPDATE account_search_runs SET created_at=CURRENT_TIMESTAMP-INTERVAL '3 hours',status='PARTIAL' WHERE id=$1",[accountRun.runId]);assert.equal((await search.startAccountSearch(db,'h','a',true,'different-close-cycle')).runId,accountRun.runId,'in-flight account work must not be duplicated at two hours or at market close');
 for(let i=0;i<40;i++)await options.queueOptionResearch(db,'h','a','OPT'+i,false,i);
 assert.equal((await options.queueOptionResearch(db,'h','a','DEFERRED')).status,'DEFERRED');assert.equal((await options.queueOptionResearch(db,'h','a','MANUAL',true)).status,'QUEUED');
 const base={strategy:'LONG_TERM',value:10000,cash:500,positionRoom:1000,price:100,name:'Quality Company',symbol:'XYZ',fractional:false,targets:{},holdings:[]};
 assert.equal(strategy.longTermCapacity(base).shares,5);assert.equal(strategy.longTermCapacity({...base,holdings:[{name:'Other company',value:3000}]}).shares,0,'overweight category must redirect contribution');assert.equal(strategy.longTermCapacity({...base,cash:41.75,fractional:true}).shares,.4175);assert.equal(strategy.longTermCapacity({...base,cash:41.75}).shares,0);
 const row={business_quality:95,valuation:90,seed_json:{seed:{buckets:{quiet:70,swing:20,oversold:30},metrics:{dayChange:1,relativeVolume:1}}}};assert.notEqual(strategy.strategyResearchScore('OPTIONS',row),strategy.strategyResearchScore('LONG_TERM',row));
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),Coverage=require('../work/always-on-check/app/intelligence-coverage.cjs').default;assert.match(renderToStaticMarkup(React.createElement(Coverage,{proof})),/<details open=""/);
 // Validated shared symbol-cache behavior is covered by research-evidence-check.mjs.
 await pg.query("INSERT INTO account_search_candidates(run_id,symbol,status,decision_json) VALUES($1,'S00','COMPLETE',$2) ON CONFLICT(run_id,symbol) DO UPDATE SET decision_json=EXCLUDED.decision_json",[accountRun.runId,{symbol:'S00',price:20,fractional:false,minimumCash:20,investableCash:0}]);
 const named=await search.accountSearchStatus(db,'h','a');assert.equal(named.candidates.find(c=>c.symbol==='S00').companyName,'Company 0','saved candidates resolve company identity without rerunning research');assert.equal(await search.accountSearchStatus(db,'different-household','a'),null,'research names do not bypass account scope');
 console.log('PASS: durable rotations, failed/retired coverage, fair background slots, autonomous queue dedupe, no overlapping account runs, Options backpressure/manual priority, strategy-specific scores, allocation/fractional sizing, default-open proof.');
}finally{await pg.close();}
