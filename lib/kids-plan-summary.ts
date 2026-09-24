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
export function monthlyHoldingPlan(monthlyCents:number,assets:{ticker:string;weightPercent:number}[],purchases:{ticker:string;amount_cents:unknown}[]=[]){
 const budget=Math.max(0,Math.round(monthlyCents));
 const eligible=assets.filter(a=>Number.isFinite(Number(a.weightPercent))&&Number(a.weightPercent)>0);
 const total=eligible.reduce((sum,a)=>sum+Number(a.weightPercent),0);
 if(!total)return [];
 const rows=eligible.map(a=>{const exact=budget*Number(a.weightPercent)/total;return {...a,planned:Math.floor(exact),fraction:exact-Math.floor(exact)}});
 let cents=budget-rows.reduce((sum,a)=>sum+a.planned,0);
 for(const row of [...rows].sort((a,b)=>b.fraction-a.fraction)){if(cents--<=0)break;row.planned++}
 return rows.map(row=>{const recorded=Math.max(0,Math.round(purchases.filter(p=>p.ticker.toUpperCase()===row.ticker.toUpperCase()).reduce((sum,p)=>sum+(Number(p.amount_cents)||0),0)));return {ticker:row.ticker,planned:row.planned,recorded,remaining:Math.max(0,row.planned-recorded)}});
}
export function monthlyCashAction(monthly:number,recorded:number,cash:number|null,rows:{ticker:string;remaining:number}[]){
 const remaining=Math.max(0,Math.round(monthly)-Math.max(0,Math.round(recorded)));
 const available=cash!=null&&Number.isFinite(cash)&&cash>=0?Math.round(cash):null;
 // Redistribute only the remaining monthly budget, never spend extra to repair an overweight purchase.
 const allocations=monthlyHoldingPlan(remaining,rows.map(r=>({ticker:r.ticker,weightPercent:r.remaining})));
 return {remaining,cash:available,deposit:available==null?null:Math.max(0,remaining-available),allocations};
}
