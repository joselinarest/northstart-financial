"use client";

import HoldingCostBadge from "@/app/holding-cost-badge";
import OptionsVolatilityPanel from "@/app/options-volatility-panel";
import type {assessOptionVolatility} from "@/lib/options-volatility";
import { useEffect, useMemo, useRef, useState } from "react";

type OptionResult = {
  status: "CANDIDATE" | "NO_TRADE";
  decisionLabel?:string;
  volatility?:ReturnType<typeof assessOptionVolatility>;
  underlying: string;
  underlyingPrice: number;
  asOf: string;
  account: { id: string; name: string; strategy: string };
  contract: {
    contractSymbol: string;
    expiration: string;
    type: "CALL" | "PUT";
    strike: number;
    dte: number;
    bid: number;
    ask: number;
    spreadPct: number;
    delta: number | null;
    volume: number;
    openInterest: number | null;
    iv: number | null;
    theta: number | null;
    gamma?: number | null;
    vega?: number | null;
    rho?: number | null;
    premium: number;
    maxLoss: number;
    breakeven: number;
    liquidityQuality: string;
    score: number;
  };
  rationale: string[];
  warnings: string[];
  catalystGate?: {
    pass: boolean;
    status: "CLEAR" | "BLOCKED" | "UNAVAILABLE";
    summary: string;
    blockers: string[];
    confirmations: string[];
    nextEvent?: { label: string; date?: string | null; daysAway?: number | null } | null;
  };
  decision: {
    action: string;
    shares?:number;
    confidence: number;
    confidenceBand: string;
    interpretation: string;
    invalidation: string;
    reasoningFactors: string[];
    whatWouldChange: string[];
    dataQuality: number;
  };
};

const money = (value: number | null | undefined) =>
  value == null || !Number.isFinite(Number(value))
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));

const explainRejection = (reason: string, riskLimit: number) => {
  const direction = reason.includes(" PUT") ? "PUT" : "CALL";
  if (reason.includes("No contract passed expiration, quote, liquidity, and maximum-premium filters")) {
    return `No ${direction} is recommended right now. The available contracts were outside the selected time window, did not have a reliable live price, were too difficult to trade at a fair price, or cost more than your $${riskLimit.toLocaleString()} limit.`;
  }
  return `No ${direction} is recommended right now. Northstar could not verify a contract that fits this account and the selected risk limit.`;
};

export default function SwingOptionsAdvisor({
  accountId,
  accountName,
  accessToken,
  initialSymbol = "SPY",
  accountStatus = "ready",
  onConfigureAccount,
  onRefreshAccounts,
  universeSymbols = [],
  sessionOnly = false,
}: {
  accountId: string;
  accountName: string;
  accessToken?: string | null;
  initialSymbol?: string;
  accountStatus?: string;
  onConfigureAccount?: () => void;
  onRefreshAccounts?: () => void;
  universeSymbols?: string[];
  sessionOnly?: boolean;
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [maxRisk, setMaxRisk] = useState(0);
  const accountGeneration=useRef(0),defaultRiskAccount=useRef("");
  const [targetDte, setTargetDte] = useState(21);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<OptionResult[]>([]);
  const [rejections, setRejections] = useState<Array<{ symbol: string; reason: string }>>([]);
  const [outcomeFilter,setOutcomeFilter]=useState("ALL");
  const [accountPolicy,setAccountPolicy]=useState<Record<string,any>|null>(null);
  const [coverage,setCoverage]=useState<Record<string,any>|null>(null);
  const [screens,setScreens]=useState<Array<Record<string,any>>>([]);

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken]);

  const loadResults=async()=>{if(!accountId)return;const generation=accountGeneration.current;const response=await fetch('/api/market/options/scan?accountId='+encodeURIComponent(accountId),{headers});const body=await response.json();if(generation!==accountGeneration.current)return;if(!response.ok)throw Error(body.error||'Coverage unavailable');setResults(body.results||[]);setCoverage(body.coverage);setAccountPolicy(body.policy);setScreens(body.screens||[]);if(defaultRiskAccount.current!==accountId&&body.policy){setMaxRisk(Math.max(0,Math.floor(body.policy.premiumCap||0)));defaultRiskAccount.current=accountId;}};
  useEffect(()=>{accountGeneration.current++;setResults([]);setCoverage(null);setScreens([]);setAccountPolicy(null);setNotice('');setMaxRisk(0);defaultRiskAccount.current='';let active=true;const load=()=>{if(active)void loadResults().catch(e=>{if(active)setNotice(e.message)});};load();const timer=setInterval(load,15000);return()=>{active=false;accountGeneration.current++;clearInterval(timer)};},[accountId,headers]);
  const analyze=async()=>{if(!accountId)return;setLoading(true);try{const response=await fetch('/api/market/options/scan',{method:'POST',headers,body:JSON.stringify({accountId,symbol,maxRisk,targetDte})});const body=await response.json();if(!response.ok)throw Error(body.error);setNotice(body.symbol+' · '+body.message);await loadResults();}catch(e){setNotice(e instanceof Error?e.message:'Analysis unavailable')}finally{setLoading(false)}};
  const reset=()=>{setMaxRisk(Math.floor(accountPolicy?.premiumCap||0));setTargetDte(21);void loadResults().catch(e=>setNotice(e.message));};
  if(sessionOnly){const candidates=results.filter(item=>item.status==='CANDIDATE'&&item.contract&&item.decision.action==='BUY_IF');return <section className="border-t border-line p-4" aria-label="Session options"><h3>Options</h3>{notice?<p role="status">Options analysis unavailable: {notice}</p>:!accountPolicy?<p>Loading options analysis…</p>:!candidates.length?<p>{accountPolicy.optionsEnabled?'No option setup meets quality and risk thresholds.':'Options are disabled for this account.'}</p>:candidates.map(item=><article className="my-3 rounded-lg border border-line p-4" key={item.contract.contractSymbol}><b>{item.underlying} · {item.contract.type} IF CONFIRMED</b><p>{item.contract.strike} strike · {item.contract.expiration} · {item.contract.dte} days</p><p>{item.decision.interpretation}</p><p>Premium {money(item.contract.premium)} · Maximum premium risk {money(item.contract.maxLoss)}</p><HoldingCostBadge symbol={item.underlying} currentPrice={item.underlyingPrice}/><p>Confirmation: {item.decision.whatWouldChange.join(' · ')}</p></article>)}<a href="/workspace/options">Open options research →</a></section>}
  return <section id="options-advisor" className="option-contract-advisor swing-options-advisor">
    <div className="option-advisor-head">
      <div>
        <span>OPTIONS REVIEW FOR THIS ACCOUNT</span>
        <h2>Options suggestions for {accountName}</h2>
        <p>Northstar first checks whether the stock has a strong enough setup. It then compares CALLs and PUTs and recommends a contract only when the direction, price, time remaining, trading quality, and account risk all agree.</p>
      </div>
      <em>ANALYSIS ONLY · NO ORDER IS SENT</em>
    </div>
    {accountPolicy&&<div role="note" className="option-account-policy"><b>{accountPolicy.optionsEnabled?'Options enabled · account risk checks required':'Options trading suggestions disabled for this account'}</b><p>Broad-market research remains available. {accountPolicy.optionsEnabled?('Account premium cap: '+money(accountPolicy.premiumCap)):"No contract entry will be suggested until you explicitly enable options in account settings."}</p><a href="/workspace/configuration">Review this account’s risk settings</a></div>}
    {!accountId && <div className="option-account-required" role="alert"><div><b>Investment account data is unavailable</b><span>{accountStatus}</span></div><div><button type="button" onClick={onRefreshAccounts}>Refresh accounts</button><button type="button" onClick={onConfigureAccount}>Open account settings</button></div></div>}
    <div className="option-fields">
      <label>Stock to analyze<input value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 10))} /></label>
      <label>How much time should it have?<select value={targetDte} onChange={event => setTargetDte(Number(event.target.value))}><option value="14">About 2 weeks</option><option value="21">About 3 weeks</option><option value="30">Up to 30 days · maximum</option></select></label>
      <label>Most I am willing to lose<div className="money-input"><b>$</b><input type="number" min="0" step="1" value={maxRisk} onChange={event => setMaxRisk(Math.max(0, Number(event.target.value) || 0))} /></div></label>
      <button type="button" disabled={loading || !accountId} onClick={analyze}>{loading ? "Checking options…" : "Find options"}</button><button type="button" className="secondary" disabled={loading} onClick={reset}>Reset</button>
    </div>
    <section aria-label="Broad market options scan" className="my-4 rounded-xl border border-line p-4"><h3>Broad-market discovery · server monitored</h3><p>Every supported active stock enters the rotating price/liquidity screen. Deep chain and account research follow qualifying screens. No fixed popular-stock list. Coverage below counts completed work, not promised coverage.</p>{coverage?<div className="flex flex-wrap gap-5">{Object.entries(coverage).filter(([k])=>k!=='last_scan').map(([k,v])=><span key={k}><b>{String(v??'—')}</b> {k.replaceAll('_',' ')}</span>)}<time>Last scan {coverage.last_scan?new Date(coverage.last_scan).toLocaleString():'Not yet run'}</time></div>:<p>Coverage unavailable or awaiting first server scan.</p>}<details><summary>Recent screening outcomes ({screens.length} shown)</summary>{screens.map(row=><p key={row.symbol}><b>{row.symbol} · {row.stage||'NOT_SCANNED'}</b> — {row.reason||'Awaiting screen'}</p>)}</details></section>
    {notice && <div className="option-notice">{notice}</div>}
    {results.length > 0 && <div className="option-ranking-summary" aria-label="Options scan summary"><span><b>{results.filter(item => item.status === "CANDIDATE" && item.decision.action === "BUY_IF").length}</b>Ready if trigger confirms</span><span><b>{results.filter(item => item.decision.action !== "BUY_IF").length}</b>Watch or wait</span><span><b>{rejections.length}</b>Rejected by safety rules</span></div>}
    <label className="m-4 block">Research outcome <select value={outcomeFilter} onChange={e=>setOutcomeFilter(e.target.value)}>{['ALL','CALL SETUP','PUT SETUP','SHARES PREFERRED','WAIT','NO OPTION TRADE'].map(v=><option key={v}>{v}</option>)}</select></label>
    {!results.length&&<p className="m-4" role="status">No completed account-specific option analyses yet. The server is processing the broad-market queue; use Find options to prioritize a ticker. This is pending research, not a conclusion that every stock is unsuitable.</p>}
    {results.length > 0 && <div className="swing-option-results">{results.filter(r=>outcomeFilter==='ALL'||r.decisionLabel===outcomeFilter).map((result, rank) => {
      if(!result.contract)return <article className="exact-contract option-recommendation no-trade option-research-card" data-outcome={result.decisionLabel||"NO OPTION TRADE"} key={result.underlying+rank}><header className="option-research-heading"><div><span className="option-outcome"><span aria-hidden="true">{result.decisionLabel==="SHARES PREFERRED"?"↗":"Ⅱ"}</span> {result.decisionLabel||"NO OPTION TRADE"}</span><h3>{result.underlying}</h3><small>{result.account.name}</small></div><span className="option-order-state">No option order</span></header><div className="option-research-body"><p className="option-main-reason">{result.decision.interpretation}</p><HoldingCostBadge symbol={result.underlying} accountId={accountId} currentPrice={result.underlyingPrice}/><section className="option-next-step"><h4>What needs to change?</h4><ul>{[...new Set(result.decision.whatWouldChange)].slice(0,3).map((reason,i)=><li key={i}>{reason}</li>)}</ul></section><details className="option-research-evidence"><summary>Evidence, volatility &amp; risk details</summary><div>{[...new Set(result.rationale)].map((reason,i)=><p key={i}>{reason}</p>)}<OptionsVolatilityPanel assessment={result.volatility}/></div></details><a className="option-underlying-link" href={"/workspace/charts?symbol="+encodeURIComponent(result.underlying)+"&accountId="+encodeURIComponent(accountId)}>Analyze {result.underlying} on chart <span aria-hidden="true">→</span></a></div><footer>Evaluated {new Date(result.asOf).toLocaleString()}</footer></article>;
      const actionable = result.status === "CANDIDATE" && !["WAIT", "NO_ACTION", "INSUFFICIENT_CONFIRMATION"].includes(result.decision.action);
      const actionLabel = actionable ? `${result.contract.type} SETUP` : result.catalystGate?.status === "BLOCKED" || result.catalystGate?.status === "UNAVAILABLE" ? "WAIT FOR CATALYST" : "NO OPTION TRADE";
      return <article className={`exact-contract option-recommendation ${actionable ? "candidate" : "no-trade"}`} key={result.contract.contractSymbol}>
        <div className="option-decision-hero">
          <div><span>#{rank + 1} · {result.account.name}</span><strong>{actionLabel}</strong><h3>{result.underlying} {result.contract.type} · {money(result.contract.strike)} strike</h3><p>{result.contract.expiration} · {result.contract.dte} days remaining · underlying {money(result.underlyingPrice)}</p></div>
          <b className={actionable ? "ready" : "wait"}>{result.decision.confidence}%<small>confidence</small></b>
        </div>
        <HoldingCostBadge symbol={result.underlying} accountId={accountId} currentPrice={result.underlyingPrice}/><div className="option-essential-facts">
          <span><small>Contracts</small><b>{actionable ? String(result.decision.shares||0) : "0"}</b><em>{actionable ? "Defined-risk position" : "No position yet"}</em></span>
          <span><small>Entry premium</small><b>{money(result.contract.ask)}</b><em>{money(result.contract.premium)} total cost</em></span>
          <span><small>Maximum loss</small><b>{money(result.contract.maxLoss)}</b><em>Premium at risk</em></span>
          <span><small>Break-even</small><b>{money(result.contract.breakeven)}</b><em>At expiration</em></span>
        </div>
        <section className="rounded-lg border border-line bg-soft p-3"><h4>Greeks · contract price sensitivity</h4><div className="contract-metrics">{([["Delta",result.contract.delta,"Sensitivity to underlying price"],["Gamma",result.contract.gamma,"Change in Delta as underlying moves"],["Theta",result.contract.theta,"Time decay"],["Vega",result.contract.vega,"Sensitivity to implied volatility"],["Rho",result.contract.rho,"Sensitivity to interest rates"]] as const).map(([label,value,description])=><span key={label}><small>{label}</small><b>{value==null?"Unavailable":value.toFixed(4)}</b><em>{description}</em></span>)}</div><p>Vega measures how the option premium responds to implied volatility. Falling IV can reduce a long option’s value even when the stock moves in the expected direction. Greeks are local estimates and change with price, volatility and time.</p></section><OptionsVolatilityPanel assessment={result.volatility}/>
        <section className={`option-catalyst-gate ${result.catalystGate?.status?.toLowerCase() || "unavailable"}`}>
          <div><small>CATALYST / EVENT GATE</small><b>{result.catalystGate?.status || "UNAVAILABLE"}</b></div>
          <p>{result.catalystGate?.summary || "Current news and earnings coverage must load before an option entry can qualify."}</p>
          {result.catalystGate?.nextEvent && <strong>{result.catalystGate.nextEvent.label}</strong>}
        </section>
        <section className="option-required-trigger"><small>EXACT ACTION CONDITION</small><b>{result.decision.interpretation}</b><p>{result.decision.invalidation}</p></section>
        <details className="option-full-analysis">
          <summary>Full contract analysis and Greeks</summary>
          <div className="contract-metrics">
            <span><small>Exact contract</small><b>{result.contract.contractSymbol}</b><em>{result.contract.expiration}</em></span>
            <span><small>Bid / ask</small><b>{money(result.contract.bid)} / {money(result.contract.ask)}</b><em>{result.contract.spreadPct.toFixed(1)}% spread</em></span>
            <span><small>Delta / theta</small><b>{result.contract.delta == null ? "—" : result.contract.delta.toFixed(2)} / {result.contract.theta == null ? "—" : result.contract.theta.toFixed(2)}</b><em>Direction / daily decay</em></span>
            <span><small>IV / liquidity</small><b>{result.contract.iv == null ? "—" : `${(result.contract.iv * 100).toFixed(1)}%`} · {result.contract.liquidityQuality}</b><em>Volume {result.contract.volume}</em></span>
            <span><small>Data quality</small><b>{result.decision.dataQuality}/100</b><em>{result.decision.confidenceBand}</em></span>
          </div>
          <div className="contract-explanation">
            <section><b>Why this result?</b>{result.rationale.map(reason => <p key={reason}>{reason}</p>)}</section>
            <section><b>What still must happen?</b>{result.decision.whatWouldChange.map(item => <p key={item}>{item}</p>)}</section>
            <section><b>What can go wrong?</b>{result.warnings.map(item => <p key={item}>{item}</p>)}</section>
          </div>
        </details>
        <footer>Data {new Date(result.asOf).toLocaleString()} · Analysis only; Northstar never sends an order.</footer>
      </article>;
    })}</div>}    {rejections.length > 0 && <section className="option-rejections"><header><b>NO OPTION TRADE RIGHT NOW</b><span>Northstar checked both directions but did not find a contract that fits your budget and safety rules.</span></header>{rejections.map((item, index) => <article key={`${item.symbol}-${index}`}><b>{item.symbol}</b><p>{explainRejection(item.reason, maxRisk)}</p><details><summary>Technical reason</summary><p>{item.reason}</p></details></article>)}</section>}  </section>;
}