"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type OptionResult = {
  status: "CANDIDATE" | "NO_TRADE";
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
    premium: number;
    maxLoss: number;
    breakeven: number;
    liquidityQuality: string;
    score: number;
  };
  rationale: string[];
  warnings: string[];
  decision: {
    action: string;
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
}: {
  accountId: string;
  accountName: string;
  accessToken?: string | null;
  initialSymbol?: string;
  accountStatus?: string;
  onConfigureAccount?: () => void;
  onRefreshAccounts?: () => void;
  universeSymbols?: string[];
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [maxRisk, setMaxRisk] = useState(500);
  const [targetDte, setTargetDte] = useState(45);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<OptionResult[]>([]);
  const [rejections, setRejections] = useState<Array<{ symbol: string; reason: string }>>([]);
  const autoScanKey = useRef("");
  const [scanUniverse, setScanUniverse] = useState<string[]>([]);
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken]);

  const analyzeTickers = async (tickers: string[], automatic = false, settings?: { maxRisk: number; targetDte: number }) => {
    if (!accountId) { setNotice(accountStatus || "Select a Swing, Options, or Mixed account first."); return; }
    const unique = [...new Set(tickers.map(value => value.trim().toUpperCase()).filter(Boolean))].slice(0, 6);
    if (!unique.length) return;
    setLoading(true);
    setNotice(`${automatic ? "Scanning" : "Analyzing"} ${unique.length} underlying${unique.length === 1 ? "" : "s"} and both CALL / PUT chains for ${accountName}…`);
    setResults([]); setRejections([]);
    try {
      const response = await fetch("/api/market/options/scan", {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ accountId, symbols: unique, maxRisk: settings?.maxRisk ?? maxRisk, targetDte: settings?.targetDte ?? targetDte }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The options scan failed.");
      const completed = (Array.isArray(body.results) ? body.results : []).sort((a: OptionResult, b: OptionResult) => (b.decision.confidence + b.contract.score) - (a.decision.confidence + a.contract.score)) as OptionResult[];
      const rejected = Array.isArray(body.rejections) ? body.rejections : [];
      setResults(completed);
      setRejections(rejected);
      const actionable = completed.filter(item => item.status === "CANDIDATE" && item.decision.action === "BUY_IF").length;
      setNotice("Checked " + unique.length + " stock" + (unique.length === 1 ? "" : "s") + " in both directions. Found " + completed.length + " contract" + (completed.length === 1 ? "" : "s") + " worth reviewing; " + actionable + " " + (actionable === 1 ? "is" : "are") + " ready only if the stated conditions occur. " + rejected.length + " did not meet the safety rules. Same-day options are off.");
    } catch (error) {
      const message = error instanceof DOMException && error.name === "TimeoutError"
        ? "The scan took too long and was stopped. Your page is still usable; retry when market data is responding."
        : error instanceof Error ? error.message : "The options scan failed.";
      setResults([]);
      setRejections([]);
      setNotice(message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    const holdings = [...new Set(universeSymbols.map(value => value.toUpperCase()).filter(Boolean))];
    if (!accountId) { setScanUniverse(holdings.slice(0, 6)); return; }
    void (async () => {
      try {
        const response = await fetch("/api/market/candidates/discovery?accountId=" + encodeURIComponent(accountId) + "&strategy=ALL", { headers, signal: AbortSignal.timeout(8000) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Candidate discovery unavailable");
        const discovered = (Array.isArray(body.candidates) ? body.candidates : [])
          .filter((candidate: Record<string, unknown>) => candidate.status !== "REJECTED")
          .map((candidate: Record<string, unknown>) => String(candidate.symbol || "").toUpperCase())
          .filter(Boolean);
        const mixed: string[] = [];
        const limit = Math.max(holdings.length, discovered.length);
        for (let index = 0; index < limit; index += 1) {
          if (discovered[index]) mixed.push(discovered[index]);
          if (holdings[index]) mixed.push(holdings[index]);
        }
        if (!cancelled) setScanUniverse([...new Set(mixed)].slice(0, 6));
      } catch {
        if (!cancelled) setScanUniverse(holdings.slice(0, 6));
      }
    })();
    return () => { cancelled = true; };
  }, [accountId, headers, universeSymbols.join(",")]);

  const analyze = () => analyzeTickers([symbol]);
  const reset = async () => {
    const defaultSymbol = initialSymbol || universeSymbols[0] || "SPY";
    const accountUniverse = scanUniverse;
    setSymbol(defaultSymbol);
    setMaxRisk(500);
    setTargetDte(45);
    autoScanKey.current = "";
    await analyzeTickers(accountUniverse.length ? accountUniverse : [defaultSymbol], true, { maxRisk: 500, targetDte: 45 });
  };
  useEffect(() => {
    const tickers = scanUniverse;
    const key = `${accountId}:${tickers.join(",")}`;
    if (!accountId || !tickers.length || autoScanKey.current === key) return;
    autoScanKey.current = key;
    void analyzeTickers(tickers, true);
  }, [accountId, scanUniverse.join(",")]);
  return <section id="options-advisor" className="option-contract-advisor swing-options-advisor">
    <div className="option-advisor-head">
      <div>
        <span>OPTIONS REVIEW FOR THIS ACCOUNT</span>
        <h2>Options suggestions for {accountName}</h2>
        <p>Northstar first checks whether the stock has a strong enough setup. It then compares CALLs and PUTs and recommends a contract only when the direction, price, time remaining, trading quality, and account risk all agree.</p>
      </div>
      <em>ANALYSIS ONLY · NO ORDER IS SENT</em>
    </div>
    {!accountId && <div className="option-account-required" role="alert"><div><b>Investment account data is unavailable</b><span>{accountStatus}</span></div><div><button type="button" onClick={onRefreshAccounts}>Refresh accounts</button><button type="button" onClick={onConfigureAccount}>Open account settings</button></div></div>}
    <div className="option-fields">
      <label>Stock to analyze<input value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 10))} /></label>
      <label>How much time should it have?<select value={targetDte} onChange={event => setTargetDte(Number(event.target.value))}><option value="21">About 3 weeks</option><option value="45">About 6 weeks</option><option value="60">About 2 months</option><option value="90">About 3 months</option></select></label>
      <label>Most I am willing to lose<div className="money-input"><b>$</b><input type="number" min="50" step="50" value={maxRisk} onChange={event => setMaxRisk(Math.max(50, Number(event.target.value) || 50))} /></div></label>
      <button type="button" disabled={loading || !accountId} onClick={analyze}>{loading ? "Checking options…" : "Find options"}</button><button type="button" className="secondary" disabled={loading} onClick={reset}>Reset</button>
    </div>
    {notice && <div className="option-notice">{notice}</div>}
    {results.length > 0 && <div className="option-ranking-summary"><b>BEST OPTIONS SETUPS NOW</b><span>{results.filter(item => item.status === "CANDIDATE" && item.decision.action === "BUY_IF").length} actionable</span><b>WATCH / WAIT FOR TRIGGER</b><span>{results.filter(item => item.decision.action !== "BUY_IF").length} awaiting confirmation</span><b>NO TRADE / REJECTED</b><span>{rejections.length} rejected</span></div>}
    {results.length > 0 && <div className="swing-option-results">{results.map(result => {
      const actionable = result.status === "CANDIDATE" && !["WAIT", "NO_ACTION", "INSUFFICIENT_CONFIRMATION"].includes(result.decision.action);
      return <article className={`exact-contract option-recommendation ${actionable ? "candidate" : "no-trade"}`} key={result.contract.contractSymbol}>
        <div className="contract-verdict">
          <span>{actionable ? `${result.decision.action.replaceAll("_", " ")} · VERIFY BEFORE ACTING` : "NO OPTION TRADE · WAIT FOR CONFIRMATION"}</span>
          <h3>{result.underlying} {result.contract.type} · {result.contract.contractSymbol}</h3>
          <p>{result.contract.expiration} · {result.contract.dte} DTE · strike {money(result.contract.strike)} · underlying {money(result.underlyingPrice)}</p>
        </div>
        <div className="contract-metrics">
          <span><small>Account</small><b>{result.account.name}</b><em>{result.account.strategy}</em></span>
          <span><small>Suggested size</small><b>{actionable ? "1 contract" : "0 contracts"}</b><em>100-share multiplier</em></span>
          <span><small>Limit / ask</small><b>{money(result.contract.ask)}</b><em>{money(result.contract.premium)} total premium</em></span>
          <span><small>Maximum loss</small><b>{money(result.contract.maxLoss)}</b><em>100% of premium</em></span>
          <span><small>Breakeven</small><b>{money(result.contract.breakeven)}</b><em>At expiration</em></span>
          <span><small>Confidence</small><b>{result.decision.confidence}%</b><em>{result.decision.confidenceBand} · data {result.decision.dataQuality}/100</em></span>
          <span><small>Delta / theta</small><b>{result.contract.delta == null ? "—" : result.contract.delta.toFixed(2)} / {result.contract.theta == null ? "—" : result.contract.theta.toFixed(2)}</b><em>Direction and daily decay</em></span>
          <span><small>Liquidity</small><b>{result.contract.liquidityQuality}</b><em>{result.contract.spreadPct.toFixed(1)}% spread · volume {result.contract.volume}</em></span>
        </div>
        <div className="contract-explanation">
          <section><b>Why this result?</b>{result.rationale.map(reason => <p key={reason}>{reason}</p>)}</section>
          <section><b>Exact confirmation still required</b><p>{result.decision.interpretation}</p>{result.decision.whatWouldChange.map(item => <p key={item}>{item}</p>)}</section>
          <section><b>Invalidation / do not enter</b><p>{result.decision.invalidation}</p><p>Do not enter if the live spread, premium, underlying thesis, earnings risk, or account buying power no longer matches this snapshot.</p></section>
        </div>
        <footer>Data {new Date(result.asOf).toLocaleString()} · Options may lose 100% of premium. Northstar never executes the trade.</footer>
      </article>;
    })}</div>}
    {rejections.length > 0 && <section className="option-rejections"><header><b>NO OPTION TRADE RIGHT NOW</b><span>Northstar checked both directions but did not find a contract that fits your budget and safety rules.</span></header>{rejections.map((item, index) => <article key={`${item.symbol}-${index}`}><b>{item.symbol}</b><p>{explainRejection(item.reason, maxRisk)}</p><details><summary>Technical reason</summary><p>{item.reason}</p></details></article>)}</section>}  </section>;
}