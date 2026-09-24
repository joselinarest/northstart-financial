import type {ActionGuidance} from './action-guidance';

// Allocation arithmetic is not a market opinion. Keep saved facts without
// promoting an old holding price to a live quote or manufacturing trade levels.
export function pendingMarketAnalysis(action:ActionGuidance, holding:any, cashCents:string, latest?:{reason:string;expires_at:string}) :ActionGuidance {
 const shares=Number(holding?.quantity),cost=Number(holding?.cost_basis_cents);
 const reason=latest ? `${Date.parse(latest.expires_at)<=Date.now()?'Previous analysis expired. ':''}${latest.reason}` : 'No current market analysis is saved for this holding.';
 return {...action,action:'DO_NOTHING',priority:'WATCH',lifecycle:'MONITORING',quantity:'0',amountCents:'0',
  why:reason,priceCondition:'Not evaluated — waiting for market analysis',when:'Request analysis; review the result before preparing an order.',capitalSource:'No transaction proposed; account cash stays unchanged.',
  details:{analysisPending:true,displayAction:'WAIT — ANALYSIS REQUIRED',allocationContext:action.why,
   savedPriceCents:Number(holding?.price_cents)>0?String(holding.price_cents):null,
   currentShares:Number.isFinite(shares)?String(shares):null,
   averageCostCents:holding?.cost_basis_cents!=null&&shares>0&&Number.isFinite(cost)?String(Math.round(cost/shares)):null,
   estimatedCashAfterCents:cashCents,missingReason:reason}};
}
