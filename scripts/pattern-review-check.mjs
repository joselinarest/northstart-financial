import assert from 'node:assert/strict';
import {detectPatternEvidence} from '../lib/pattern-evidence.ts';
import {buildPostTradeReview} from '../lib/post-trade-review.ts';
const day=86400000,start=Date.parse('2025-01-01T00:00:00Z');
const bar=(i,o,h,l,c,v=100)=>({time:new Date(start+i*day).toISOString(),open:o,high:h,low:l,close:c,volume:v});
const base=()=>Array.from({length:70},(_,i)=>bar(i,100,102,98,100));
const context={timeframe:'1Day'};
const seen=new Set();
function expect(name,tail){const b=base();tail.forEach((x,i)=>b[b.length-tail.length+i]=bar(b.length-tail.length+i,...x));const patterns=detectPatternEvidence(b,context);assert(patterns.some(p=>p.name===name),name);for(const p of patterns){seen.add(p.name);assert.equal(p.executionAllowed,false);assert.notEqual(p.validation,'PASS');assert.equal(p.marketAlignment,'UNKNOWN');assert.equal(p.timeframe,'1Day');assert(p.missingConfirmation.includes('Account risk and position sizing approval'));assert(Number.isFinite(p.confirmationLevel)&&Number.isFinite(p.invalidationLevel));}return patterns;}
expect('Hammer',[[100,101.2,97,101]]);
expect('Shooting Star',[[100,104,99.8,101]]);
expect('Doji',[[100,102,98,100.05]]);
expect('Bullish Engulfing',[[102,103,98,99],[98.5,103,98,102.5]]);
expect('Bearish Engulfing',[[99,103,98,102],[102.5,103,98,98.5]]);
expect('Morning Star',[[105,106,99,100],[99.5,100,99,99.7],[100,104,99.8,104]]);
expect('Evening Star',[[100,106,99,105],[105,106,104.8,105.2],[105,105.5,100,101]]);
expect('Inside Bar',[[100,105,95,101],[100,102,98,101]]);
expect('Gap Up',[[105,107,104,106]]);
expect('Gap Down',[[94,96,93,95]]);
expect('Range Breakout',[[101,105,100,104]]);
expect('Support Bounce',[[99,102,98,102]]);
expect('Resistance Rejection',[[102,103,98,99]]);
const shape=(points)=>{const b=base();for(let i=0;i<b.length;i++){const right=points.findIndex(p=>p[0]>=i);const [x1,y1]=points[Math.max(0,right-1)], [x2,y2]=points[right<0?points.length-1:right];const c=x1===x2?y2:y1+(y2-y1)*(i-x1)/(x2-x1);b[i]=bar(i,c-.05,c+.3,c-.3,c,100);}return b;};
const fixtures={
 'Double Bottom':[[0,110],[40,110],[45,95],[50,110],[58,95],[65,109],[69,110]],
 'Double Top':[[0,95],[40,95],[45,110],[50,95],[58,110],[65,96],[69,95]],
 'Head and Shoulders':[[0,95],[35,95],[40,110],[45,96],[50,118],[55,96],[61,110],[65,96],[69,95]],
 'Inverse Head and Shoulders':[[0,110],[35,110],[40,95],[45,109],[50,87],[55,109],[61,95],[65,109],[69,110]],
 'Ascending Triangle':[[0,95],[35,95],[40,110],[45,98],[50,110],[55,102],[60,110],[64,106],[69,109]],
 'Descending Triangle':[[0,110],[35,110],[40,95],[45,107],[50,95],[55,103],[60,95],[64,99],[69,96]],
 'Symmetrical Triangle':[[0,95],[35,95],[40,115],[45,98],[50,112],[55,101],[60,109],[64,104],[69,106]],
 'Higher Highs / Higher Lows':[[0,95],[35,95],[40,110],[45,98],[50,115],[55,103],[60,120],[64,108],[69,117]],
 'Lower Highs / Lower Lows':[[0,110],[35,110],[40,95],[45,107],[50,90],[55,102],[60,85],[64,97],[69,90]],
 'Cup and Handle':[[0,110],[10,110],[15,110],[30,99],[36,98],[40,99],[56,110],[61,110],[65,108],[69,111]],
};
for(const [name,points] of Object.entries(fixtures)){const p=detectPatternEvidence(shape(points),context);assert(p.some(p=>p.name===name),`${name}: ${p.map(p=>p.name).join(', ')}`);seen.add(name);}
for(const [name,sign] of [['Bull Flag',1],['Bear Flag',-1]]){const b=shape([[0,100],[52,100],[62,100+sign*30],[68,100+sign*28],[69,100+sign*31]]);for(let i=52;i<62;i++)b[i].volume=400;assert(detectPatternEvidence(b,context).some(p=>p.name===name),name);seen.add(name);}
const retest=base();for(let i=64;i<69;i++)retest[i]=bar(i,105,108,104,107);retest[69]=bar(69,102,106,102,105);assert(detectPatternEvidence(retest,context).some(p=>p.name==='Breakout-Retest'));seen.add('Breakout-Retest');
assert.deepEqual(detectPatternEvidence(base().slice(0,10),context),[]);
const malformed=base();malformed[20].close=NaN;assert.deepEqual(detectPatternEvidence(malformed,context),[]);
const duplicates=base();duplicates[20].time=duplicates[19].time;assert.deepEqual(detectPatternEvidence(duplicates,context),[]);
const input={exitId:'sale',shares:2,exitPrice:100,exitAt:new Date(start+40*day+3600000).toISOString(),netProceeds:198,basis:160,entryAt:new Date(start+10*day+3600000).toISOString(),entryPrice:80,entryConfirmed:true,stop:75,predicted:{action:'TRIM'},patterns:[{name:'Bull Flag',direction:'UP'}],modelVersion:'model-1',strategyVersion:'strategy-1',sellReason:'TARGET REACHED'};
const path=Array.from({length:61},(_,i)=>bar(i,90,110,79,i>40?120:100));path.forEach(b=>b.high=Math.max(b.high,b.close));
const review=buildPostTradeReview(input,path);assert.equal(review.actual.realizedResult,38);assert.equal(review.holdComparison.holdWouldHaveBeenBetter,true);assert.equal(review.holdComparison.excessVsHold,-42);assert.equal(review.maximumAdverseExcursionBps,-125);assert.equal(review.maximumFavorableExcursionBps,3750);assert.equal(review.automaticRuleChanges,false);assert.equal(review.evidenceAttribution[0].assessment,'DIRECTION_MATCHED');
const unknown=buildPostTradeReview({...input,entryAt:null,entryPrice:null,basis:null,entryConfirmed:null},path);assert.equal(unknown.maximumAdverseExcursionBps,null);assert.equal(unknown.actual.realizedResult,null);assert.match(unknown.entryAssessment,/UNKNOWN/);
const pending=buildPostTradeReview(input,path.slice(0,40));assert.equal(pending.status,'AWAITING_POST_EXIT_DATA');assert.equal(pending.holdComparison.holdWouldHaveBeenBetter,null);
assert.equal(JSON.stringify(input.predicted),'{"action":"TRIM"}');
console.log(`PASS: ${seen.size} pattern labels detected on synthetic candles; missing confirmations, malformed data, explicit timeframes, post-trade HOLD/MFE/MAE, unknown history and pending horizons.`);
