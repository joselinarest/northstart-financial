import assert from 'node:assert/strict';
import {kidsGoalSummary} from '../lib/kids-plan-summary.ts';
const account={account_id:'account',goal_id:'goal',effective_balance_cents:48076,holdings_value_cents:48076,cash_balance_cents:0,allocation_percent:100};
let summary=kidsGoalSummary({id:'goal',current_manual_balance_cents:0,current_balance_cents:48076,monthly_contribution_cents:35000,calculated_at:'2026-09-24'},[account]);
assert.equal(summary.current,48076);assert.equal(summary.cash,0);assert.equal(summary.monthly,35000);assert.equal(summary.balanceChanged,false);
summary=kidsGoalSummary({id:'goal',current_manual_balance_cents:10000,current_balance_cents:48076,calculated_at:'2026-09-24'},[account]);assert.equal(summary.current,58076);assert.equal(summary.balanceChanged,true,'extra manual funds must be visible and invalidate old projection');
summary=kidsGoalSummary({id:'goal'},[{...account,allocation_percent:0},{...account,goal_id:'other'}]);assert.equal(summary.current,0,'zero allocation and other goals must not inflate balance');assert.equal(summary.hasProjection,false);
summary=kidsGoalSummary({id:'goal'},[{...account,allocation_percent:50}]);assert.equal(summary.current,24038);assert.equal(summary.holdings,24038);
console.log('Kids summary passed: separates cash, holdings, planned contributions, manual funds; honors allocation and goal boundaries; detects stale balance.');
