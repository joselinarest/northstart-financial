import assert from 'node:assert/strict';
import {watchEntry,monitorEntry,entryOrderReady} from '../lib/entry-plan.ts';
const now=Date.now(),iso=new Date(now).toISOString();
const watch=watchEntry({trigger:361,low:359,high:361,stop:352,targets:[380],shares:2});
const evidence={asOf:iso,price:361,lowSinceSetup:359,supportHeld:true,sellingPressureWeakening:true,reclaimed:true,volumeConfirmed:true,newsClear:true,thesisValid:true};
assert.equal(watch.orderPrice,null);
assert.equal(entryOrderReady(watch,now),false);
for(const field of ['supportHeld','sellingPressureWeakening','reclaimed','volumeConfirmed','newsClear']){
  const touched=monitorEntry(watch,{...evidence,[field]:false},now);
  assert.equal(touched.status,'WATCH',field);assert.equal(touched.orderPrice,null);assert.equal(entryOrderReady(touched,now),false);
}
const confirmed=monitorEntry(watch,evidence,now);
assert.equal(confirmed.status,'CONFIRMED');assert.equal(entryOrderReady(confirmed,now),false,'confirmation alone cannot invent order price');
const order={...confirmed,classification:'CONFIRMED PULLBACK',orderType:'LIMIT',orderPrice:361.25,actionAfterConfirmation:'Buy 2 shares with limit $361.25'};
assert.equal(entryOrderReady(order,now),true);assert.notEqual(order.trigger,order.orderPrice);
const broken=monitorEntry(watch,{...evidence,price:351,lowSinceSetup:351},now);
assert.equal(broken.status,'CANCELLED');assert.equal(broken.classification,'NO TRADE');assert.equal(broken.shares,0);
assert.equal(monitorEntry(broken,evidence,now).status,'CANCELLED','rebound must not resurrect cancelled setup');
assert.equal(monitorEntry(watch,{...evidence,lowSinceSetup:351},now).status,'CANCELLED','intraperiod breach cancels even after reclaim');
assert.equal(monitorEntry(watch,{...evidence,asOf:new Date(now-600001).toISOString()},now).status,'WATCH');
assert.equal(entryOrderReady({...order,confirmedAt:new Date(now-600001).toISOString()},now),false);
assert.equal(entryOrderReady({...order,orderType:'STOP_LIMIT',orderStopPrice:362},now),false);
assert.equal(entryOrderReady({...order,classification:'BREAKOUT/STOP-LIMIT',orderType:'STOP_LIMIT',orderStopPrice:361},now),true);
console.log('Entry gate passed: price touch, independent confirmations, separate order limit, pre-entry breach/rebound, stale evidence, expiry and stop-limit geometry. No orders executed.');
