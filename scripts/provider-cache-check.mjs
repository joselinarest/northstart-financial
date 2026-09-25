import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
registerHooks({resolve(s,c,next){if(s.startsWith('@/lib/'))return {url:new URL('../lib/'+s.slice(6)+'.ts',import.meta.url).href,shortCircuit:true};if(s.startsWith('./')&&!s.endsWith('.ts'))return {url:new URL(s+'.ts',c.parentURL).href,shortCircuit:true};return next(s,c)},load(u,c,next){if(u.endsWith('/db.ts')||u.endsWith('/runtime-secrets.ts'))return {format:'module',source:'export const id=()=>"fixture"; export const loadRuntimeSecrets=async()=>{};',shortCircuit:true};if(u.endsWith('.ts'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText,shortCircuit:true};return next(u,c)}});

const {discoveryFinnhub}=await import('../lib/discovery-queue.ts');
const cache=new Map();let blocked=false,calls=0;
const db={prepare(sql){let args;return{bind(...a){args=a;return this},async first(){if(sql.includes('discovery_provider_cache'))return cache.get(args[0])??null;if(sql.includes('cooldown_until'))return blocked?{blocked:1}:null},async run(){if(sql.includes('INSERT INTO discovery_provider_cache'))cache.set(args[0],{payload_json:JSON.parse(args[1]),fetched_at:args[2]});if(sql.includes('INSERT INTO discovery_control'))blocked=true}}}};
globalThis.fetch=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return new Response(JSON.stringify({value:42}))};
const results=await Promise.all(Array.from({length:8},()=>discoveryFinnhub(db,'/stock/metric?symbol=TEST',60)));
assert.equal(calls,1);assert.ok(results.every(r=>r.data.value===42));
const cached=await discoveryFinnhub(db,'/stock/metric?symbol=TEST',60);assert.equal(calls,1);assert.equal(cached.asOf,results[0].asOf);
globalThis.fetch=async()=>{calls++;return new Response('{}',{status:429})};
await assert.rejects(discoveryFinnhub(db,'/failure',60),/FINNHUB_429/);
await assert.rejects(discoveryFinnhub(db,'/other',60),/COOLDOWN/);assert.equal(calls,2);
assert.equal((await discoveryFinnhub(db,'/stock/metric?symbol=TEST',60)).data.value,42);
console.log('PASS: concurrent requests coalesce, cached timestamps persist, rate limits block new requests while valid cache remains usable.');
