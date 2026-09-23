import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {acquireDatabaseClient} from '../lib/database-recovery.ts';
let attempts=0;await acquireDatabaseClient(async()=>{if(++attempts===1)throw Error('Connection terminated due to connection timeout');return {}},async()=>{});assert.equal(attempts,2,'connection acquisition recovers before SQL is sent');
const require=createRequire(import.meta.url);
const built=await build({entryPoints:['lib/db.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolate-services',setup(b){b.onResolve({filter:/^@\/(lib\/(auth|runtime-secrets|migrations)|db\/schema)$/},args=>({path:args.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const schemaStatements=[]; export async function requireUser(){}; export async function loadRuntimeSecrets(){}; export async function runMigrations(){};',loader:'js'}));}}]});
let queries=[],releases=[],queryError=null,rollbackError=false,fetches=0,poolOptions;
const client={async query(sql){queries.push(sql);if(sql==='ROLLBACK'&&rollbackError)throw Error('rollback lost connection');if(sql!=='ROLLBACK'&&sql!=='BEGIN'&&queryError)throw queryError;return {rows:[],rowCount:0}},release(discard){releases.push(discard)}};
class Pool{constructor(options){poolOptions=options}on(){}async connect(){return client}}
const module={exports:{}};const sandbox={module,require:name=>name==='pg'?{Pool}:require(name),process:{env:{DATABASE_URL:'postgresql://test:test@database.example/test',NODE_ENV:'production',AUTO_MIGRATE_DATABASE:'false'}},URL,AbortSignal,console,fetch:async()=>{if(++fetches===1)throw Error('certificate download timeout');return {ok:true,text:async()=> '-----BEGIN CERTIFICATE-----\nfixture'}}};
vm.runInNewContext(built.outputFiles[0].text,sandbox);const exports=module.exports;
await assert.rejects(exports.database(),/certificate download timeout/);
const db=await exports.database();assert.equal(fetches,2,'a failed certificate load must not poison later requests');
await exports.database();assert.equal(fetches,2,'successful certificate loads remain shared');
await db.prepare('SELECT 1').all();assert.equal(poolOptions.keepAlive,true);assert.equal(poolOptions.ssl.rejectUnauthorized,true);
for(const kind of ['transaction','batch']){
 queries=[];releases=[];queryError=Error('original statement timeout');rollbackError=true;
 try{if(kind==='transaction')await db.transaction(tx=>tx.prepare('UPDATE example SET value=1').run());else await db.batch([db.prepare('UPDATE example SET value=1')]);assert.fail('expected failure')}catch(e){assert.equal(e,queryError,'rollback must preserve original failure')}
 assert.deepEqual(releases,[true],'broken client discarded exactly once');assert.equal(queries.filter(s=>s.startsWith('UPDATE')).length,1,'ambiguous writes never replayed');
}
console.log('Database recovery passed: certificate retry/cache, verified TLS, keepalive, original error preserved, broken client discarded once, no write replay.');
