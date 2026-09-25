import {build} from 'esbuild';import assert from 'node:assert/strict';
await build({entryPoints:['lib/market-session.ts','lib/exchange-calendar.ts','lib/providers/alpaca-market-data.ts'],outdir:'work/calendar-test',bundle:true,platform:'node',format:'esm',packages:'external'});
const {marketSessionAt}=await import('../work/calendar-test/market-session.js'),{exchangeDay}=await import('../work/calendar-test/exchange-calendar.js'),{selectSnapshotPrice}=await import('../work/calendar-test/providers/alpaca-market-data.js');
for(const day of ['2026-04-03','2026-07-03','2026-11-26','2027-06-18','2028-04-14'])assert.equal(marketSessionAt(day+'T16:00:00Z'),'CLOSED');
assert.equal(marketSessionAt('2026-11-27T17:59:00Z'),'REGULAR');assert.equal(marketSessionAt('2026-11-27T18:00:00Z'),'AFTER_HOURS');assert.equal(marketSessionAt('2026-11-27T22:00:00Z'),'CLOSED');
assert.equal(marketSessionAt('2026-03-09T13:30:00Z'),'REGULAR');assert.equal(marketSessionAt('2026-01-20T14:30:00Z'),'REGULAR');assert.equal(exchangeDay('2027-12-31T16:00:00Z').tradingDay,true);assert.equal(exchangeDay('2029-01-02T16:00:00Z').supported,false);
const snapshot={latestTrade:{p:105,t:'2026-09-25T20:30:00Z'},latestQuote:{t:'2026-09-25T21:00:00Z'},dailyBar:{c:100,t:'2026-09-25T04:00:00Z'}};
assert.deepEqual(selectSnapshotPrice(snapshot,'CLOSED'),{last:100,timestamp:'2026-09-25T04:00:00Z'});assert.deepEqual(selectSnapshotPrice(snapshot,'REGULAR'),{last:105,timestamp:'2026-09-25T20:30:00Z'});
console.log('PASS holidays, early closes, DST, calendar expiry, last-close selection and price timestamp integrity');
