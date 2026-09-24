export type KidsLinkedAccount = {
  account_id:string; goal_id:string; allocation_percent?:unknown;
  effective_balance_cents?:unknown; current_balance_cents?:unknown;
  holdings_value_cents?:unknown; cash_balance_cents?:unknown;
};
export type KidsGoalSummaryInput = {
  id:string; current_manual_balance_cents?:unknown; current_balance_cents?:unknown;
  monthly_contribution_cents?:unknown; calculated_at?:unknown;
};
const number=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;
export function kidsGoalSummary(goal:KidsGoalSummaryInput,accounts:KidsLinkedAccount[]){
 const linked=accounts.filter(account=>account.goal_id===goal.id);
 const weighted=(key:keyof KidsLinkedAccount)=>Math.round(linked.reduce((sum,a)=>sum+number(a[key])*Math.min(100,Math.max(0,number(a.allocation_percent??100)))/100,0));
 const linkedBalance=Math.round(linked.reduce((sum,a)=>sum+number(a.effective_balance_cents??a.current_balance_cents)*Math.min(100,Math.max(0,number(a.allocation_percent??100)))/100,0));
 const manual=number(goal.current_manual_balance_cents),current=linkedBalance+manual;
 return {linked,holdings:weighted('holdings_value_cents'),cash:weighted('cash_balance_cents'),manual,current,
 monthly:number(goal.monthly_contribution_cents),hasProjection:Boolean(goal.calculated_at)&&goal.current_balance_cents!=null,
 balanceChanged:goal.current_balance_cents!=null&&Math.abs(current-number(goal.current_balance_cents))>1};
}
