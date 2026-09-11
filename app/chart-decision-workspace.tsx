"use client";

import {useEffect, useMemo, useState} from "react";

type Props={symbol:string;strategy:"swing"|"position";accountName:string;accountValue:number;cashAvailable:number;ownedShares:number;ownedValue:number;price:number;bid:number|null;ask:number|null;relativeVolume:number;confidence:number;support:number;resistance:number;entryLow:number;entryHigh:number;stop:number;target1:number;target2:number;fresh:boolean};
type Research={status?:string;asOf?:string;profile?:Record<string,any>;metrics?:Record<string,any>;news?:Array<Record<string,any>>;filings?:Array<Record<string,any>>;error?:string};

const money=(value:number)=>`$${value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const metric=(data:Record<string,any>|undefined,...keys:string[])=>{for(const key of keys){const value=Number(data?.[key]);if(Number.isFinite(value))return value}return null};

export default function ChartDecisionWorkspace(props:Props){
  const [research,setResearch]=useState<Research|null>(null),[loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;const load=async()=>{setLoading(true);try{const response=await fetch(`/api/market/research?symbol=${encodeURIComponent(props.symbol)}`,{cache:"no-store"}),data=await response.json();if(active)setResearch(data)}catch{if(active)setResearch({status:"unavailable",error:"Company research is temporarily unavailable."})}finally{if(active)setLoading(false)}};load();const timer=setInterval(load,60000);return()=>{active=false;clearInterval(timer)}},[props.symbol]);
  const decision=useMemo(()=>{
    const riskPerShare=Math.max(.01,props.price-props.stop),riskBudget=Math.max(0,props.accountValue*.005),riskShares=Math.floor(riskBudget/riskPerShare),cashShares=Math.floor(Math.max(0,props.cashAvailable)/(props.ask||props.price||1)),positionLimit=Math.max(0,props.accountValue*.10-props.ownedValue),fitShares=Math.floor(positionLimit/(props.ask||props.price||1)),shares=Math.max(0,Math.min(riskShares,cashShares,fitShares));
    const liquid=props.bid!==null&&props.ask!==null&&props.ask>=props.bid&&((props.ask-props.bid)/props.price)<.005;
    const trend=props.price>props.support&&props.price<=props.resistance*1.03,confirmation=props.confidence>=60&&props.relativeVolume>=1.05;
    const evidenceReady=research?.status==="connected"&&props.fresh;
    let action="WAIT FOR EVIDENCE",reason="Current data is incomplete; no actionable price should be inferred.";
    if(!props.fresh){action="WAIT · REFRESH MARKET DATA";reason="The quote is not fresh enough for a time-sensitive decision."}
    else if(props.price<=props.stop){action=props.ownedShares>0?"REDUCE / EXIT REVIEW":"DO NOT ENTER";reason="Price is below the calculated invalidation level."}
    else if(!evidenceReady){action="WATCH · RESEARCH FEED REQUIRED";reason="Price is current, but fundamentals, valuation, news, and event checks are incomplete."}
    else if(props.strategy==="swing"&&confirmation&&liquid&&shares>0){action=`BUY ON CONFIRMATION · UP TO ${shares} SHARE${shares===1?"":"S"}`;reason="Trend, relative volume, liquidity, account fit, and risk sizing currently align."}
    else if(props.strategy==="position"&&trend&&shares>0){action=`ACCUMULATE IN STAGES · ${Math.max(1,Math.ceil(shares/3))} SHARE${Math.ceil(shares/3)===1?"":"S"} NEXT`;reason="The position fits the account limit; stage the entry inside the calculated zone instead of buying all at once."}
    else if(props.ownedShares>0){action="HOLD / MONITOR";reason="The holding has not broken invalidation, but a new purchase lacks full confirmation."}
    return{action,reason,shares,riskBudget,riskPerShare,liquid};
  },[props,research]);
  const m=research?.metrics,pe=metric(m,"peBasicExclExtraTTM","peTTM"),marketCap=metric(m,"marketCapitalization"),revenueGrowth=metric(m,"revenueGrowth5Y","revenueGrowthTTMYoy"),epsGrowth=metric(m,"epsGrowth5Y","epsGrowthTTMYoy"),margin=metric(m,"netProfitMarginTTM"),roe=metric(m,"roeTTM"),debtEquity=metric(m,"totalDebt/totalEquityQuarterly","totalDebtToEquityQuarterly"),news=Array.isArray(research?.news)?research!.news!.slice(0,3):[];
  return <section className="chart-decision-workspace">
    <header><div><p>COMPLETE STOCK DECISION · REFRESHES EVERY MINUTE</p><h3>{props.symbol} · What the evidence supports now</h3><span>{props.accountName} · {props.strategy==="swing"?"Swing setup":"Long-term position"}</span></div><strong className={decision.action.startsWith("BUY")||decision.action.startsWith("ACCUMULATE")?"go":decision.action.includes("REDUCE")||decision.action.includes("DO NOT")?"stop":"wait"}>{decision.action}</strong></header>
    <div className="decision-command"><b>{decision.reason}</b><span>{props.strategy==="swing"?`Entry ${money(props.entryLow)}–${money(props.entryHigh)} only after confirmation. Stop ${money(props.stop)}. Targets ${money(props.target1)} / ${money(props.target2)}.`:`Preferred accumulation zone ${money(props.entryLow)}–${money(props.entryHigh)}. Reassess below ${money(props.stop)} and near ${money(props.target1)}.`}</span><small>Capital source: {props.cashAvailable>0?"available cash in the selected account":"no verified account cash—do not fund from emergency reserves"}. This creates guidance only and never sends an order.</small></div>
    <div className="decision-evidence-grid">
      <article><span>MARKET & LIQUIDITY</span><b>{props.fresh?"Current quote":"Stale / unavailable"}</b><p>Bid {props.bid?money(props.bid):"—"} · Ask {props.ask?money(props.ask):"—"} · Relative volume {props.relativeVolume.toFixed(2)}×</p><em className={decision.liquid?"pass":"review"}>{decision.liquid?"Spread passes liquidity check":"Liquidity needs review"}</em></article>
      <article><span>TECHNICAL SETUP</span><b>{props.confidence}% evidence confidence</b><p>Support {money(props.support)} · Resistance {money(props.resistance)} · Risk/share {money(decision.riskPerShare)}</p><em className={props.confidence>=60?"pass":"review"}>{props.confidence>=60?"Structure supports monitoring":"Wait for stronger alignment"}</em></article>
      <article><span>PORTFOLIO FIT & SIZE</span><b>{props.ownedShares.toLocaleString()} shares currently owned</b><p>{money(props.ownedValue)} position · {props.accountValue?`${(props.ownedValue/props.accountValue*100).toFixed(1)}% of account`:"account value unavailable"}</p><em className={decision.shares>0?"pass":"review"}>Risk-sized maximum: {decision.shares} shares · {money(decision.riskBudget)} risk budget</em></article>
      <article><span>FUNDAMENTALS</span><b>{research?.profile?.name||props.symbol}</b><p>Revenue growth {revenueGrowth===null?"—":`${revenueGrowth.toFixed(1)}%`} · EPS growth {epsGrowth===null?"—":`${epsGrowth.toFixed(1)}%`} · Margin {margin===null?"—":`${margin.toFixed(1)}%`} · ROE {roe===null?"—":`${roe.toFixed(1)}%`}</p><em className={revenueGrowth!==null&&epsGrowth!==null?"pass":"review"}>{revenueGrowth!==null&&epsGrowth!==null?"Growth evidence received":"Provider evidence incomplete"}</em></article>
      <article><span>VALUATION & BALANCE SHEET</span><b>P/E {pe===null?"—":pe.toFixed(1)}</b><p>Market cap {marketCap===null?"—":`$${marketCap.toLocaleString()}M`} · Debt/equity {debtEquity===null?"—":debtEquity.toFixed(1)}</p><em className={pe!==null&&marketCap!==null?"pass":"review"}>{pe!==null?"Compare with history and peers":"Valuation data required"}</em></article>
      <article><span>NEWS & EVENT RISK</span><b>{news.length?`${news.length} recent items loaded`:"No verified headlines loaded"}</b><p>{news[0]?.headline||"Earnings, guidance, filings, and material news must be checked before acting."}</p><em className={news.length?"pass":"review"}>{research?.asOf?`Checked ${new Date(research.asOf).toLocaleTimeString()}`:"Research feed unavailable"}</em></article>
    </div>
    <details><summary>Show recent news, filings, and complete evidence</summary>{loading?<p>Refreshing company evidence…</p>:research?.error?<p>{research.error}</p>:<div className="decision-news">{news.map((item,index)=><a key={item.id||index} href={item.url||"#"} target="_blank" rel="noreferrer"><b>{item.headline||"Company update"}</b><span>{item.source||"Verified provider"}</span></a>)}<p>{Array.isArray(research?.filings)?`${research!.filings!.length} recent filing records available.`:"Filing feed unavailable."}</p></div>}</details>
  </section>;
}
