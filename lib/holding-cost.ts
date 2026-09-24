export type CostHolding={account_id?:unknown;ticker?:unknown;symbol?:unknown;quantity?:unknown;cost_basis_cents?:unknown;market_value_cents?:unknown};
export function holdingCost(rows:CostHolding[],accountId:string,symbol:string){
 const matches=rows.filter(h=>String(h.account_id)===accountId&&String(h.ticker||h.symbol||'').toUpperCase()===symbol.toUpperCase()&&Number.isFinite(Number(h.quantity))&&Number(h.quantity)>0);
 if(!accountId||!matches.length)return null;
 const shares=matches.reduce((sum,h)=>sum+Number(h.quantity),0);
 const valid=(value:unknown)=>value!=null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0;
 const cost=matches.every(h=>valid(h.cost_basis_cents))?matches.reduce((sum,h)=>sum+Number(h.cost_basis_cents),0)/100:null;
 const value=matches.every(h=>valid(h.market_value_cents))?matches.reduce((sum,h)=>sum+Number(h.market_value_cents),0)/100:null;
 return {shares,average:cost==null?null:cost/shares,cost,storedPrice:value==null?null:value/shares};
}
