/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import {LazyFlowEvidence} from './quant-data-evidence';
import { useCallback, useEffect, useMemo, useState } from "react";
type Row = Record<string, any>;
const order = [
  "BUY_DECISION_READY",
  "CONDITIONAL_BUY",
  "GOOD_BUY_BUILD",
  "WATCH_FOR_BETTER_ENTRY",
  "EARLY_WATCH",
  "REJECTED_NOT_SUITABLE",
];
const labels: Record<string, string> = {
  BUY_DECISION_READY: "🟢 Buy now — full evidence passed",
  CONDITIONAL_BUY: "🟡 Buy only when the trigger confirms",
  GOOD_BUY_BUILD: "🔵 Good buy / build",
  WATCH_FOR_BETTER_ENTRY: "🟡 Watch for better entry",
  EARLY_WATCH: "🔵 Early watch",
  REJECTED_NOT_SUITABLE: "🔻 Rejected / not suitable",
};
const fmt = (value: any, digits = 1) =>
  value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))
    ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";
export default function NewCandidateDiscovery({
  onOpen,
  accountId,
  accountName,
  accountStrategy,
}: {
  onOpen: (symbol: string) => void;
  accountId: string;
  accountName: string;
  accountStrategy: string;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [scan, setScan] = useState<Row | null>(null),
    [account, setAccount] = useState<Row | null>(null),
    [lookup, setLookup] = useState<Row | null>(null),
    [search, setSearch] = useState(""),
    [submitted, setSubmitted] = useState(""),
    [sort, setSort] = useState("ACCOUNT"),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(
    async (symbol = "") => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
            `/api/market/candidates/discovery?accountId=${encodeURIComponent(accountId)}&strategy=ALL&search=${encodeURIComponent(symbol)}`,
            { cache: "no-store" },
          ),
          data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Candidate ranking unavailable");
        setRows(data.candidates || []);
        setScan(data.scan || null);
        setAccount(data.account || null);
        setLookup(data.lookup || null);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Candidate ranking unavailable",
        );
      } finally {
        setLoading(false);
      }
    },
    [accountId],
  );
  useEffect(() => {
    if (accountId) void load();
  }, [load, accountId]);
  const ranked = useMemo(
    () =>
      rows
        .slice()
        .sort((a, b) =>
          sort === "CONFIDENCE"
            ? Number(b.discovery_confidence) - Number(a.discovery_confidence)
            : sort === "VALUE"
              ? Number(b.valuation) - Number(a.valuation)
              : sort === "GROWTH"
                ? Number(b.growth_acceleration) - Number(a.growth_acceleration)
                : sort === "SWING"
                  ? Number(b.technical_setup) +
                    Number(b.portfolio_fit) -
                    Number(a.technical_setup) -
                    Number(a.portfolio_fit)
                  : sort === "LONG"
                    ? Number(b.business_quality) +
                      Number(b.valuation) +
                      Number(b.portfolio_fit) -
                      Number(a.business_quality) -
                      Number(a.valuation) -
                      Number(a.portfolio_fit)
                    : sort === "UNDERFOLLOWED"
                      ? Number(Boolean(b.underfollowed_reason)) -
                        Number(Boolean(a.underfollowed_reason))
                      : sort === "NEWEST"
                        ? new Date(b.first_detected_at).getTime() -
                          new Date(a.first_detected_at).getTime()
                        : Number(b.account_rank_score) -
                          Number(a.account_rank_score),
        ),
    [rows, sort],
  );
  const grouped = Object.fromEntries(
    order.map((key) => [
      key,
      ranked.filter((row) => row.account_rank_label === key),
    ]),
  );
  const queue = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/market/candidates/discovery", {
          method: "POST", headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:submitted||undefined}),
        }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not queue scan");
      await load(submitted);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not queue scan",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="account-candidate-ranking">
      <header className="discovery-hero">
        <div>
          <span>ACCOUNT-SPECIFIC MARKET DISCOVERY · Top opportunity ranking</span>
          <h2>Best opportunities for {account?.name || accountName}</h2>
          <p>
            {account?.strategy || accountStrategy} · ranked using candidate
            evidence plus this account’s holdings, cash, concentration and risk
            context.
          </p>
        </div>
        <button disabled={busy} onClick={queue}>
          {busy ? "Queueing…" : submitted ? `Research ${submitted}` : "Resume market scan"}
        </button>
      </header>
      <section className="candidate-coverage">
        <span>
          <small>Eligible universe</small>
          <b>{fmt(scan?.coverage?.eligible, 0)}</b>
        </span>
        <span>
          <small>Price screened</small>
          <b>{fmt(scan?.coverage?.screened, 0)}</b>
        </span>
        <span>
          <small>Deeply researched</small>
          <b>{fmt(scan?.coverage?.researched, 0)}</b>
        </span>
        <span>
          <small>Research pending / incomplete</small>
          <b>{fmt(Number(scan?.coverage?.research_pending||0)+Number(scan?.coverage?.incomplete||0), 0)}</b>
        </span>
        <span>
          <small>Last scan</small>
          <b>
            {scan?.lastSuccessfulScan
              ? new Date(scan.lastSuccessfulScan).toLocaleString()
              : "Never"}
          </b>
        </span>
        <span>
          <small>Provider status</small>
          <b>{scan?.errorCode ? "ERROR" : scan?.status || "UNKNOWN"}</b>
        </span>
      </section>
      <details className="rounded-xl border border-line p-4">
        <summary>Research coverage by sector and company size · {scan?.coverage?.discovery_concentration?.replaceAll('_',' ') || 'Awaiting evidence'}</summary>
        <p>{fmt(scan?.coverage?.current_evidence_researched,0)} companies have current evidence scores. Unknown classifications remain unknown. Coverage does not imply a trade qualifies.</p>
        <div className="flex flex-wrap gap-3">{(scan?.coverage?.research_groups||[]).map((group:Row)=><span key={group.sector+group.cap_bucket}>{group.sector} · {group.cap_bucket} · {group.count}</span>)}</div>
      </details>
      <div className="candidate-tools">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const symbol = search.trim().toUpperCase();
            setSubmitted(symbol);
            void load(symbol);
          }}
        >
          <label>
            Why is this not in the list?
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9.-]/g, "")
                    .slice(0, 12),
                )
              }
              placeholder="CIEN"
            />
          </label>
          <button disabled={!search.trim()}>Explain ticker</button>
        </form>
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="ACCOUNT">Best for this account</option>
            <option value="CONFIDENCE">Highest confidence</option>
            <option value="VALUE">Best value</option>
            <option value="GROWTH">Best growth</option>
            <option value="SWING">Best swing</option>
            <option value="LONG">Best long-term</option>
            <option value="UNDERFOLLOWED">Most underfollowed</option>
            <option value="NEWEST">Newest discovered</option>
          </select>
        </label>
      </div>
      {lookup && (
        <section
          className={`candidate-lookup lookup-${String(lookup.status).toLowerCase()}`}
        >
          <header>
            <div>
              <span>MANUAL TICKER EXPLANATION</span>
              <h3>
                {lookup.symbol} · {String(lookup.status).replaceAll("_", " ")}
              </h3>
            </div>
            <strong>{lookup.scanned ? "Scanned: YES" : "Scanned: NO"}</strong>
          </header>
          {lookup.candidate ? (
            <div className="lookup-scores">
              {[
                ["Fundamental quality", lookup.candidate.business_quality],
                ["Growth", lookup.candidate.growth_acceleration],
                ["Valuation", lookup.candidate.valuation],
                ["Technical setup", lookup.candidate.technical_setup],
                ["Portfolio fit", lookup.candidate.portfolio_fit],
              ].map(([name, value]) => (
                <span key={String(name)}>
                  <small>{name}</small>
                  <b>{fmt(value, 0)}</b>
                </span>
              ))}
            </div>
          ) : null}
          <p>
            <b>Why:</b> {lookup.reason}
          </p>
          <p>
            <b>What would make it actionable:</b> {lookup.becomesActionable}
          </p>
          {lookup.candidate && (
            <button onClick={() => onOpen(lookup.symbol)}>
              Open complete analysis →
            </button>
          )}
        </section>
      )}
      {error && (
        <div className="discovery-error">
          <b>Candidate ranking unavailable</b>
          <span>{error}</span>
        </div>
      )}
      {loading ? (
        <div className="discovery-skeleton">
          {Array.from({ length: 5 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
      ) : rows.length === 0 && !lookup ? (
        <div className="discovery-empty">
          <b>No persisted candidate currently matches this account.</b>
          <span>
            The page will not invent results. Review scan coverage or queue a
            fresh server scan.
          </span>
        </div>
      ) : (
        order.map((section) =>
          grouped[section]?.length ? (
            <section
              className={`ranked-candidate-section rank-${section.toLowerCase()}`}
              key={section}
            >
              <header>
                <h3>{labels[section]}</h3>
                <span>
                  {grouped[section].length} candidate
                  {grouped[section].length === 1 ? "" : "s"}
                </span>
              </header>
              <div>
                {grouped[section].map((row: Row) => (
                  <article key={row.symbol}><LazyFlowEvidence symbol={row.symbol}/>
                    <div className="candidate-rank">
                      <b>#{row.account_rank}</b>
                      <small>{row.account_rank_score}/100</small>
                    </div>
                    <div className="candidate-identity">
                      <h4>
                        {row.symbol} · {row.company_name}
                      </h4>
                      <span>
                        {row.sector || row.industry || "Sector unavailable"} ·{" "}
                        {String(
                          row.discovery_category || "Research",
                        ).replaceAll("_", " ")}
                      </span>
                      <strong>
                        ${fmt(row.metrics?.price, 2)}{" "}
                        <small>
                          {row.metrics?.dayChange >= 0 ? "+" : ""}
                          {fmt(row.metrics?.dayChange, 2)}%
                        </small>
                      </strong>
                    </div>
                    <section
                      className={`candidate-decision decision-${String(row.ai_action).toLowerCase().replaceAll(" ", "-")}`}
                    >
                      <div>
                        <small>Completed Northstar decision</small>
                        <strong>{row.ai_action}</strong>
                      </div>
                      {(row.ai_action === "BUY NOW" ||
                        row.ai_action === "BUY IF") && (
                        <div className="candidate-order-math">
                          <span>
                            <b>{fmt(row.suggested_shares, 0)}</b> shares
                          </span>
                          <span>
                            <b>${fmt(row.trigger_price, 2)}</b>{" "}
                            {row.ai_action === "BUY IF"
                              ? "trigger"
                              : "current price"}
                          </span>
                          <span>
                            <b>${fmt(row.estimated_cost, 2)}</b> estimated cost
                          </span>
                          <span>
                            <b>${fmt(row.invalidation_price, 2)}</b>{" "}
                            invalidation
                          </span>
                        </div>
                      )}
                      <p>{row.decision_condition}</p>
                    </section>
                    <dl>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{fmt(row.discovery_confidence, 0)}%</dd>
                      </div>
                      <div>
                        <dt>Fundamental quality</dt>
                        <dd>{fmt(row.business_quality, 0)}</dd>
                      </div>
                      <div>
                        <dt>Valuation</dt>
                        <dd>{fmt(row.valuation, 0)}</dd>
                      </div>
                      <div>
                        <dt>Technical setup</dt>
                        <dd>{fmt(row.technical_setup, 0)}</dd>
                      </div>
                      <div>
                        <dt>Portfolio fit</dt>
                        <dd>{fmt(row.portfolio_fit, 0)}</dd>
                      </div>
                      <div>
                        <dt>Risk</dt>
                        <dd>{fmt(row.risk, 0)}</dd>
                      </div>
                      <div>
                        <dt>Entry attractiveness</dt>
                        <dd>{fmt(row.entry_attractiveness, 0)}</dd>
                      </div>
                    </dl>
                    {(row.evidence?.scoreLimitations||[]).length>0&&<details><summary>Score evidence and missing data</summary>{row.evidence.scoreLimitations.map((reason:string)=><p key={reason}>{reason}</p>)}<p>Fundamentals: {row.evidence.fundamentalsAsOf||'Timestamp unavailable'} · {row.evidence.provider||'Provider unavailable'}</p></details>}
                    <p>
                      <b>Why it ranks here:</b> {row.why_ranked}
                    </p>
                    <p>
                      <b>Why it could fail:</b> {row.why_fail}
                    </p>
                    <footer>
                      <span>
                        {row.account_strategy} · data{" "}
                        {row.source_as_of
                          ? new Date(row.source_as_of).toLocaleString()
                          : "timestamp unavailable"}
                      </span>
                      <button onClick={() => onOpen(row.symbol)}>
                        Analyze →
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          ) : null,
        )
      )}
    </section>
  );
}
