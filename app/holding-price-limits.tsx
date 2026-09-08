"use client";

import {useCallback,useEffect,useMemo,useState} from "react";

type Holding=Record<string,unknown>;
type Limit={symbol:string;target_price:number|null;invalidation_price:number|null};

export default function HoldingPriceLimits({holdings,accessToken}:{holdings:Holding[];accessToken:string}){
  const symbols=useMemo(()=>[...new Map(holdings.filter(item=>item.ticker).map(item=>[String(item.ticker).toUpperCase(),item])).entries()],[holdings]);
  const[limits,setLimits]=useState<Record<string,{min:string;max:string}>>({});
  const[status,setStatus]=useState<Record<string,string>>({});
  const[quotes,setQuotes]=useState<Record<string,{ask:number|null;last:number|null;timestamp?:string|null}>>({});
  const headers=useCallback(()=>({"Content-Type":"application/json",...(accessToken?{Authorization:`Bearer ${accessToken}`}:{}) ,...(localStorage.getItem("northstar-household-id")?{"X-Household-ID":localStorage.getItem("northstar-household-id")!}:{})}),[accessToken]);
  useEffect(()=>{let active=true;(async()=>{try{const response=await fetch("/api/watchlist",{headers:headers(),cache:"no-store"}),data=await response.json(),next:Record<string,{min:string;max:string}>={},nextStatus:Record<string,string>={};for(const item of (data.items||[]) as Array<Limit&{purpose:string}>)if(item.purpose==="Holding price limits"){next[item.symbol]={min:item.invalidation_price==null?"":String(item.invalidation_price),max:item.target_price==null?"":String(item.target_price)};nextStatus[item.symbol]="✓ Saved and monitored"}await Promise.all(symbols.map(async([symbol])=>{if(next[symbol])return;try{const barsResponse=await fetch(`/api/market/bars?symbol=${encodeURIComponent(symbol)}&range=1Y`,{cache:"no-store"}),barsData=await barsResponse.json(),closes=(Array.isArray(barsData.bars)?barsData.bars:[]).map((bar:Record<string,unknown>)=>Number(bar.close)).filter(Number.isFinite);if(!barsResponse.ok||closes.length<50)throw new Error("Insufficient history");const price=closes.at(-1)!,sma50=closes.slice(-50).reduce((sum:number,value:number)=>sum+value,0)/50,min=Math.min(price*.92,sma50*.97),risk=Math.max(.01,price-min),max=price+2*risk;next[symbol]={min:min.toFixed(2),max:max.toFixed(2)};nextStatus[symbol]=`Northstar default · current $${price.toFixed(2)} · edit or save`}catch{next[symbol]={min:"",max:""};nextStatus[symbol]="Live history unavailable · enter levels manually"}}));if(active){setLimits(next);setStatus(nextStatus)}}catch{}})();return()=>{active=false}},[headers,symbols]);
  useEffect(()=>{let active=true;const refresh=async()=>{if(!symbols.length)return;try{const response=await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols.map(([symbol])=>symbol).join(","))}`,{headers:accessToken?{Authorization:`Bearer ${accessToken}`}:{},cache:"no-store"}),data=await response.json();if(active&&response.ok)setQuotes(data.quotes||{})}catch{}};refresh();const timer=window.setInterval(refresh,60000);return()=>{active=false;window.clearInterval(timer)}},[accessToken,symbols]);
  const save=async(symbol:string)=>{const value=limits[symbol]||{min:"",max:""},min=Number(value.min),max=Number(value.max);if(!Number.isFinite(min)||min<=0||!Number.isFinite(max)||max<=0||min>=max){setStatus(current=>({...current,[symbol]:"Enter positive prices; minimum must be below maximum."}));return}setStatus(current=>({...current,[symbol]:"Saving…"}));try{const response=await fetch("/api/watchlist",{method:"POST",headers:headers(),body:JSON.stringify({symbol,purpose:"Holding price limits",invalidationPrice:min,targetPrice:max,notes:"User-defined holding loss and profit review levels"})}),data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to save limits");setStatus(current=>({...current,[symbol]:"✓ Saved and monitored"}))}catch(error){setStatus(current=>({...current,[symbol]:error instanceof Error?error.message:"Unable to save limits"}))}};
  return <section className="holding-price-limits">
    <header><b>NORTHSTAR-CALCULATED PRICE LIMITS · DATABASE-SAVED ALERTS</b><span>Original purchase cost is kept separate from the live ask so you can always compare what you paid with the price available now. Defaults use live price plus the 50-day trend. Alerts never place an order.</span></header>
    {symbols.map(([symbol,holding])=>{
      const value=limits[symbol]||{min:"",max:""},shares=Number(holding.quantity||0),totalCost=holding.cost_basis_cents==null?null:Number(holding.cost_basis_cents)/100,averageCost=totalCost!==null&&shares>0?totalCost/shares:null,quote=quotes[symbol],currentAsk=Number(quote?.ask)||null,currentReference=currentAsk||(Number(quote?.last)||null),difference=averageCost!==null&&currentReference!==null?currentReference-averageCost:null,differencePct=difference!==null&&averageCost?difference/averageCost*100:null;
      return <div key={symbol}>
        <span><b>{symbol}</b><small>{String(holding.name||"Holding")}</small></span>
        <section className={`holding-cost-comparison ${difference===null?"missing":difference>=0?"gain":"loss"}`}>
          <span><small>ORIGINAL AVERAGE COST</small><b>{averageCost===null?"Not provided":`$${averageCost.toFixed(2)} / share`}</b><em>{totalCost===null?"Add the purchase cost in Accounts":`$${totalCost.toLocaleString(undefined,{maximumFractionDigits:2})} total cost`}</em></span>
          <i aria-hidden="true">→</i>
          <span><small>CURRENT ASK</small><b>{currentAsk===null?"Live ask unavailable":`$${currentAsk.toFixed(2)} / share`}</b><em>{quote?.timestamp?`Quote ${new Date(quote.timestamp).toLocaleString()}`:"Refreshes every 60 seconds"}</em></span>
          <strong>{difference===null?"Comparison needs cost and ask":`${difference>=0?"▲ ABOVE COST":"▼ BELOW COST"} · ${difference>=0?"+":"−"}$${Math.abs(difference).toFixed(2)} / share · ${differencePct!==null?`${differencePct>=0?"+":""}${differencePct.toFixed(2)}%`:"—"}`}</strong>
        </section>
        <label>Minimum loss-review price $<input type="number" min="0.01" step="0.01" value={value.min} placeholder="Calculating…" onChange={event=>{setLimits(current=>({...current,[symbol]:{...value,min:event.target.value}}));setStatus(current=>({...current,[symbol]:"Edited · save to start monitoring"}))}}/></label>
        <label>Maximum profit/sell-review price $<input type="number" min="0.01" step="0.01" value={value.max} placeholder="Calculating…" onChange={event=>{setLimits(current=>({...current,[symbol]:{...value,max:event.target.value}}));setStatus(current=>({...current,[symbol]:"Edited · save to start monitoring"}))}}/></label>
        <button onClick={()=>save(symbol)}>Save levels</button><em>{status[symbol]||"Calculating live defaults…"}</em>
      </div>
    })}
  </section>;
}
