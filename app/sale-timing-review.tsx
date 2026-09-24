"use client";
import {useHoldingCost} from './holding-cost-badge';
import {saleReadiness} from '@/lib/sale-readiness';
const usd=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function SaleTimingReview({symbol,accountId,recommendation,loading,error,allocationShares,allocationPrice}:{symbol:string;accountId?:string;recommendation?:any;loading:boolean;error:string;allocationShares?:number;allocationPrice?:number}){
 const holding=useHoldingCost(symbol,accountId),{ready,audit,price,shares}=saleReadiness(recommendation);
 const comparisonShares=shares!=null&&shares>0?shares:allocationShares!=null&&Number.isFinite(allocationShares)&&allocationShares>0?allocationShares:null;
 const comparisonPrice=ready?price:allocationPrice!=null&&Number.isFinite(allocationPrice)&&allocationPrice>0?allocationPrice:price;
 const pnl=holding?.average!=null&&comparisonPrice!=null&&comparisonShares!=null?(comparisonPrice-holding.average)*Math.min(comparisonShares,holding.shares):null;
 return <small className="sale-timing-review" style={{display:'block',padding:10,marginTop:8,border:'1px solid #adbaae',borderRadius:8,fontStyle:'normal',textAlign:'left',fontSize:14,lineHeight:1.6,gridColumn:'1 / -1',width:'100%',maxWidth:'100%',overflowWrap:'anywhere'}}>
 <b>{ready?'SELL / TRIM CONDITIONS TRIGGERED — REVIEW LIVE PRICE':'NO SELL RECOMMENDATION READY — ALLOCATION REVIEW ONLY'}</b><br/>
 {loading?'Checking the account’s latest recommendation…':error||recommendation?.reason||'Being above the allocation target alone does not justify selling. Stop adding and evaluate timing first.'}<br/>
 <b>Timing:</b> {ready?'Stored conditions triggered. Recheck the live bid, spread and evidence before choosing an order price.':'Wait for a current, complete SELL/TRIM recommendation and its confirmation. No exact sale time is validated.'}<br/>
 <b>Reference price:</b> {comparisonPrice!=null?usd(comparisonPrice)+' — saved comparison reference; verify current bid before acting':'Not validated'} · <b>Order price:</b> Not set<br/>
 <b>Average buy:</b> {holding?.average!=null?usd(holding.average):'Not provided'} · <b>Hypothetical gain/loss at reference:</b> {pnl!=null?usd(pnl)+' before taxes/fees on '+Math.min(comparisonShares!,holding!.shares).toFixed(4)+' shares (not an order)':'Not calculable'}<br/>
 {pnl!=null&&pnl<0&&<><b>This would realize a loss.</b> A thesis/stop/risk reason must justify it; allocation imbalance alone is insufficient.<br/></>}
 {!ready&&allocationShares!=null&&<><b>Why this appears:</b> This holding's allocation is above its target. The displayed quantity only models reducing that gap. No sale is authorized. Consider directing new contributions elsewhere or pausing additions while reviewing the account risk.<br/></>}
 <b>Confirmation:</b> {Array.isArray(audit.supporting)&&audit.supporting.length?audit.supporting.join('; '):'Verified price, sell evidence, account risk and proceeds plan are required.'}<br/>
 <b>After sale:</b> {audit.allocation||'Keep any proceeds uncommitted until rebuy/rotation is evaluated.'}{audit.reentry?` · Rebuy zone ${usd(audit.reentry.low)}–${usd(audit.reentry.high)} only after ${audit.reentry.trigger}`:''}<br/>
 <b>Cancel/review again:</b> stale data, changed thesis, recovered support, or an expired recommendation. An allocation estimate is not permission to sell.
 </small>;
}
