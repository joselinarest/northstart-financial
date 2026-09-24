import assert from 'node:assert/strict';
import {analysisBlocker} from '../lib/recommendation-availability.ts';
const row={reason:'AI recommendations unavailable.'};
assert.match(analysisBlocker({...row,checks_json:{aiEvidence:{providerStatus:'MODEL_OR_STRATEGY_NOT_APPROVED'}}}),/no approved model and strategy/);
assert.match(analysisBlocker({...row,checks_json:JSON.stringify({aiEvidence:{providerStatus:'INSUFFICIENT_DATA',reasoningFactors:['Missing fundamentals','INSUFFICIENT_DATA']}})}),/Missing fundamentals/);
assert.equal(analysisBlocker({...row,checks_json:'invalid'}),row.reason);
assert.equal(analysisBlocker({...row,checks_json:{aiEvidence:{providerStatus:'AVAILABLE'}}}),row.reason);
console.log('PASS: precise approval/data blockers; malformed and legacy records safe');
