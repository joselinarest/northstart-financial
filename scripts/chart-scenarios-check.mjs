import assert from 'node:assert/strict';
import {chartScenarios} from '../lib/chart-scenarios.ts';
const bars=Array.from({length:25},(_,i)=>({time:new Date(Date.UTC(2026,8,i+1)).toISOString(),close:100+i,high:102+i,low:98+i}));
assert.equal(chartScenarios(bars.slice(0,20)),null);
assert.equal(chartScenarios([...bars.slice(0,-1),{...bars.at(-1),close:NaN}]),null);
const p=chartScenarios(bars);assert.equal(p.anchor,124);assert.equal(p.asOf,bars.at(-1).time);assert.equal(p.atr,4);assert.equal(p.points.length,5);assert(p.points[4].upper>p.points[0].upper);assert(p.points[4].lower<p.points[0].lower);assert(!('probability' in p));
console.log('Chart scenarios: missing data, anchor, ATR, expanding range, no fabricated probabilities PASS');
