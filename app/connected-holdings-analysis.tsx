"use client";
import { useEffect, useMemo, useState } from "react";
import HoldingPriceLimits from "@/app/holding-price-limits";
type H = Record<string, any>;
type R = Record<string, any>;
const avg = (a: number[]) =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const ema = (a: number[], p: number) =>
  a.length
    ? a
        .slice(1)
        .reduce((x, y) => y * (2 / (p + 1)) + x * (1 - 2 / (p + 1)), a[0])
    : null;
const rsi = (a: number[]) => {
  if (a.length < 15) return null;
  const s = a.slice(-15),
    d = s.slice(1).map((v, i) => v - s[i]),
    g = avg(d.map((v) => Math.max(v, 0))),
    l = avg(d.map((v) => Math.max(-v, 0)));
  return l ? 100 - 100 / (1 + g / l) : 100;
};
const usd = (n: number | null) =>
  n === null
    ? "—"
    : `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const fund = (h: H) =>
  /ETF|FUND|TRUST|INDEX/.test(String(h.name || "").toUpperCase()) ||
  /^(VTI|VOO|SPY|IVV|ITOT|VXUS|SPGP|FFLC|SCHD|VYM|DGRO)$/.test(
    String(h.ticker || "").toUpperCase(),
  );
const explainMissing = (item: string) =>
  item === "company valuation"
    ? "a current company valuation (earnings per share and P/E, plus growth and cash-flow data to judge whether today’s stock price is expensive or reasonable)"
    : item === "purchase cost for profit/loss"
      ? "your average purchase cost, which is required to calculate your real profit or loss"
      : item === "sufficient price history"
        ? "at least 50 market days of prices to calculate the trend and risk level"
        : item === "fundamentals/news"
          ? "current company financial results and recent news from the connected provider"
          : item;
export default function ConnectedHoldingsAnalysis({
  holdings,
  mode,
  horizon = "2 years",
  accessToken,
  onOpen,
  marketOpen = false,
}: {
  holdings: H[];
  mode: "swing" | "long-term";
  horizon?: string;
  accessToken?: string;
  onOpen: (s: string) => void;
  marketOpen?: boolean;
}) {
  const unique = useMemo(
      () => [
        ...new Map(
          holdings
            .filter((h) => h.ticker)
            .map((h) => [String(h.ticker).toUpperCase(), h]),
        ).values(),
      ],
      [holdings],
    ),
    total = useMemo(
      () =>
        holdings.reduce(
          (s, h) => s + Number(h.market_value_cents || 0) / 100,
          0,
        ),
      [holdings],
    );
  const [results, setResults] = useState<R[]>([]),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(
      "Run the analysis to generate an evidence-based suggestion for every holding.",
    );
  const [history, setHistory] = useState<R[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/portfolio/history", {
            headers: accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : {},
            cache: "no-store",
          }),
          data = await response.json();
        if (active && response.ok && Array.isArray(data.history))
          setHistory(data.history);
      } catch {}
    };
    refresh();
    const update=()=>void refresh();
    window.addEventListener("northstar:portfolio-changed",update);
    return () => {
      active = false;
      window.removeEventListener("northstar:portfolio-changed",update);
    };
  }, [accessToken, holdings]);
  const analyze = async () => {
    setBusy(true);
    setStatus(`Analyzing ${unique.length} holdings for a ${horizon} horizon…`);
    const out = await Promise.all(
      unique.slice(0, 30).map(async (h) => {
        const symbol = String(h.ticker).toUpperCase(),
          shares = Number(h.quantity || 0),
          stored = Number(h.market_value_cents || 0) / 100,
          cost =
            h.cost_basis_cents == null
              ? null
              : Number(h.cost_basis_cents) / 100,
          isFund = fund(h),
          weight = total ? (stored / total) * 100 : 0,
          missing: string[] = [];
        try {
          const [br, rr] = await Promise.all([
              fetch(
                `/api/market/bars?symbol=${encodeURIComponent(symbol)}&range=1Y`,
                { cache: "no-store" },
              ),
              fetch(
                `/api/market/research?symbol=${encodeURIComponent(symbol)}`,
                { cache: "no-store" },
              ),
            ]),
            b = await br.json(),
            r = await rr.json(),
            bars = Array.isArray(b.bars) ? b.bars : [],
            closes = bars
              .map((v: any) => Number(v.close))
              .filter(Number.isFinite),
            volumes = bars
              .map((v: any) => Number(v.volume))
              .filter(Number.isFinite),
            price = closes.at(-1) || Number(r.quote?.c) || null,
            e20 = ema(closes.slice(-80), 20),
            s50 = closes.length >= 50 ? avg(closes.slice(-50)) : null,
            marketReference =
              closes.length >= 100
                ? avg(closes.slice(-Math.min(200, closes.length)))
                : null,
            rs = rsi(closes),
            rv =
              volumes.length > 20 && volumes.at(-1)
                ? Number(volumes.at(-1)) / avg(volumes.slice(-21, -1))
                : null,
            m = r.metrics || {},
            rawPe = Number.isFinite(Number(m.peTTM))
              ? Number(m.peTTM)
              : Number.isFinite(Number(m.peBasicExclExtraTTM))
                ? Number(m.peBasicExclExtraTTM)
                : null,
            pe = rawPe !== null && rawPe > 0 ? rawPe : null,
            psRaw = m.psTTM ?? m.priceToSalesTTM ?? m.psAnnual,
            ps =
              Number.isFinite(Number(psRaw)) && Number(psRaw) > 0
                ? Number(psRaw)
                : null,
            epsRaw = m.epsTTM ?? m.epsBasicExclExtraItemsTTM,
            eps = Number.isFinite(Number(epsRaw)) ? Number(epsRaw) : null,
            unprofitable = eps !== null && eps <= 0,
            valuationKnown =
              isFund ||
              pe !== null ||
              ps !== null ||
              unprofitable ||
              marketReference !== null,
            valuationPass =
              isFund ||
              (pe !== null && pe < 45) ||
              (pe === null && ps !== null && !unprofitable && ps < 12) ||
              (pe === null &&
                ps === null &&
                marketReference !== null &&
                price !== null &&
                price <= marketReference * 1.2),
            valuationBasis = isFund
              ? "Fund look-through required"
              : pe !== null
                ? `${pe.toFixed(1)}× P/E`
                : ps !== null
                  ? `${ps.toFixed(1)}× price-to-sales${unprofitable ? " · company is not profitable" : ""}`
                  : unprofitable
                    ? "Company is not profitable · P/E is not applicable"
                    : marketReference !== null
                      ? `$${marketReference.toFixed(2)} market-implied reference · lower confidence`
                      : "No usable valuation metrics received",
            news = Array.isArray(r.news) ? r.news.length : 0,
            trend =
              price && e20 && s50
                ? price > e20 && e20 > s50
                  ? "bullish"
                  : price < s50
                    ? "bearish"
                    : "mixed"
                : "unknown",
            value = price ? price * shares : stored,
            pnl = cost === null ? null : value - cost;
          if (!br.ok || closes.length < 50)
            missing.push("sufficient price history");
          if (!rr.ok) missing.push("fundamentals/news");
          if (!isFund && !valuationKnown) missing.push("company valuation");
          if (cost === null) missing.push("purchase cost for profit/loss");
          const checks = [
            {
              label: "Price trend",
              pass: trend === "bullish",
              known: trend !== "unknown",
            },
            {
              label: "Momentum",
              pass: rs !== null && rs >= 45 && rs <= 70,
              known: rs !== null,
            },
            {
              label: "Participation",
              pass: rv !== null && rv >= 0.8,
              known: rv !== null,
            },
            {
              label: `Valuation · ${valuationBasis}`,
              pass: valuationPass,
              known: valuationKnown,
            },
            { label: "Current news", pass: news > 0, known: rr.ok },
          ];
          const knownChecks = checks.filter((c) => c.known),
            passedChecks = knownChecks.filter((c) => c.pass).length,
            confidence = knownChecks.length
              ? Math.round((passedChecks / knownChecks.length) * 100)
              : 0;
          let state = "review",
            action = "WAIT / HOLD",
            risk = `${passedChecks} of ${knownChecks.length} available checks pass. Mixed evidence does not support adding yet.`,
            trigger =
              "Sell or trim only if the price trend and original investment thesis both fail.";
          if (trend === "bullish" && confidence >= 60 && valuationPass) {
            state = "favorable";
            action = "HOLD / CONSIDER ADDING";
            risk = `${passedChecks} of ${knownChecks.length} checks pass, including a usable valuation method. Position size and diversification still limit additional buying.`;
          }
          if (
            trend === "bearish" ||
            (!isFund && valuationKnown && !valuationPass)
          ) {
            state = "risk";
            action = "DO NOT ADD · TRIM REVIEW";
            risk =
              trend === "bearish"
                ? `Only ${passedChecks} of ${knownChecks.length} checks pass and price is below the medium-term trend reference.`
                : unprofitable
                  ? `The company is not profitable, so P/E cannot be used. ${ps !== null ? `Its ${ps.toFixed(1)}× price-to-sales ratio does not pass Northstar’s current threshold.` : "No positive-earnings valuation is available."}`
                  : `The current ${valuationBasis} does not pass Northstar’s valuation threshold.`;
          }
          if (missing.filter((x) => !x.includes("purchase cost")).length >= 2) {
            state = "missing";
            action = "DATA INCOMPLETE";
          }
          const reference = price && s50 ? Math.min(price, s50 * 0.9) : null,
            riskLevel = reference && reference < price ? reference : null,
            riskDropPct =
              price && riskLevel ? ((price - riskLevel) / price) * 100 : null,
            riskLoss = riskLevel ? (price! - riskLevel) * shares : null,
            reward = riskLevel ? price! + 2 * (price! - riskLevel) : null,
            rewardProfit = reward ? (reward - price!) * shares : null,
            maxPct = isFund ? 25 : 10,
            maxValue = (total * maxPct) / 100,
            buy =
              state === "favorable" && price && value < maxValue
                ? Math.floor((maxValue - value) / price)
                : 0,
            trim =
              price && value > maxValue
                ? Math.ceil((value - maxValue) / price)
                : 0,
            buyReference =
              price && e20 && s50
                ? Math.max(e20, s50)
                : price && s50
                  ? s50
                  : null,
            buyCost = buy && price ? buy * price : 0,
            suggestion =
              state === "missing"
                ? "No action yet: keep the shares you own, but do not buy more or sell based on an incomplete calculation. Northstar will recalculate when the missing provider data is available."
                : state === "risk"
                  ? `Do not purchase additional shares now. Keep the current position while you review it. ${trim ? `Because this holding is above the ${maxPct}% size guide, Northstar calculated a possible partial reduction of up to ${trim} shares—not the entire position.` : `Northstar has not calculated a share quantity to sell because the position is not above the ${maxPct}% size guide.`} Consider selling only if the specific price level shown below is crossed and the original reason for owning the investment has also become weaker. Northstar will not place the order.`
                  : state === "favorable"
                    ? buy
                      ? `BUY-MORE REVIEW: up to ${buy} additional shares (about ${usd(buyCost)}) fit below the ${maxPct}% position-size guide. Consider a staged purchase only after price holds above ${buyReference ? `$${buyReference.toFixed(2)}` : "the rising trend reference"} on a daily close and the business/fund thesis, valuation and diversification checks still pass. Do not chase a price far above that reference.`
                      : `HOLD; do not add because the position is already at or above the ${maxPct}% size guide.`
                    : "HOLD/WAIT: evidence is mixed. Do not add or sell until a clearer trend or thesis signal appears.";
          if (price && riskLevel && riskDropPct !== null)
            trigger = `Price trigger: review trimming after a daily close below $${riskLevel.toFixed(2)} (${riskDropPct.toFixed(1)}% below the current $${price.toFixed(2)} reference), especially if price remains below the 50-day average. Thesis trigger: review sooner if fundamentals, fund strategy, or the reason you own it materially deteriorates. This is a review level, not an automatic sell order.`;
          else if (price && s50)
            trigger = `Price trigger: review trimming after a confirmed daily close below the 50-day average near $${s50.toFixed(2)}. Thesis trigger: review sooner if fundamentals, fund strategy, or the reason you own it materially deteriorates. No automatic sell is placed.`;
          else
            trigger =
              "A numeric sell-review price cannot be calculated until sufficient current price history is available. Do not sell from missing evidence.";
          return {
            symbol,
            shares,
            cost,
            value,
            pnl,
            weight,
            price,
            e20,
            s50,
            rs,
            rv,
            pe,
            ps,
            eps,
            unprofitable,
            valuationBasis,
            news,
            isFund,
            state,
            action,
            risk,
            trigger,
            riskLevel,
            riskLoss,
            reward,
            rewardProfit,
            buy,
            buyReference,
            buyCost,
            trim,
            suggestion,
            missing,
            checks,
            passedChecks,
            knownChecks: knownChecks.length,
            confidence,
            asOf: new Date().toISOString(),
          };
        } catch {
          return {
            symbol,
            shares,
            cost,
            value: stored,
            pnl: cost === null ? null : stored - cost,
            weight,
            isFund,
            state: "missing",
            action: "DATA INCOMPLETE",
            suggestion:
              "WAIT: live analysis failed; do not buy or sell from incomplete evidence.",
            risk: "Market evidence unavailable.",
            trigger: "Retry the analysis.",
            missing: ["market, technical and fundamental data"],
            checks: [],
            passedChecks: 0,
            knownChecks: 0,
            confidence: 0,
            asOf: new Date().toISOString(),
          };
        }
      }),
    );
    setResults(out);
    setStatus(
      `Evaluated ${out.length} holdings · ${new Date().toLocaleString()} · horizon ${horizon}`,
    );
    setBusy(false);
  };
  useEffect(() => {
    if (marketOpen && unique.length) void analyze();
  }, [unique, horizon, marketOpen]); // Closed sessions require an explicit refresh and do not consume market API quota.
  return (
    <div className="connected-analysis embedded">
      <div className="analysis-controls">
        <div>
          <b>Complete {horizon} review</b>
          <span>
            {marketOpen
              ? "Northstar refreshes price, risk, valuation, trend, and the final action while the market is open."
              : "Market closed · use Refresh all evaluations for a manual provider update."}
          </span>
        </div>
        <button disabled={busy || !unique.length} onClick={analyze}>
          {busy ? "Analyzing all holdings…" : "Refresh all evaluations"}
        </button>
      </div>
      <div className="analysis-status">{status}</div>
      <div className="position-evaluation-list">
        {unique.map((h) => {
          const symbol = String(h.ticker).toUpperCase(),
            x = results.find((v) => v.symbol === symbol),
            shares = Number(h.quantity || 0),
            value = Number(h.market_value_cents || 0) / 100,
            cost =
              h.cost_basis_cents == null
                ? null
                : Number(h.cost_basis_cents) / 100,
            marks = history.filter((mark) => mark.symbol === symbol),
            latestMark = marks[0],
            dailyChange =
              latestMark?.day_change_cents == null
                ? null
                : Number(latestMark.day_change_cents) / 100;
          const weight = total ? (value / total) * 100 : 0,
            isFund = fund(h),
            isBroad =
              /^(VTI|VOO|SPY|IVV|ITOT|VXUS)$/.test(symbol) ||
              /TOTAL MARKET|S&P 500|BROAD MARKET/.test(
                String(h.name || "").toUpperCase(),
              ),
            concentration =
              weight <= 10
                ? {
                    tone: "confirmed",
                    title: "WITHIN CONCENTRATION LIMIT",
                    text: `At ${weight.toFixed(1)}%, this position is below the 10% concentration threshold. This confirms size only—not valuation or future performance.`,
                  }
                : isBroad
                  ? {
                      tone: "review",
                      title: "DIVERSIFIED FUND · WEIGHT REVIEW",
                      text: `This fund owns many companies, but at ${weight.toFixed(1)}% it can still dominate total U.S./equity market exposure. It is not equivalent to one company at this weight.`,
                    }
                  : isFund
                    ? {
                        tone: "review",
                        title: "FUND · STYLE/OVERLAP REVIEW",
                        text: `At ${weight.toFixed(1)}%, this fund can create style, sector, manager, or holdings overlap with other funds.`,
                      }
                    : {
                        tone: "risk",
                        title: "INDIVIDUAL STOCK · CONCENTRATION RISK",
                        text: `One company represents ${weight.toFixed(1)}% of the portfolio, so company-specific losses could materially affect the plan.`,
                      };
          return (
            <article className={x?.state || "pending"} key={symbol}>
              <header>
                <div>
                  <b>{symbol}</b>
                  <small>
                    {h.name} · {shares.toLocaleString()} shares ·{" "}
                    {weight.toFixed(1)}% of portfolio
                  </small>
                  <small className="history-mark">
                    {marks.length} market day{marks.length === 1 ? "" : "s"}{" "}
                    stored
                    {dailyChange === null
                      ? ""
                      : ` · latest ${dailyChange >= 0 ? "+" : "−"}${usd(dailyChange)}`}
                  </small>
                </div>
                <strong>
                  {usd(value)}
                  <small>
                    {cost === null
                      ? "Cost not provided"
                      : `${value - cost >= 0 ? "+" : "−"}${usd(value - cost)} unrealized`}
                  </small>
                </strong>
              </header>
              <HoldingPriceLimits
                holdings={[h]}
                accessToken={accessToken || ""}
                compact
                marketOpen={marketOpen}
              />
              <div className={`inline-concentration ${concentration.tone}`}>
                <b>{concentration.title}</b>
                <p>{concentration.text}</p>
              </div>
              {!x ? (
                <p className="pending-message">
                  <b>Automatic evaluation in progress…</b> Northstar is
                  calculating valuation, trend, risk, possible loss, profit
                  scenario, and the final action for this holding.
                </p>
              ) : (
                <div className="holding-evaluation">
                  <div className="evaluation-verdict">
                    <div
                      className={`decision-icon ${x.state}`}
                      aria-label={
                        x.state === "favorable" && x.buy > 0
                          ? "Possible buy"
                          : x.state === "risk"
                            ? "Sell or trim review"
                            : x.state === "missing"
                              ? "Wait for data"
                              : "Observe and hold"
                      }
                    >
                      <i aria-hidden="true">
                        {x.state === "favorable" && x.buy > 0
                          ? "＋"
                          : x.state === "risk"
                            ? "↓"
                            : x.state === "missing"
                              ? "!"
                              : "◉"}
                      </i>
                      <span>
                        {x.state === "favorable" && x.buy > 0
                          ? "BUY REVIEW"
                          : x.state === "risk"
                            ? "SELL / TRIM REVIEW"
                            : x.state === "missing"
                              ? "WAIT FOR DATA"
                              : "OBSERVE / HOLD"}
                      </span>
                    </div>
                    <b>{x.action}</b>
                    <p>{x.suggestion}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Shares</dt>
                      <dd>{x.shares.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Average cost</dt>
                      <dd>
                        {x.cost === null
                          ? "Not provided"
                          : `$${(x.cost / x.shares).toFixed(2)}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Live value</dt>
                      <dd>{usd(x.value)}</dd>
                    </div>
                    <div>
                      <dt>Profit / loss</dt>
                      <dd>
                        {x.pnl === null
                          ? "Cost needed"
                          : `${x.pnl >= 0 ? "+" : "−"}${usd(x.pnl)}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Risk price</dt>
                      <dd>
                        {x.riskLevel
                          ? `$${x.riskLevel.toFixed(2)}`
                          : "Unavailable"}
                      </dd>
                    </div>
                    <div>
                      <dt>Possible loss</dt>
                      <dd>
                        {x.riskLoss ? `−${usd(x.riskLoss)}` : "Unavailable"}
                      </dd>
                    </div>
                    <div>
                      <dt>2:1 profit scenario</dt>
                      <dd>
                        {x.rewardProfit
                          ? `+${usd(x.rewardProfit)}`
                          : "Unavailable"}
                      </dd>
                    </div>
                    <div>
                      <dt>Valuation</dt>
                      <dd>
                        {x.isFund
                          ? x.pe
                            ? `${x.pe.toFixed(1)}× portfolio P/E`
                            : "Fund look-through needed"
                          : x.pe
                            ? `${x.pe.toFixed(1)}× P/E`
                            : "Not received from data provider"}
                      </dd>
                    </div>
                  </dl>
                  <p>
                    <b>Why:</b> {x.risk}
                  </p>
                  <p>
                    <b>Exact sell/trim review rule:</b> {x.trigger}
                  </p>
                  {x.isFund && !x.pe && (
                    <p className="fund-note">
                      <b>Fund valuation:</b> A normal company P/E is not
                      applicable. Confirm the fund’s portfolio P/E, expense
                      ratio, holdings overlap, and strategy.
                    </p>
                  )}
                  {x.missing.length > 0 && (
                    <p className="missing">
                      <b>Provider data note:</b> Northstar automatically
                      requested every available source but still could not
                      verify {x.missing.map(explainMissing).join("; ")}. The
                      final state remains conservative until the provider
                      supplies it.
                    </p>
                  )}
                  <footer>
                    <time>{new Date(x.asOf).toLocaleString()}</time>
                    <button onClick={() => onOpen(symbol)}>
                      Open full chart →
                    </button>
                  </footer>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
