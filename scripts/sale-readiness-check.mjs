import assert from 'node:assert/strict';
import{saleReadiness}from '../lib/sale-readiness.ts';
const now=Date.parse('2026-09-24T14:00:00Z'),row={action:'SELL',actionable:true,lifecycle:'TRIGGERED',expires_at:'2026-09-24T15:00:00Z',pipeline_status:'COMPLETE',lifecycle_audit_json:{pipeline:'COMPLETE',shares:2,price:100}};
assert.equal(saleReadiness(row,now).ready,true);
for(const change of [{actionable:false},{lifecycle:'MONITORING'},{expires_at:'2026-09-24T13:00:00Z'},{pipeline_status:'INCOMPLETE'},{action:'HOLD'},{lifecycle_audit_json:{}},{lifecycle_audit_json:'broken json'},{lifecycle_audit_json:{pipeline:'COMPLETE',price:0,shares:2}}])assert.equal(saleReadiness({...row,...change},now).ready,false);
console.log('PASS: complete triggered sale accepted; unconfirmed, expired, incomplete, non-sale and invalid-price records never become sell orders');
