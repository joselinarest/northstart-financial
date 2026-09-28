const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;
/** Finnhub's slash-named debt/equity fields are ratios; Northstar thresholds use percent. */
export function normalizedFundamentalMetrics(metrics:Record<string,unknown>){
  const freeCashFlowPerShare=number(metrics.freeCashFlowPerShareTTM);
  const priceToFreeCashFlow=number(metrics.pfcfShareTTM);
  const debtRatio=number(metrics['totalDebt/totalEquityQuarterly']);
  const debtEquityPct=debtRatio===null?number(metrics.totalDebtToEquityQuarterly):debtRatio*100;
  // A positive stock price divided by FCF has the same sign as FCF. Do not invent FCF/share.
  const cashFlowPositive=freeCashFlowPerShare!==null?freeCashFlowPerShare>0:priceToFreeCashFlow!==null&&priceToFreeCashFlow!==0?priceToFreeCashFlow>0:null;
  return {freeCashFlowPerShare,priceToFreeCashFlow,debtEquityPct,cashFlowPositive,cashFlowBasis:freeCashFlowPerShare!==null?'Reported free cash flow per share':cashFlowPositive!==null?'Sign inferred from reported price/free-cash-flow ratio; FCF per share is not estimated':'Cash-flow coverage requires refresh'};
}
