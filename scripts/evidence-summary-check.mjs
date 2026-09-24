import assert from 'node:assert/strict';import {build} from 'esbuild';
await build({entryPoints:['lib/domain/evidence-summary.ts'],outfile:'work/evidence-summary.mjs',bundle:true,platform:'node',format:'esm'});
const {evidenceSummary,evidenceState}=await import('../work/evidence-summary.mjs');
const summary=evidenceSummary({status:'BLOCKED',reason:'News unavailable',details:{provider:'news',retry:true}});
assert.match(summary,/News unavailable/);assert.match(summary,/provider: news/);assert(!summary.includes('[object Object]'));assert.equal(evidenceState({status:'BLOCKED'}),'FAIL');assert.equal(evidenceState({passed:true}),'PASS');assert.equal(evidenceState({score:90}),'UNKNOWN');assert.equal(evidenceSummary(null),'Not supplied');console.log('PASS: nested evidence readable; explicit pass/fail preserved; score alone does not imply confirmation');
