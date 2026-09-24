"use client";
import {useState} from 'react';
import {useHoldingCost} from './holding-cost-badge';
import SaleTimingReview from './sale-timing-review';
const usd=(n:number|null)=>n==null?'Not available':n.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function ChartExitReview({symbol,accountId,price,support,resistance,stop,target,relativeVolume,fresh,recommendation,error}:{symbol:string;accountId:string;price:number;support:number;resistance:number;stop:number;target:number;relativeVolume:number;fresh:boolean;recommendation?:any;error?:string}){
 const holding=useHoldingCost(symbol,accountId),[quantity,setQuantity]=useState(''),[scenarioPrice,setPrice]=useState(''),[fees,setFees]=useState(''),[tax,setTax]=useState('');
 const parsed=(s:string)=>s.trim()!==''&&Number.isFinite(Number(s))&&Number(s)>=0?Number(s):null;
 const shares=parsed(quantity),at=parsed(scenarioPrice),costs=parsed(fees),taxes=parsed(tax),valid=holding&&shares!=null&&shares>0&&shares<=holding.shares&&at!=null&&at>0;
 const gross=valid?shares!*at!:null,pnl=valid&&holding.average!=null?shares!*(at!-holding.average):null;
 const change=holding?.average!=null&&holding.average>0&&at!=null?(at-holding.average)/holding.average*100:null;
 return <details className="chart-exit-review" open style={{padding:16,border:'1px solid #b6cbbf',borderRadius:12,marginBlock:16}}><summary><b>SELL / TRIM REVIEW · {symbol} · your purchase price and gain/loss</b></summary>
 {!holding?<p>No shares are recorded for this ticker in the selected account. Select the account that owns it.</p>:<>
 <p>Average purchase: <b>{usd(holding.average)}</b> · Owned: <b>{holding.shares} shares</b> · {fresh?'Chart reference':'Unverified / delayed chart reference'}: {usd(Number.isFinite(price)&&price>0?price:null)}</p>
 <p><b>Resistance / range review:</b> {usd(resistance>0?resistance:null)}. Consider a partial-trim review only if price rejects resistance, momentum weakens and selling volume confirms. A break higher with support intact argues for HOLD or a reviewed trailing stop.</p>
 <p><b>Support / invalidation review:</b> {usd(support>0?support:null)} / {usd(stop>0?stop:null)}. A confirmed breakdown and failed reclaim require a risk review. Touching a line alone does not authorize selling. Relative volume: {Number.isFinite(relativeVolume)?relativeVolume.toFixed(2)+'×':'unavailable'}.</p>
 <p>Chart distance per share: {price>0&&stop>0?usd(Math.max(0,price-stop)):'Not available'} down to the chart stop · {price>0&&target>0?usd(Math.max(0,target-price)):'Not available'} up to target {usd(target>0?target:null)}. Chart levels require the account’s central decision and current data.</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,180px),1fr))',gap:12}}>{[['Shares to model',quantity,setQuantity],['Hypothetical sale price',scenarioPrice,setPrice],['Estimated total fees ($)',fees,setFees],['Estimated total tax ($)',tax,setTax]].map(([label,value,set])=><label key={String(label)} style={{display:'grid',gap:4}}>{String(label)}<input type="number" min="0" step="any" value={String(value)} onChange={e=>(set as (value:string)=>void)(e.target.value)} style={{width:'100%',minWidth:0}}/></label>)}</div>
 <p><b>What-if calculation — not an order:</b> {quantity&&scenarioPrice&&!valid?'Enter a positive price and a quantity no greater than your owned shares.':valid?`Gross proceeds ${usd(gross)} · realized gain/loss ${usd(pnl)}${change!=null?` (${change.toFixed(2)}%)`:''} · remaining shares ${holding.shares-shares!}`:'Enter a sale quantity and price to compare a partial trim with a full exit.'}</p>
 <p>Net proceeds after your fee/tax estimates: <b>{gross!=null&&costs!=null&&taxes!=null?usd(gross-costs-taxes):'Enter fees and tax estimates; missing costs are not assumed to be zero.'}</b></p>
 {pnl!=null&&pnl<0&&<p><b>This scenario realizes a loss.</b> A confirmed thesis, stop or portfolio-risk reason must justify the exit; allocation imbalance alone is not enough.</p>}
 <SaleTimingReview symbol={symbol} accountId={accountId} recommendation={recommendation} loading={!recommendation&&!error} error={error||''}/>
 <p>Actual taxable results depend on the lots sold. These figures use recorded average cost. No exact sale time or profit is guaranteed; no order is placed.</p></>}
 </details>;
}
