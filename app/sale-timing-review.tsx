"use client";
import {useHoldingCost} from './holding-cost-badge';
import {saleReadiness} from '@/lib/sale-readiness';
const usd=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function SaleTimingReview({symbol,accountId,recommendation,loading,error}:{symbol:string;accountId?:string;recommendation?:any;loading:boolean;error:string}){
 const holding=useHoldingCost(symbol,accountId),{ready,audit,price,shares}=saleReadiness(recommendation);
 const pnl=holding?.average!=null&&price!=null&&shares!=null?(price-holding.average)*Math.min(shares,holding.shares):null;
 return <small className="sale-timing-review" style={{display:'block',padding:10,marginTop:8,border:'1px solid #adbaae',borderRadius:8,fontStyle:'normal',maxWidth:'100%',overflowWrap:'anywhere'}}>
 <b>{ready?'SELL / TRIM CONDITIONS TRIGGERED — REVIEW LIVE PRICE':'REVIEW ONLY — NO SELL ORDER READY'}</b><br/>
 {loading?'Checking the account’s latest recommendation…':error||recommendation?.reason||'Being above the allocation target alone does not justify selling. Stop adding and evaluate timing first.'}<br/>
 <b>Timing:</b> {ready?'Stored conditions triggered. Recheck the live bid, spread and evidence before choosing an order price.':'Wait for a current, complete SELL/TRIM recommendation and its confirmation. No exact sale time is validated.'}<br/>
 <b>Reference price:</b> {price!=null?usd(price)+' — analysis reference, not an automatic limit order':'Not validated'} · <b>Order price:</b> Not set<br/>
 <b>Average buy:</b> {holding?.average!=null?usd(holding.average):'Not provided'} · <b>Estimated P/L at reference:</b> {pnl!=null?usd(pnl)+' before taxes/fees':'Not calculable'}<br/>
 {pnl!=null&&pnl<0&&<><b>This would realize a loss.</b> A thesis/stop/risk reason must justify it; allocation imbalance alone is insufficient.<br/></>}
 <b>Confirmation:</b> {Array.isArray(audit.supporting)&&audit.supporting.length?audit.supporting.join('; '):'Verified price, sell evidence, account risk and proceeds plan are required.'}<br/>
 <b>After sale:</b> {audit.allocation||'Keep any proceeds uncommitted until rebuy/rotation is evaluated.'}{audit.reentry?` · Rebuy zone ${usd(audit.reentry.low)}–${usd(audit.reentry.high)} only after ${audit.reentry.trigger}`:''}<br/>
 <b>Cancel/review again:</b> stale data, changed thesis, recovered support, or an expired recommendation. An allocation estimate is not permission to sell.
 </small>;
}
