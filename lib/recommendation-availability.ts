export type AnalysisRow={symbol:string;action:string;actionable:boolean;reason:string;expires_at:string;created_at:string};
export function recommendationAvailability(rows:AnalysisRow[],now=Date.now()){
 const fresh=rows.filter(r=>Date.parse(r.expires_at)>now);
 const blocked=(r:AnalysisRow)=>/unavailable|insufficient|DATA REFRESH REQUIRED|INCOMPLETE|FINNHUB_\d+/i.test(r.reason);
 const ready=fresh.filter(r=>r.actionable&&['BUY','STRONG_BUY','ACCUMULATE','BUY_PARTIAL','SELL','EXIT','REDUCE','TAKE_PARTIAL_PROFIT'].includes(r.action));
 const state=!rows.length?'EMPTY':!fresh.length?'STALE':fresh.every(blocked)?'BLOCKED':ready.length?'AVAILABLE':'WAIT';
 return {state,latestAt:rows.map(r=>r.created_at).sort().at(-1)||null,freshCount:fresh.length,readyCount:ready.length,items:rows.slice(0,12).map(r=>({symbol:r.symbol,action:r.action,reason:r.reason,stale:Date.parse(r.expires_at)<=now,asOf:r.created_at})),message:state==='EMPTY'?'No saved market analysis exists for this account. Allocation guidance below is not a validated trade.':state==='STALE'?'Saved market analysis has expired. No expired recommendation is an order to act on.':state==='BLOCKED'?'Market recommendations are blocked by missing data or provider failures. See the exact reasons below.':state==='WAIT'?'Analysis is available, but no immediate trade has passed every required condition.':'Validated recommendations are available for review below.'};
}
