import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {schemaStatements} from '../db/schema.ts';
import {migrations} from '../db/migrations.ts';
await build({entryPoints:['lib/academy-service.ts','lib/academy-curriculum.ts','app/academy-lab.tsx'],outdir:'work/academy-check',bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','pg-native'],outExtension:{'.js':'.cjs'},logLevel:'silent'});
const require=createRequire(import.meta.url),c=require('../work/academy-check/lib/academy-curriculum.cjs'),s=require('../work/academy-check/lib/academy-service.cjs');
let n=0;for(const m of c.academyModules)for(let i=0;i<m[3].length;i++)for(let v=0;v<3;v++){const e=c.makeExercise(m[0],i,v),q=c.publicExercise(e);assert.ok(c.gradeExercise(e,e.answer).correct);assert.ok(!c.gradeExercise(e,e.answer+1000).correct);for(const key of ['answer','future','reason','wrong','outcome','anchor'])assert.ok(!(key in q));assert.equal(e.bars.length,30);assert.equal(e.future.length,8);assert.ok(Number.isFinite(e.answer));n++;}
assert.equal(n,270);assert.notDeepEqual(c.makeExercise('structure',0,0).bars,c.makeExercise('structure',0,1).bars);
const history=c.trainingBars(1).map((b,i)=>({...b,time:new Date(Date.UTC(2026,0,i+1)).toISOString()})),historical=s.historicalExercise('EXAMPLE',history,history[25].time);assert.equal(historical.bars.at(-1).time,history[24].time);assert.equal(historical.future[0].time,history[25].time);assert.throws(()=>s.historicalExercise('EXAMPLE',history,history[2].time));
assert.equal(s.historicalExercise('EXAMPLE',history,history[25].time.replace('00:00','15:30')).bars.at(-1).time,history[24].time);
const pg=new PGlite(),wrap=c=>({prepare(sql){let v=[];return{bind(...values){v=values;return this;},async all(){let n=0;return{results:(await c.query(sql.replace(/\?/g,()=>'$'+(++n)),v)).rows};},async first(){return(await this.all()).results[0]||null;},async run(){return this.all();}}},transaction:fn=>c===pg?pg.transaction(t=>fn(wrap(t))):fn(wrap(c))}),db=wrap(pg);
try{for(const q of schemaStatements)await pg.exec(q);for(const m of migrations)for(const q of m.statements)await pg.exec(q);
await pg.exec("INSERT INTO households(id,name) VALUES('h','Test'),('other','Other'); INSERT INTO users(id,email,display_name) VALUES('u','u@example.test','Student'),('v','v@example.test','Other')");
const first=await s.startAcademy(db,'h','u',{module:'smc'});assert.ok(!('answer' in first.question));await assert.rejects(()=>s.answerAcademy(db,'h','v',first.sessionId,0));await assert.rejects(()=>s.answerAcademy(db,'other','u',first.sessionId,0));const row=(await pg.query('SELECT exercise_json FROM academy_sessions WHERE id=$1',[first.sessionId])).rows[0];
const feedback=await s.answerAcademy(db,'h','u',first.sessionId,row.exercise_json.answer);assert.ok(feedback.correct);assert.deepEqual(await s.answerAcademy(db,'h','u',first.sessionId,-999),JSON.parse(JSON.stringify(feedback)));assert.equal((await s.academyDashboard(db,'h','u')).completed,1);assert.equal((await s.academyDashboard(db,'h','v')).completed,0);
const second=await s.startAcademy(db,'h','u',{module:'smc',concept:first.question.concept});assert.notEqual(second.question.id,first.question.id);
const now=Date.now(),rows=Array.from({length:5},(_,i)=>({concept:'trend',answered_at:new Date(now-86400000*3).toISOString(),feedback_json:{correct:i!==0}}));assert.ok(s.skillProgress(rows,80,now).find(x=>x.concept==='trend').mastered);assert.ok(!s.skillProgress(rows,90,now).find(x=>x.concept==='trend').mastered);assert.ok(s.skillProgress(rows,80,now).find(x=>x.concept==='trend').due);
await pg.query("INSERT INTO discovery_provider_cache(cache_key,payload_json,fetched_at,expires_at) VALUES('research-v2:EXAMPLE',$1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+INTERVAL '1 hour')",[{bars:history}]);const real=await s.startAcademy(db,'h','u',{source:'market'});assert.match(real.question.source,/EXAMPLE/);assert.ok(!('future' in real.question));await assert.rejects(()=>s.startAcademy(db,'h','u',{source:'trade',tradeId:'nonexistent'}));
console.log('PASS: 90 exercises × 3 variants; hidden answers/future; historical cutoffs; private persistence; idempotent grading; mastery thresholds; spaced review; scanner history; missing trade protection.');
}finally{await pg.close()}
