import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['lib/domain/pending-market-analysis.ts'],outfile:'work/pending-analysis.mjs',bundle:true,platform:'node',format:'esm'});
const {pendingMarketAnalysis}=await import('../work/pending-analysis.mjs');
const original={rank:1,priority:'ACTION_NOW',action:'REDUCE',symbol:'QQQM',quantity:'10',amountCents:'10000',priceCondition:'Review',when:'Now',why:'Above allocation target',capitalSource:'Sale',lifecycle:'PROPOSED'};
const result=pendingMarketAnalysis(original,{quantity:'2',cost_basis_cents:'20000',price_cents:'12000'},'30000');
assert.equal(result.action,'DO_NOTHING');assert.equal(result.quantity,'0');assert.equal(result.details.averageCostCents,'10000');assert.equal(result.details.savedPriceCents,'12000');assert.equal(result.details.currentPriceCents,undefined);assert.equal(result.details.estimatedCashAfterCents,'30000');assert.equal(result.details.analysisPending,true);
const blocked=pendingMarketAnalysis(original,{},'0',{reason:'Provider unavailable',expires_at:'2020-01-01'});assert.match(blocked.why,/expired.*Provider unavailable/);assert.equal(blocked.details.averageCostCents,null);assert.equal(blocked.details.savedPriceCents,null);
console.log('PASS: allocation is not a sell signal; cost/share and unchanged cash populated; missing quote stays unavailable; expiry/provider reason preserved');
