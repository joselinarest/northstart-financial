import assert from 'node:assert/strict';
import vm from 'node:vm';
import{build}from'esbuild';
const built=await build({entryPoints:['lib/runtime-secrets.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'});
let now=1000,calls=0,fail=false;
class DateMock extends Date{static now(){return now}}
class SecretsManagerClient{async send(){calls++;if(fail)throw Error('test unavailable');return {SecretString:JSON.stringify({FINNHUB_API_KEY:'test-version-'+calls})}}}
const module={exports:{}},env={NORTHSTAR_SECRET_ID:'test'};
vm.runInNewContext(built.outputFiles[0].text,{module,process:{env},Date:DateMock,require:()=>({GetSecretValueCommand:class{},SecretsManagerClient})});
const load=module.exports.loadRuntimeSecrets;
await Promise.all([load(),load()]);assert.equal(calls,1);now+=299000;await load();assert.equal(calls,1);now+=2000;await Promise.all([load(),load()]);assert.equal(calls,2);assert.equal(env.FINNHUB_API_KEY,'test-version-2');now+=301000;fail=true;await assert.rejects(load(),/Secure server configuration/);fail=false;await load();assert.equal(calls,4);console.log('PASS: runtime secrets coalesce, expire after five minutes, rotate and recover after failed refresh');
