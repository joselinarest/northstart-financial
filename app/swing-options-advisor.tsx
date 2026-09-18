"use client";

import { useMemo, useState } from "react";

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

export default function SwingOptionsAdvisor({
  accountId,
  accountName,
  accessToken,
  initialSymbol = "SPY",
  accountStatus = "ready",
  onConfigureAccount,
  onRefreshAccounts,
}: {
  accountId: string;
  accountName: string;
  accessToken?: string | null;
  initialSymbol?: string;
  accountStatus?: string;
  onConfigureAccount?: () => void;
  onRefreshAccounts?: () => void;
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [maxRisk, setMaxRisk] = useState(500);
  const [targetDte, setTargetDte] = useState(45);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<OptionResult[]>([]);
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken]);

  const analyze = async () => {
    const ticker = symbol.trim().toUpperCase();
    if (!accountId) {
      setNotice(accountStatus || "Select a Swing, Options, or Mixed account first.");
      return;
    }
    if (!ticker) return;
    setLoading(true);
    setNotice(`Comparing a defined-risk CALL and PUT for ${ticker} in ${accountName}…`);
    setResults([]);
    try {
      const settled = await Promise.allSettled(["bullish", "bearish"].map(async outlook => {
        const response = await fetch("/api/market/options", {
          method: "POST",
          headers,
          body: JSON.stringify({ accountId, symbol: ticker, outlook, maxRisk, targetDte }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || `${outlook} option analysis failed`);
        return body as OptionResult;
      }));
      const completed = settled.flatMap(item => item.status === "fulfilled" ? [item.value] : []);
      const errors = settled.flatMap(item => item.status === "rejected" ? [item.reason instanceof Error ? item.reason.message : "Option analysis failed"] : []);
      setResults(completed);
      setNotice(completed.length
        ? `${ticker}: CALL and PUT are evaluated independently. A candidate is not an order; act only when the displayed confirmation is satisfied.`
        : errors.join(" · ") || "No option contract passed the account and liquidity gates.");
    } finally {
      setLoading(false);
    }
  };

  return <section id="options-advisor" className="option-contract-advisor swing-options-advisor">
    <div className="option-advisor-head">
      <div>
        <span>SWING ACCOUNT · CALL / PUT DECISION SUPPORT</span>
        <h2>Options suggestions for {accountName}</h2>
        <p>Northstar keeps the share thesis and option thesis separate. It compares both directions using this account, current chain liquidity, Greeks, premium risk and independent evidence.</p>
      </div>
      <em>ANALYSIS ONLY · NO ORDER IS SENT</em>
    </div>
    {!accountId && <div className="option-account-required" role="alert"><div><b>Investment account data is unavailable</b><span>{accountStatus}</span></div><div><button type="button" onClick={onRefreshAccounts}>Refresh accounts</button><button type="button" onClick={onConfigureAccount}>Open account settings</button></div></div>}
    <div className="option-fields">
      <label>Underlying ticker<input value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 10))} /></label>
      <label>Expiration window<select value={targetDte} onChange={event => setTargetDte(Number(event.target.value))}><option value="21">About 21 DTE</option><option value="45">About 45 DTE</option><option value="60">About 60 DTE</option><option value="90">About 90 DTE</option></select></label>
      <label>Maximum premium risk<div className="money-input"><b>$</b><input type="number" min="50" step="50" value={maxRisk} onChange={event => setMaxRisk(Math.max(50, Number(event.target.value) || 50))} /></div></label>
      <button type="button" disabled={loading || !accountId} onClick={analyze}>{loading ? "Analyzing CALL + PUT…" : "Analyze CALL + PUT"}</button>
    </div>
    {notice && <div className="option-notice">{notice}</div>}
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
  </section>;
}