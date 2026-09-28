import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {schemaStatements} from '../db/schema.ts';
import {migrations} from '../db/migrations.ts';
await build({entryPoints:['lib/next-session-intelligence.ts','lib/next-session-context.ts','app/account-research-results.tsx'],outdir:'work/next-session-check',bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','pg-native'],outExtension:{'.js':'.cjs'},logLevel:'silent'});
const require=createRequire(import.meta.url),engine=require('../work/next-session-check/lib/next-session-intelligence.cjs'),context=require('../work/next-session-check/lib/next-session-context.cjs'),ui=require('../work/next-session-check/app/account-research-results.cjs');
const {renderToStaticMarkup}=require('react-dom/server'),React=require('react');
const ranked=ui.rankResearchCandidates([{symbol:'LOW',rank_score:.2,decision_json:{symbol:'LOW'}},{symbol:'HIGH',rank_score:'1.3',decision_json:{symbol:'HIGH'}},{symbol:'QUEUED',rank_score:100,decision_json:{}}]);assert.equal(ranked[0].symbol,'HIGH');
const markup=renderToStaticMarkup(React.createElement(ui.default,{accountId:'account & one',cashCents:13515,search:{status:'PARTIAL',counts_json:{shortlisted:2},candidates:ranked}}));assert.match(markup,/<details open=""/);assert.match(markup,/Open chart &amp; full analysis/);assert.match(markup,/accountId=account\+%26\+one/);assert.ok(markup.indexOf('HIGH')<markup.indexOf('LOW'));assert.match(markup,/Near miss/);
const edges=context.eventHypotheses([{id:'event',headline:'AI cloud capacity contract',related:[],url:'https://example.invalid',publishedAt:'2026-09-25'}],[{symbol:'SMALL',sector:'Electrical equipment'},{symbol:'OTHER',sector:'Food'}]);assert.equal(edges.length,1);assert.equal(edges[0].symbol,'SMALL');assert.equal(edges[0].requiresIndependentResearch,true);
assert.equal(context.materialContextChange({series:[{id:'DGS10',value:4,date:'2026-09-24'}]},{series:[{id:'DGS10',label:'Yield',value:4.2,date:'2026-09-25'}]}).length,1);
const pg=new PGlite();const wrap=c=>({prepare(sql){let v=[];return{bind(...values){v=values;return this;},async all(){let n=0;return{results:(await c.query(sql.replace(/\?/g,()=>'$'+(++n)),v)).rows};},async first(){return(await this.all()).results[0]||null;},async run(){return this.all();}};},transaction:fn=>c===pg?pg.transaction(t=>fn(wrap(t))):fn(wrap(c))});const db=wrap(pg);
const originalFetch=globalThis.fetch;
try{
 for(const s of schemaStatements)await pg.exec(s);for(const m of migrations)for(const s of m.statements)await pg.exec(s);
 await pg.exec("INSERT INTO households(id,name) VALUES('h','Test');INSERT INTO entities(id,household_id,type,name) VALUES('e','h','investment','Test');INSERT INTO accounts(id,entity_id,name,type) VALUES('a','e','Test','investment');INSERT INTO investment_account_settings(account_id,strategy_type,goal_name) VALUES('a','SWING','Growth')");
 for(let i=0;i<205;i++)await pg.query("INSERT INTO discovery_queue(symbol,asset_json) VALUES($1,$2)",['S'+i,{symbol:'S'+i,name:'Company '+i,exchange:'NYSE'}]);
 const now=Date.parse('2026-09-26T18:00:00Z'),cycleId=await engine.scheduleNextSession(db,now);assert.equal(cycleId,await engine.scheduleNextSession(db,now));assert.equal((await pg.query("SELECT count(*)::int n FROM background_jobs WHERE job_type='NEXT_SESSION_RESEARCH'")).rows[0].n,1);
 await pg.query('UPDATE next_session_cycles SET context_at=CURRENT_TIMESTAMP WHERE id=$1',[cycleId]);
 globalThis.fetch=async input=>{const url=new URL(String(input)),symbols=url.searchParams.get('symbols').split(',');const bars=Object.fromEntries(symbols.map(symbol=>[symbol,symbol==='S204'?[]:Array.from({length:60},(_,i)=>({t:new Date(Date.parse('2026-07-28T04:00:00Z')+i*86400000).toISOString(),o:19,h:21,l:18,c:20+i*.1,v:1000000}))]));return new Response(JSON.stringify({bars}));};
 for(let i=0;i<3;i++)assert.equal((await engine.runNextSessionBatch(db,cycleId)).more,true);
 const coverage=await engine.nextSessionCounts(db,cycleId);assert.equal(coverage.universe,205);assert.equal(coverage.screened,205);assert.equal(coverage.pending,0);assert.equal(coverage.unavailable,1);
 assert.equal((await engine.runNextSessionBatch(db,cycleId)).more,true);assert.equal((await engine.runNextSessionBatch(db,cycleId)).more,false);
 const status=await engine.nextSessionStatus(db,'a');assert.ok(status.run_id);assert.equal(status.status,'SCREENED');assert.equal(status.counts_json.screened,205);assert.equal((await pg.query('SELECT counts_json FROM account_search_runs WHERE id=$1',[status.run_id])).rows[0].counts_json.universe,205);assert.equal((await pg.query("SELECT count(*)::int n FROM background_jobs WHERE job_type='OPTIONS_ACCOUNT_REVIEW'")).rows[0].n,8);
 console.log('PASS: complete 205-symbol pass across batches, per-symbol unavailable evidence, idempotent scheduling, account/Options fan-out, causal hypotheses, macro changes, open ranked cards and account-specific chart links.');
}catch(e){console.error(e.message,e.query||e.stack);process.exitCode=1;}finally{globalThis.fetch=originalFetch;await pg.close();}

