import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
await build({entryPoints:['lib/options-result-freshness.ts','lib/options-scan-status.ts','lib/research-market-freshness.ts'],outdir:'work/options-check',bundle:true,platform:'node',format:'cjs',outExtension:{'.js':'.cjs'}});
const require=createRequire(import.meta.url);
const {currentOptionsResult}=require('../work/options-check/options-result-freshness.cjs');
const {summarizeOptionAnalysis,optionScanMessage,optionAnalysisState}=require('../work/options-check/options-scan-status.cjs');
const {researchMarketFresh}=require('../work/options-check/research-market-freshness.cjs');
const fresh={asOf:new Date().toISOString(),contract:{symbol:'CIEN'},decision:{action:'BUY_NOW'}};
assert.equal(currentOptionsResult(fresh),fresh);
for(const asOf of [null,'invalid',new Date(Date.now()-121000).toISOString(),new Date(Date.now()+10000).toISOString()]){
 const stale=currentOptionsResult({...fresh,asOf});assert.equal(stale.contract,fresh.contract);assert.equal(stale.executionReady,false);assert.equal(stale.decision.action,'WAIT');assert.equal(stale.decision.shares,0);
}
const incomplete={decision:{providerStatus:'INSUFFICIENT_DATA'},status:'NO_TRADE'};
assert.equal(optionAnalysisState(incomplete),'INCOMPLETE');
assert.equal(optionAnalysisState({analysisState:'QUALIFIED',freshness:'STALE'}),'STALE');
assert.equal(optionAnalysisState({analysisState:'COMPLETE',decision:{}}),'COMPLETE');
assert.equal(optionAnalysisState({decision:{}}),'INCOMPLETE');
const summary=summarizeOptionAnalysis([incomplete,{analysisState:'COMPLETE'}]);assert.equal(summary.incomplete,1);assert.equal(summary.complete,1);
assert.match(optionScanMessage({...summary,pending:220},{}),/Analysis incomplete.*220/);
assert.match(optionScanMessage({reviewed:15},{universe:6000,screened:3000}),/15 stocks.*3000 stocks/);
assert.equal(researchMarketFresh('2026-09-25T20:00:00Z',120000,Date.parse('2026-09-26T06:00:00Z')),true);
assert.equal(researchMarketFresh('2026-09-24T20:00:00Z',120000,Date.parse('2026-09-26T06:00:00Z')),false);
assert.equal(researchMarketFresh('2026-09-25T20:00:00Z',120000,Date.parse('2026-09-28T14:00:00Z')),false);
console.log('PASS: stale/future option entry blocking and research freshness. Run research-pipeline-check for queue SQL.');
const calendarStart=performance.now();for(let i=0;i<10000;i++)assert.equal(researchMarketFresh('2026-09-25T20:00:00Z',120000,Date.parse('2026-09-26T18:00:00Z')),true);assert.ok(performance.now()-calendarStart<2000,'chain freshness must reuse the session calculation');console.log('PASS: 10,000 contract freshness checks stay within the research CPU budget.');
