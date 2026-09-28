import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {schemaStatements} from '../db/schema.ts';
import {migrations} from '../db/migrations.ts';
await build({entryPoints:['lib/ai-provider.ts','lib/ai-service-status.ts','lib/ai-decision-core.ts','lib/account-current-decision.ts'],outdir:'work/ai-outage-test',bundle:true,platform:'node',format:'cjs',outExtension:{'.js':'.cjs'},external:['pg-native'],logLevel:'silent'});
const require=createRequire(import.meta.url),load=n=>require('../work/ai-outage-test/'+n+'.cjs');
const {OpenAIProvider}=load('ai-provider'),{aiServiceStatus,requireCompletedDecision}=load('ai-service-status'),{runCentralDecision}=load('ai-decision-core');
const request={snapshotId:'test',schemaVersion:'decision-reasoning-1',model:'test',snapshot:{},candidateIds:['hold'],evidenceIds:['price']};
for(const [body,status,expected] of [[{error:{code:'credit_balance_exhausted',type:'insufficient_quota'}},429,'AI_QUOTA_EXHAUSTED'],[{error:{code:'rate_limit_exceeded'}},429,'AI_RATE_LIMITED'],[{error:{message:'sensitive provider detail'}},503,'AI_HTTP_503']]){
 const provider=new OpenAIProvider('TEST_ONLY',async()=>new Response(JSON.stringify(body),{status}));
 await assert.rejects(()=>provider.analyze(request),new RegExp('^Error: '+expected+'$'));
}
const pg=new PGlite();const wrap=c=>({prepare(sql){let values=[];return{bind(...v){values=v;return this},async all(){let n=0;return{results:(await c.query(sql.replace(/\?/g,()=>'$'+(++n)),values)).rows}},async first(){return(await this.all()).results[0]||null},async run(){return this.all()}}},transaction:fn=>c===pg?pg.transaction(tx=>fn(wrap(tx))):fn(wrap(c))});const db=wrap(pg);
try{
 for(const s of schemaStatements)await pg.exec(s);for(const m of migrations)for(const s of m.statements)await pg.exec(s);
 await pg.exec(`INSERT INTO households(id,name) VALUES('h','Test');INSERT INTO entities(id,household_id,type,name) VALUES('e','h','investment','Test');INSERT INTO accounts(id,entity_id,name,type) VALUES('a','e','Mixed','investment');INSERT INTO ai_strategy_versions(version,status,policy_json) VALUES('test','APPROVED','{}');INSERT INTO ai_model_versions(version,strategy,strategy_version,status,provider,provider_model,prompt_hash) VALUES('test','SWING_SHARES','test','CHAMPION','TEST','test','test');`);
 const asOf=new Date().toISOString();const input={householdId:'h',accountId:'a',accountName:'Test',strategy:'SWING_SHARES',ticker:'XYZ',requestType:'TEST',features:{},dataTimestamp:asOf,requiredFacts:[],evidence:['currentPrice','fundamentals','technical','portfolio','accountCash','riskLimit','news','valuation','marketRegime'].map(label=>({label,value:{verified:true},asOf,sourceType:'PROVIDER'})),candidates:[{id:'hold',action:'HOLD',eligible:true,shares:0,cost:0,proceeds:0,cashBefore:135.15,cashAfter:135.15,entry:null,trigger:null,stop:null,targets:[],thesisStatus:'INTACT',sellReason:null,reentryPlan:null,instrument:'NO_TRADE',reason:'Maintain exposure'}]};
 let calls=0;const provider={name:'TEST',async analyze(){calls++;throw Error('AI_QUOTA_EXHAUSTED')}};
 const failed=await runCentralDecision(input,{db,aiProvider:provider});assert.equal(failed.providerStatus,'AI_QUOTA_EXHAUSTED');assert.equal(failed.action,'INSUFFICIENT_CONFIRMATION');assert.match(failed.interpretation,/credits are exhausted/);assert.equal(failed.executionAllowed,false);
 assert.throws(()=>requireCompletedDecision({aiEvidence:failed}),/AI_QUOTA_EXHAUSTED/);
 const health=await aiServiceStatus(db,'TEST');assert.equal(health.coolingDown,true);
 await runCentralDecision(input,{db,aiProvider:provider});assert.equal(calls,1,'shared circuit skips repeated provider calls');
 assert.equal((await pg.query("SELECT count(*)::int n FROM ai_decision_runs WHERE status='COMPLETED'")).rows[0].n,0);
 assert.equal((await pg.query('SELECT failures FROM ai_provider_health')).rows[0].failures,1,'deferred calls must not extend the circuit or count as new provider failures');
 await pg.exec("UPDATE ai_provider_health SET last_failure_at=now()-interval '16 minutes'");assert.equal((await aiServiceStatus(db,'TEST')).coolingDown,false);
 const recovered={name:'TEST',async analyze(r){calls++;return{requestId:'recovered',output:{snapshotId:r.snapshotId,candidateId:'hold',confidence:80,interpretation:'Maintain exposure',reasonsFor:['Thesis intact'],reasonsAgainst:[],risks:['Market change'],whatWouldChange:['Thesis change'],evidenceIds:['technical'],scenarios:{bull:30,base:40,bear:30},instrument:'NO_TRADE'}}}};
 const success=await runCentralDecision(input,{db,aiProvider:recovered});assert.equal(success.providerStatus,'AVAILABLE');requireCompletedDecision({aiEvidence:success});assert.equal(await aiServiceStatus(db,'TEST'),null);
 const state=load('account-current-decision').accountCurrentDecision({decisionService:health,availableCashPlan:{cashCents:13515},queue:[]},{holdings:[],categories:[]},{},null);assert.notEqual(state.action,'ANALYSIS BLOCKED');assert.doesNotMatch(state.reason,/credits/);
 console.log('PASS quota vs rate limit, private error normalization, real DB failure audit, shared cooldown, timed recovery, failed-job guard, and account service-failure state.');
}catch(error){console.error(error.message,error.query||error.stack);process.exitCode=1;}finally{await pg.close()}