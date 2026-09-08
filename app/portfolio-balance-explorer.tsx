"use client";

import { useMemo, useState } from "react";

type Bucket = "cash" | "bonds" | "diversified" | "dividend" | "growth";
type Row = { key: Bucket; label: string; actual: number; target: number; delta: number; status: string; amount: number };
type Holding = { ticker: string; name: string; value: number; quantity?: number; price?: number; bucket: Bucket; weight: number; isFund?: boolean; severity?: string; verdict?: string; action?: string };
type Candidate = { symbol: string; name: string; adjusted: number; accountWhy: string; isHeld: boolean; sizeAtLimit: boolean; gap: number | null; price?: number; risk?: string; subcategory?: string; metric?: string };
type DisplayCandidate = { symbol: string; name: string; why: string; price?: number };

const meta: Record<Bucket, { label: string; color: string; outlook: string; candidates: DisplayCandidate[] }> = {
  cash: { label: "Cash", color: "#b7a36a", outlook: "Stability for near-term needs, normally with the lowest growth potential.", candidates: [{ symbol: "SGOV", name: "iShares 0–3 Month Treasury Bond ETF", why: "ACTION: CASH-RESERVE REVIEW. Short U.S. Treasury exposure can fill the stability slice when the account permits ETFs. Verify yield, fee, liquidity, account eligibility, and tax treatment." }, { symbol: "BIL", name: "SPDR Bloomberg 1–3 Month T-Bill ETF", why: "ACTION: CASH-RESERVE ALTERNATIVE. Compare its current yield, fee, spread, and plan availability with SGOV and the account’s stable-value or money-market option." }] },
  bonds: { label: "Bonds", color: "#587a91", outlook: "Income and lower volatility, while interest-rate and credit risk still apply.", candidates: [{ symbol: "BND", name: "Vanguard Total Bond Market ETF", why: "ACTION: CORE-BOND REVIEW. Broad investment-grade U.S. bond exposure. Verify duration, yield, fee, drawdown, account access, and overlap before adding." }, { symbol: "AGG", name: "iShares Core U.S. Aggregate Bond ETF", why: "ACTION: CORE-BOND ALTERNATIVE. Compare duration, yield, credit mix, expense ratio, and availability with BND and the account’s own bond-index option." }] },
  diversified: { label: "Base / diversified", color: "#176f57", outlook: "Broad-market participation intended to reduce company-specific risk.", candidates: [{ symbol: "VTI", name: "Vanguard Total Stock Market ETF", why: "Broad U.S. market coverage; verify account availability, overlap, fee, valuation, and current trend." }, { symbol: "VOO", name: "Vanguard S&P 500 ETF", why: "Large-cap U.S. core exposure; compare with existing broad funds before adding." }] },
  dividend: { label: "Dividend growth", color: "#3e9b70", outlook: "Income and dividend growth; yield, payout coverage, valuation, and quality require review.", candidates: [{ symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", why: "Dividend-quality screen; verify yield, dividend growth, payout durability, valuation, overlap, and plan access." }, { symbol: "DGRO", name: "iShares Core Dividend Growth ETF", why: "Diversified dividend-growth approach; compare expense ratio and holdings with the current portfolio." }] },
  growth: { label: "Growth companies", color: "#75bc8d", outlook: "Higher growth potential with larger possible drawdowns; fundamentals and valuation require verification.", candidates: [{ symbol: "VUG", name: "Vanguard Growth ETF", why: "ACTION: DIVERSIFIED-GROWTH REVIEW. A broad large-cap growth candidate for the growth slice. Verify valuation, five-year growth, drawdown, fee, overlap, and account availability." }, { symbol: "QQQM", name: "Invesco NASDAQ 100 ETF", why: "ACTION: HIGHER-GROWTH REVIEW. Concentrated technology and growth exposure may increase upside and drawdown. Verify valuation, sector concentration, five-year evidence, fee, and position size." }, { symbol: "SCHG", name: "Schwab U.S. Large-Cap Growth ETF", why: "ACTION: GROWTH ALTERNATIVE. Compare its valuation, holdings overlap, historical drawdown, fee, and trend with VUG before choosing one." }] },
};

const point = (angle: number, radius: number) => { const radians = (angle - 90) * Math.PI / 180; return { x: 50 + radius * Math.cos(radians), y: 50 + radius * Math.sin(radians) }; };
const arc = (start: number, end: number) => { const a = point(start, 44), b = point(end, 44), ib = point(end, 23), ia = point(start, 23); return `M ${a.x} ${a.y} A 44 44 0 ${end - start > 180 ? 1 : 0} 1 ${b.x} ${b.y} L ${ib.x} ${ib.y} A 23 23 0 ${end - start > 180 ? 1 : 0} 0 ${ia.x} ${ia.y} Z`; };

export default function PortfolioBalanceExplorer({ rows, holdings, candidates, accountName, horizon, portfolioAmount, low, base, high }: { rows: Row[]; holdings: Holding[]; candidates: Candidate[]; accountName: string; horizon: string; portfolioAmount: number; low: number; base: number; high: number }) {
  const [selected, setSelected] = useState<Bucket>(() => rows.filter(item => item.status === "underweight").sort((a, b) => b.amount - a.amount)[0]?.key || "diversified");
  const [hovered, setHovered] = useState<Bucket | null>(null);
  const storageKey = `northstar-portfolio-candidate-plan-${accountName}`;
  const [savedSymbols, setSavedSymbols] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]").map((item: { symbol: string }) => item.symbol); } catch { return []; }
  });
  const active = hovered || selected;
  const row = rows.find(item => item.key === selected);
  const activeRow = rows.find(item => item.key === active);
  const items = holdings.filter(item => item.bucket === selected);
  const destinations = rows.filter(item => item.status === "underweight").sort((a, b) => b.amount - a.amount);
  const baseInfo = meta[selected];
  const liveCandidates = candidates.filter(candidate => {
    const text = `${candidate.symbol} ${candidate.name} ${candidate.subcategory || ""} ${candidate.metric || ""}`.toUpperCase();
    if (selected === "dividend") return /SCHD|DGRO|VYM|DIVIDEND|INCOME/.test(text);
    if (selected === "diversified") return /ETF|INDEX|MARKET|VTI|VOO|SPY|IVV/.test(text) && !/SCHD|DGRO|VYM|DIVIDEND/.test(text);
    if (selected === "growth") return !/BOND|CASH|MONEY MARKET|SCHD|DGRO|VYM|DIVIDEND/.test(text);
    return false;
  }).slice(0, 3);
  const info = {
    ...baseInfo,
    candidates: selected === "cash" || selected === "bonds" || liveCandidates.length === 0 ? baseInfo.candidates : liveCandidates.map(candidate => ({
      symbol: candidate.symbol,
      name: candidate.name,
      why: `${candidate.sizeAtLimit ? "ACTION: DO NOT BUY MORE — position-size limit reached." : candidate.gap !== null && candidate.gap > 25 ? "ACTION: WAIT — current price is materially above modeled fair value." : candidate.adjusted >= 75 ? candidate.isHeld ? "ACTION: BUY-MORE REVIEW after full confirmation." : "ACTION: NEW-POSITION REVIEW after full confirmation." : "ACTION: MONITOR — evidence is not strong enough yet."} ${candidate.adjusted}/100 account-adjusted score. ${candidate.accountWhy}`,
      price: candidate.price,
    })),
  };
  const slices = useMemo(() => { let cursor = 0; return rows.map(item => { const start = cursor, end = cursor + item.target / 100 * 360; cursor = end; return { ...item, start, end }; }); }, [rows]);
  const planningYears = horizon.includes("5") ? 5 : Math.max(1, Number(horizon.match(/\d+/)?.[0] || 5));
  const planningAnnualRate = portfolioAmount > 0 && base > 0 ? Math.pow(base / portfolioAmount, 1 / planningYears) - 1 : 0.07;
  const requiredAnnualReturn = portfolioAmount > 0 ? Math.pow(1_000_000 / portfolioAmount, 1 / planningYears) - 1 : 0;
  const monthlyRate = planningAnnualRate / 12;
  const months = planningYears * 12;
  const futureWithoutContributions = portfolioAmount * Math.pow(1 + monthlyRate, months);
  const requiredMonthlyContribution = monthlyRate > 0 ? Math.max(0, (1_000_000 - futureWithoutContributions) * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1)) : Math.max(0, (1_000_000 - portfolioAmount) / months);

  function addToPlan(candidate: DisplayCandidate) {
    if (!row || typeof window === "undefined") return;
    let existing: Array<Record<string, unknown>> = [];
    try { existing = JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { existing = []; }
    const entry = { symbol: candidate.symbol, name: candidate.name, category: selected, accountName, proposedAmount: Math.max(0, row.amount), status: "research-before-buy", addedAt: new Date().toISOString() };
    const next = [...existing.filter(item => item.symbol !== candidate.symbol), entry];
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSavedSymbols(next.map(item => String(item.symbol)));
  }

  return <details className="portfolio-balance-explorer" open>
    <summary><i>Show / hide</i></summary>
    <div className="interactive-balance-main"><div className="interactive-target-pie">
      <svg viewBox="0 0 100 100" role="img" aria-label={`Interactive target allocation for ${accountName}`}>{slices.map(slice => <path key={slice.key} d={arc(slice.start, slice.end)} fill={meta[slice.key].color} className={active === slice.key ? "active" : ""} tabIndex={0} role="button" aria-label={`${meta[slice.key].label}: ${slice.target}% target, ${slice.actual.toFixed(1)}% current`} onMouseEnter={() => setHovered(slice.key)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(slice.key)} onBlur={() => setHovered(null)} onClick={() => setSelected(slice.key)} />)}</svg>
      <div><b>{activeRow?.target || 0}%</b><span>{meta[active].label}</span><small>{activeRow?.actual.toFixed(1)}% current</small></div>
    </div></div>
    {row && <section className={`balance-category-detail ${row.status}`}>
      <header><div><span>{info.label.toUpperCase()} · {accountName.toUpperCase()}</span><h4>{row.status === "underweight" ? "Below target — contribution review" : row.status === "overweight" ? "Above target — stop adding / trim review" : "Near target — keep and monitor"}</h4></div><strong>{row.delta >= 0 ? "+" : ""}{row.delta.toFixed(1)}%<small>{row.delta >= 0 ? "needed" : "above target"}</small></strong></header>
      <div className="balance-detail-grid"><article><b>Current</b><strong>{row.actual.toFixed(1)}%</strong></article><article><b>Target</b><strong>{row.target}%</strong></article><article><b>Dollar gap</b><strong>${row.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></article><article><b>Future horizon</b><strong>{horizon}</strong></article></div>
      <p><b>Outlook:</b> {info.outlook}</p>
      <div className="balance-holdings"><b>Current holdings in this slice</b>{items.length ? items.map(item => {
        const sliceTotal = items.reduce((sum, holding) => sum + holding.value, 0);
        const adjustment = row.amount * (sliceTotal > 0 ? item.value / sliceTotal : 0);
        const securityClearedForAdd = Boolean(item.isFund) && item.severity !== "risk";
        const shares = securityClearedForAdd && item.price && item.price > 0 ? adjustment / item.price : null;
        const direction = row.status === "overweight" ? "SELL / TRIM REVIEW" : row.status === "balanced" ? "KEEP / MONITOR" : securityClearedForAdd ? "BUY / CONTRIBUTE REVIEW" : "AUTOMATIC SECURITY REVIEW";
        const actionClass = row.status === "underweight" && !securityClearedForAdd ? "blocked" : row.status;
        return <span key={`${item.ticker}-${item.name}`}><strong>{item.ticker || "—"}<small>{item.name}</small><small className={`holding-balance-action ${actionClass}`}>{direction}</small>{row.status === "underweight" && !securityClearedForAdd && <small className="holding-decision-reason">Northstar automatically runs the complete valuation, fundamentals, trend, and risk review below. The category gap alone cannot authorize buying this individual security.</small>}</strong><em>${item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}<small>{item.weight.toFixed(1)}% of account</small>{row.status !== "balanced" && securityClearedForAdd && <small className="holding-share-guide">About ${adjustment.toLocaleString(undefined, { maximumFractionDigits: 0 })}{shares !== null ? ` · ${shares.toFixed(shares < 1 ? 2 : 1)} shares` : " · shares require current price"}</small>}</em></span>;
      }) : <p>No current holding is classified in this category.</p>}<p className="candidate-plan-note">Quantities are target-balance estimates, not trade instructions. Confirm price, taxes, fees, available plan funds, and investment quality before changing a holding.</p></div>
      <div className="balance-candidates"><b>{row.status === "overweight" ? "Where to redirect new contributions or reviewed trim proceeds" : "Smart candidates to evaluate for this gap"}</b><small>Research list—not an automatic buy. Save a candidate to this account’s plan, then complete its evaluation before acting.</small>{row.status === "overweight" ? <div className="rebalance-destinations">{destinations.length ? destinations.map(destination => <article key={destination.key}><strong>{meta[destination.key].label}<small>{destination.delta.toFixed(1)}% below target · about ${destination.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} needed</small></strong><p>{meta[destination.key].candidates.slice(0, 3).map(candidate => `${candidate.symbol} — ${candidate.name}`).join(" · ")}</p><button type="button" onClick={() => setSelected(destination.key)}>See ranked {meta[destination.key].label.toLowerCase()} suggestions →</button></article>) : <p>No category is materially under target. Keep proceeds in the account’s approved cash option while reviewing the complete allocation.</p>}</div> : info.candidates.map(candidate => {
        const canResearch = /^[A-Z]{1,5}$/.test(candidate.symbol);
        const saved = savedSymbols.includes(candidate.symbol);
        const estimatedShares = candidate.price && candidate.price > 0 ? row.amount / candidate.price : null;
        return <article key={candidate.symbol}><strong>{candidate.symbol}<small>{candidate.name}</small></strong><p>{candidate.why}</p><em>{row.status === "underweight" ? `Evaluate up to $${row.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}${estimatedShares !== null ? ` · about ${estimatedShares.toFixed(estimatedShares < 1 ? 2 : 1)} shares` : ""}` : "Monitor; category is near target"}</em><div className="candidate-actions">{canResearch && <a href={`/workspace/research/${encodeURIComponent(candidate.symbol.toLowerCase())}`}>Complete evaluation</a>}<button type="button" className={saved ? "saved" : ""} onClick={() => addToPlan(candidate)}>{saved ? "✓ Added to portfolio plan" : "+ Add to portfolio plan"}</button></div></article>;
      })}<p className="candidate-plan-note">Adding saves a proposed research action for {accountName}. It never places an order.</p></div>
      <footer><b>{horizon} scenarios from ${portfolioAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b><span>Stress ${low.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span><span>Planning ${base.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span><span>Stronger ${high.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></footer>
      <aside className="million-goal-check"><b>$1,000,000 goal reality check</b><span>Without new contributions, ${portfolioAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} would require about {(requiredAnnualReturn * 100).toFixed(1)}% every year for {planningYears} years.</span><span>At this plan’s modeled annual rate of about {(planningAnnualRate * 100).toFixed(1)}%, the estimated contribution required is ${requiredMonthlyContribution.toLocaleString(undefined, { maximumFractionDigits: 0 })} per month.</span><small>This is planning math, not a guarantee. Northstar prioritizes diversification, valuation, and loss control instead of increasing risk to force an unrealistic target.</small></aside>
    </section>}
  </details>;
}
