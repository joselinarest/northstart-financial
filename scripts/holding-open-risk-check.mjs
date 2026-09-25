import assert from 'node:assert/strict';
import {holdingOpenRisk} from '../lib/holding-open-risk.ts';
for (const state of [null, undefined, 'null', '{}', 'invalid', {stop:'bad'}, {stop:-10}]) assert.equal(holdingOpenRisk(2,10000,state),200);
assert.equal(holdingOpenRisk(2,10000,{stop:90}),20);
assert.equal(holdingOpenRisk(2,10000,'{"stop":90}'),20);
assert.equal(holdingOpenRisk(2,10000,{stop:110}),0);
assert.equal(holdingOpenRisk(2,'bad',null),Infinity);
console.log('PASS null/malformed stop reserves full exposure without crashing decision jobs');
