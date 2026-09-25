"use client";
import { useMemo } from "react";
type Row = Record<string, any>;
export const ALL_ACCOUNTS_SCOPE = "ALL_ACCOUNTS";
const usd = (c: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(c / 100);
const label = (a: Row) =>
  String(a.nickname || a.official_name || a.name || "Investment account");
const getPolicy = (a: Row) => {
  try {
    return typeof a.policy_json === "string"
      ? JSON.parse(a.policy_json)
      : a.policy_json || {};
  } catch {
    return {};
  }
};
export default function AccountScopeDashboard({
  accounts,
  holdings,
  selectedScope,
  onSelect,
  onConfigure,
}: {
  accounts: Row[];
  holdings: Row[];
  selectedScope: string;
  onSelect: (scope: string) => void;
  onConfigure?: (accountId: string) => void;
}) {
  const selected = accounts.find((a) => String(a.id) === selectedScope) || null;
  const summary = useMemo(() => {
    const invested = holdings.reduce(
        (s, h) => s + Number(h.market_value_cents || 0),
        0,
      ),
      cost = holdings.reduce((s, h) => s + Number(h.cost_basis_cents || 0), 0),
      cash = accounts.reduce(
        (s, a) =>
          s + Number(a.available_cash_cents ?? a.available_balance_cents ?? 0),
        0,
      ),
      groups = new Map<string, Row[]>();
    holdings.forEach((h) => {
      const t = String(h.ticker || "").toUpperCase();
      if (t) groups.set(t, [...(groups.get(t) || []), h]);
    });
    const overlaps = [...groups.entries()]
      .map(([ticker, positions]) => ({
        ticker,
        positions,
        value: positions.reduce(
          (s, h) => s + Number(h.market_value_cents || 0),
          0,
        ),
        accounts: new Set(positions.map((h) => String(h.account_id))).size,
      }))
      .filter((x) => x.accounts > 1)
      .sort((a, b) => b.value - a.value);
    return { invested, cost, cash, overlaps };
  }, [accounts, holdings]);
  const rows = selected
      ? holdings.filter((h) => String(h.account_id) === String(selected.id))
      : [],
    value = rows.reduce((s, h) => s + Number(h.market_value_cents || 0), 0),
    cost = rows.reduce((s, h) => s + Number(h.cost_basis_cents || 0), 0),
    cash = Number(
      selected?.available_cash_cents ?? selected?.available_balance_cents ?? 0,
    ),
    total = value + cash,
    largest = [...rows].sort(
      (a, b) =>
        Number(b.market_value_cents || 0) - Number(a.market_value_cents || 0),
    )[0],
    weight =
      value && largest
        ? (Number(largest.market_value_cents || 0) / value) * 100
        : 0,
    limit = Number(selected?.maximum_position_bps ?? 1000) / 100,
    p = selected ? getPolicy(selected) : {},
    strategy = String(
      selected?.investment_purpose || selected?.strategy_type || "Custom",
    ).replaceAll("_", " "),
    swing = /swing|option|trad/i.test(strategy),
    effectiveHorizon = selected?.horizon_months
      ? `${selected.horizon_months} months`
      : `Suggested ${swing ? "3–12" : "60–120"} months · configure`,
    effectiveBenchmark =
      selected?.benchmark_symbol ||
      `${swing ? "SPY" : "VTI"} · suggested · configure`,
    effectiveInstruments =
      Array.isArray(p.allowedInstruments) && p.allowedInstruments.length
        ? p.allowedInstruments.join(", ")
        : `${swing ? "STOCKS, ETFS" : "ETFS, STOCKS"} · suggested · configure`,
    status =
      weight > limit
        ? "OVERCONCENTRATED"
        : total && cash / total > 0.25
          ? "TOO MUCH CASH"
          : rows.length < 3
            ? "WATCH"
            : "HEALTHY";
  return (
    <section className="account-scope-dashboard">
      <header className="account-scope-global">
        <div>
          <span>GLOBAL INVESTMENT OVERVIEW</span>
          <strong>{usd(summary.invested)}</strong>
          <small>{accounts.length} investment accounts</small>
        </div>
        <div>
          <span>TOTAL ACCOUNT CASH</span>
          <strong>{usd(summary.cash)}</strong>
          <small>Never pooled for sizing</small>
        </div>
        <div>
          <span>UNREALIZED GAIN / LOSS</span>
          <strong
            className={
              summary.invested - summary.cost >= 0 ? "positive" : "negative"
            }
          >
            {summary.invested - summary.cost >= 0 ? "+" : ""}
            {usd(summary.invested - summary.cost)}
          </strong>
          <small>All synchronized positions</small>
        </div>
      </header>
      <label className="account-scope-select">
        <span>Investment account to analyze</span>
        <select
          aria-label="Investment account to analyze"
          value={selectedScope}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value={ALL_ACCOUNTS_SCOPE}>
            All Accounts · summary only
          </option>
          {accounts.map((a) => (
            <option value={String(a.id)} key={`select_${a.id}`}>
              {label(a)} ·{" "}
              {a.investment_purpose ||
                a.strategy_type ||
                a.subtype ||
                "Investment"}
            </option>
          ))}
        </select>
      </label>
      <div
        className="account-scope-switcher"
        role="tablist"
        aria-label="Choose investment account"
      >
        <button
          role="tab"
          aria-selected={selectedScope === ALL_ACCOUNTS_SCOPE}
          className={selectedScope === ALL_ACCOUNTS_SCOPE ? "active" : ""}
          onClick={() => onSelect(ALL_ACCOUNTS_SCOPE)}
        >
          All Accounts
        </button>
        {accounts.map((a) => (
          <button
            role="tab"
            aria-selected={String(a.id) === selectedScope}
            className={String(a.id) === selectedScope ? "active" : ""}
            onClick={() => onSelect(String(a.id))}
            key={String(a.id)}
          >
            <b>{label(a)}</b>
            <small>
              {a.investment_purpose ||
                a.strategy_type ||
                a.subtype ||
                "Investment"}
            </small>
          </button>
        ))}
      </div>
      <div className="analysis-scope-label">
        <i />
        <span>Analyzing:</span>
        <strong>{selected ? label(selected) : "All Accounts"}</strong>
        <em>{selected ? "ACCOUNT scope" : "ALL_ACCOUNTS - summary only"}</em>
      </div>
      {!selected ? (
        <div className="cross-account-intelligence">
          <header>
            <div>
              <span>CROSS-ACCOUNT INTELLIGENCE</span>
              <h2>Combined exposure without ambiguous trade advice</h2>
            </div>
            <b>{summary.overlaps.length} overlaps</b>
          </header>
          <p className="scope-guard">
            Cash is never combined and generic BUY/SELL advice is disabled.
            Select an account for actions and sizing.
          </p>
          {summary.overlaps.length ? (
            summary.overlaps.slice(0, 6).map((x) => (
              <article key={x.ticker}>
                <div>
                  <b>{x.ticker}</b>
                  <span>
                    {usd(x.value)} combined -{" "}
                    {summary.invested
                      ? ((x.value / summary.invested) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </span>
                </div>
                <ul>
                  {x.positions.map((h, i) => {
                    const a = accounts.find(
                      (a) => String(a.id) === String(h.account_id),
                    );
                    return (
                      <li key={String(h.holding_id || h.security_id || i)}>
                        <strong>{a ? label(a) : "Unknown account"}</strong>
                        <span>
                          {Number(h.quantity || 0).toLocaleString()} shares -{" "}
                          {usd(Number(h.market_value_cents || 0))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))
          ) : (
            <div className="scope-empty">No holding overlap detected.</div>
          )}
        </div>
      ) : (
        <div className="selected-account-summary">
          <div className="account-health-title">
            <div>
              <span>ACCOUNT HEALTH</span>
              <h2>{status}</h2>
              <p>
                {weight > limit
                  ? `${largest?.ticker || "Largest position"} is ${weight.toFixed(1)}% versus the ${limit.toFixed(1)}% limit.`
                  : total && cash / total > 0.25
                    ? `${((cash / total) * 100).toFixed(1)}% of this account is cash. Northstar will protect the configured reserve and only deploy safe capacity into fully confirmed actions.`
                    : rows.length < 3
                      ? "Limited diversification; review the account goal before adding risk."
                      : "No concentration or cash threshold is currently breached."}
              </p>
            </div>
            <div className="account-health-actions">
              <strong>
                {String(selected.risk_profile || "BALANCED").replaceAll(
                  "_",
                  " ",
                )}{" "}
                risk
              </strong>
              {onConfigure && (
                <button
                  type="button"
                  onClick={() => onConfigure(String(selected.id))}
                >
                  Configure account policy
                </button>
              )}
            </div>
          </div>
          <div className="account-kpi-strip">
            <div>
              <span>Portfolio value</span>
              <b>{usd(value)}</b>
            </div>
            <div>
              <span>Available cash</span>
              <b>{usd(cash)}</b>
            </div>
            <div>
              <span>Invested</span>
              <b>{total ? ((value / total) * 100).toFixed(1) : "0.0"}%</b>
            </div>
            <div>
              <span>Unrealized P/L</span>
              <b className={value - cost >= 0 ? "positive" : "negative"}>
                {value - cost >= 0 ? "+" : ""}
                {usd(value - cost)}
              </b>
            </div>
            <div>
              <span>Largest position</span>
              <b>
                {largest?.ticker || "-"}{" "}
                {largest ? `${weight.toFixed(1)}%` : ""}
              </b>
            </div>
          </div>
          <div className="account-policy-row">
            <span>
              <small>Strategy</small>
              <b>{strategy}</b>
            </span>
            <span>
              <small>Goal</small>
              <b>
                {selected.goal_name ||
                  selected.investment_purpose ||
                  "Configure a measurable account goal"}
              </b>
            </span>
            <span>
              <small>Horizon</small>
              <b>{effectiveHorizon}</b>
            </span>
            <span>
              <small>Benchmark</small>
              <b>{effectiveBenchmark}</b>
            </span>
            <span>
              <small>Allowed instruments</small>
              <b>{effectiveInstruments}</b>
            </span>
            <span>
              <small>Tactical swing</small>
              <b>
                {p.tacticalSwingAllowed
                  ? "Enabled by your saved account policy"
                  : swing
                    ? "Disabled until you explicitly enable it in account policy"
                    : "Not used for this account strategy"}
              </b>
              <em>
                {p.tacticalSwingAllowed
                  ? "Northstar may evaluate partial trim-and-rebuy setups, but only when the evidence and expected benefit clear the higher tactical threshold."
                  : swing
                    ? "Safety default: Northstar will not suggest temporary sell/rebuy timing without your permission. Ordinary BUY, HOLD, TRIM and SELL analysis still works."
                    : "This account continues to receive recommendations appropriate to its saved long-term or specialized strategy."}
              </em>
              {!p.tacticalSwingAllowed && swing && onConfigure && (
                <button
                  type="button"
                  className="policy-inline-action"
                  onClick={() => onConfigure(String(selected.id))}
                >
                  Configure Tactical Swing →
                </button>
              )}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
