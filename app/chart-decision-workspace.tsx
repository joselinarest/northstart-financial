"use client";
import ChartExitReview from "./chart-exit-review";
import HoldingCostBadge from "@/app/holding-cost-badge";

import { useEffect, useMemo, useState } from "react";
import ChartEngine from "./chart-engine";
import WorkspaceTabs from "./workspace-tabs";
import SecurityHeader from "./security-header";
import TradePlan from "./trade-plan";
import NewsEventList from "./news-event-list";
import FundamentalPanel from "./fundamental-panel";
import OptionsPanel from "./options-panel";
import QuantDataEvidence,{FlowValidation} from "./quant-data-evidence";

type Props = {
  accountId: string;
  symbol: string;
  strategy: "swing" | "position";
  accountName: string;
  accountValue: number;
  cashAvailable: number;
  ownedShares: number;
  ownedValue: number;
  price: number;
  bid: number | null;
  ask: number | null;
  relativeVolume: number;
  confidence: number;
  support: number;
  resistance: number;
  entryLow: number;
  entryHigh: number;
  stop: number;
  target1: number;
  target2: number;
  fresh: boolean;
  marketOpen?: boolean;
};
type Research = {
  status?: string;
  asOf?: string;
  profile?: Record<string, any>;
  metrics?: Record<string, any>;
  news?: Array<Record<string, any>>;
  filings?: Array<Record<string, any>>;
  error?: string;
};
type Authoritative = {
  recommendation?: Record<string, any>;
  checks?: Record<string, any>;
  error?: string;
};

const money = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const metric = (data: Record<string, any> | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const value = Number(data?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
};

export default function ChartDecisionWorkspace(props: Props) {
  const [panel,setPanel]=useState("analysis");
  const [research, setResearch] = useState<Research | null>(null),
    [authoritative, setAuthoritative] = useState<Authoritative | null>(null),
    [loading, setLoading] = useState(true),
    [refreshingDecision, setRefreshingDecision] = useState(false);
  useEffect(() => {
    if (window.location.hash !== "#sell-trim-analysis") return;
    setPanel("plan");
    const frame = requestAnimationFrame(() => {
      document.getElementById("sell-trim-analysis")?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [props.accountId, props.symbol]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setResearch(null);setLoading(true);
      try {
        const response = await fetch(
            `/api/market/research?symbol=${encodeURIComponent(props.symbol)}`,
          ),
          data = await response.json();
        if (active) setResearch(data);
      } catch {
        if (active)
          setResearch({
            status: "unavailable",
            error: "Company research is temporarily unavailable.",
          });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = props.marketOpen ? setInterval(load, 300000) : null;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [props.symbol, props.marketOpen]);
  useEffect(() => {
    let active = true;
    setAuthoritative(null);
    fetch(
      `/api/recommendations/authoritative?accountId=${encodeURIComponent(props.accountId)}&symbol=${encodeURIComponent(props.symbol)}`,
      { cache: "no-store" },
    )
      .then(async (response) => ({
        ok: response.ok,
        data: await response.json(),
      }))
      .then(({ ok, data }) => {
        if (!active) return;
        const legacyStaleMessage =
          ok &&
          /A required market, fundamental, or account input is missing or stale/i.test(
            String(data?.recommendation?.reason || ""),
          );
        if (legacyStaleMessage) {
          fetch(
            `/api/recommendations/authoritative?accountId=${encodeURIComponent(props.accountId)}&symbol=${encodeURIComponent(props.symbol)}&refresh=true`,
            { cache: "no-store" },
          )
            .then(async (response) => ({
              ok: response.ok,
              data: await response.json(),
            }))
            .then((refreshed) => {
              if (active)
                setAuthoritative(
                  refreshed.ok
                    ? refreshed.data
                    : {
                        error:
                          refreshed.data.error ||
                          "Recommendation pipeline unavailable",
                      },
                );
            })
            .catch(
              () =>
                active &&
                setAuthoritative({
                  error: "Recommendation pipeline unavailable",
                }),
            );
          return;
        }
        setAuthoritative(
          ok
            ? data
            : { error: data.error || "Recommendation pipeline unavailable" },
        );
      })
      .catch(
        () =>
          active &&
          setAuthoritative({ error: "Recommendation pipeline unavailable" }),
      );
    return () => {
      active = false;
    };
  }, [props.accountId, props.symbol]);
  const refreshDecision = async () => {
    setRefreshingDecision(true);
    try {
      const response = await fetch(
          `/api/recommendations/authoritative?accountId=${encodeURIComponent(props.accountId)}&symbol=${encodeURIComponent(props.symbol)}&refresh=true`,
          { cache: "no-store" },
        ),
        data = await response.json();
      setAuthoritative(
        response.ok
          ? data
          : { error: data.error || "Recommendation pipeline unavailable" },
      );
    } catch {
      setAuthoritative({ error: "Recommendation pipeline unavailable" });
    } finally {
      setRefreshingDecision(false);
    }
  };
  const decision = useMemo(() => {
    const riskPerShare = Math.max(0.01, props.price - props.stop),
      riskBudget = Math.max(0, props.accountValue * 0.005),
      riskShares = Math.floor(riskBudget / riskPerShare),
      cashShares = Math.floor(
        Math.max(0, props.cashAvailable) / (props.ask || props.price || 1),
      ),
      positionLimit = Math.max(0, props.accountValue * 0.1 - props.ownedValue),
      fitShares = Math.floor(positionLimit / (props.ask || props.price || 1)),
      shares = Math.max(0, Math.min(riskShares, cashShares, fitShares));
    const liquid =
      props.bid !== null &&
      props.ask !== null &&
      props.ask >= props.bid &&
      (props.ask - props.bid) / props.price < 0.005;
    const trend =
        props.price > props.support && props.price <= props.resistance * 1.03,
      confirmation = props.confidence >= 60 && props.relativeVolume >= 1.05;
    const evidenceReady = research?.status === "connected" && props.fresh;
    let action = "WAIT FOR EVIDENCE",
      reason =
        "Current data is incomplete; no actionable price should be inferred.";
    if (!props.fresh) {
      action = "WAIT · REFRESH MARKET DATA";
      reason = "The quote is not fresh enough for a time-sensitive decision.";
    } else if (props.price <= props.stop) {
      action = props.ownedShares > 0 ? "REDUCE / EXIT REVIEW" : "DO NOT ENTER";
      reason = "Price is below the calculated invalidation level.";
    } else if (!evidenceReady) {
      action = "WATCH · RESEARCH FEED REQUIRED";
      reason =
        "Price is current, but fundamentals, valuation, news, and event checks are incomplete.";
    } else if (
      props.strategy === "swing" &&
      confirmation &&
      liquid &&
      shares > 0
    ) {
      action = `BUY ON CONFIRMATION · UP TO ${shares} SHARE${shares === 1 ? "" : "S"}`;
      reason =
        "Trend, relative volume, liquidity, account fit, and risk sizing currently align.";
    } else if (props.strategy === "position" && trend && shares > 0) {
      action = `ACCUMULATE IN STAGES · ${Math.max(1, Math.ceil(shares / 3))} SHARE${Math.ceil(shares / 3) === 1 ? "" : "S"} NEXT`;
      reason =
        "The position fits the account limit; stage the entry inside the calculated zone instead of buying all at once.";
    } else if (props.ownedShares > 0) {
      action = "HOLD / MONITOR";
      reason =
        "The holding has not broken invalidation, but a new purchase lacks full confirmation.";
    }
    return { action, reason, shares, riskBudget, riskPerShare, liquid };
  }, [props, research]);
  const finalRecommendation = authoritative?.recommendation,
    finalAction = authoritative?.error
      ? "WAIT — RECOMMENDATION PIPELINE UNAVAILABLE"
      : finalRecommendation?.action ||
        "WAIT — LOADING AUTHORITATIVE RECOMMENDATION",
    finalReason =
      authoritative?.error ||
      finalRecommendation?.reason ||
      "Loading the latest account-specific recommendation record.",
    finalConfidence = Number(finalRecommendation?.confidence || 0),
    checks = authoritative?.checks || {},
    dataIssues = Array.isArray(checks.freshness?.issues)
      ? (checks.freshness.issues as string[])
      : [],
    m = research?.metrics,
    pe = metric(m, "peBasicExclExtraTTM", "peTTM"),
    marketCap = metric(m, "marketCapitalization"),
    revenueGrowth = metric(m, "revenueGrowth5Y", "revenueGrowthTTMYoy"),
    epsGrowth = metric(m, "epsGrowth5Y", "epsGrowthTTMYoy"),
    margin = metric(m, "netProfitMarginTTM"),
    roe = metric(m, "roeTTM"),
    debtEquity = metric(
      m,
      "totalDebt/totalEquityQuarterly",
      "totalDebtToEquityQuarterly",
    ),
    news = Array.isArray(research?.news) ? research!.news!.slice(0, 3) : [];
  return <section className="chart-decision-workspace professional-security-workspace">
    <SecurityHeader symbol={props.symbol} company={research?.profile?.name||props.symbol} price={props.price} market={props.marketOpen?'Market open · verify quote freshness':'Market closed · last available price'} account={props.accountName} strategy={props.strategy} shares={props.ownedShares} action={finalAction} onPlan={()=>setPanel('plan')}/>
    <ChartEngine accountId={props.accountId} accountValue={props.accountValue} cashAvailable={props.cashAvailable} symbol={props.symbol} strategy={props.strategy} action={finalAction} confidence={finalConfidence} support={props.support} resistance={props.resistance} entryLow={props.entryLow} entryHigh={props.entryHigh} stop={props.stop} target1={props.target1} target2={props.target2}
      renderPanels={(planner,evidence)=><div className="security-workspace-panels">
        <WorkspaceTabs tabs={[{id:'analysis',label:'Analysis'},{id:'news',label:'News & Events'},{id:'fundamentals',label:'Fundamentals'},{id:'options',label:'Options / Flow'},{id:'plan',label:'Trade Plan'}]} active={panel} onChange={setPanel}/>
        <div role="tabpanel" aria-label={panel} className="workspace-panel">
          {panel==='analysis'&&<><h3>Evidence and risks</h3><p>{finalReason}</p>{dataIssues.length>0&&<ul>{dataIssues.map(issue=><li key={issue}>{issue}</li>)}</ul>}<button disabled={refreshingDecision} onClick={refreshDecision}>{refreshingDecision?'Refreshing…':'Refresh evidence'}</button>{evidence}<QuantDataEvidence symbol={props.symbol} compact/></>}
          {panel==='news'&&<NewsEventList symbol={props.symbol} items={Array.isArray(research?.news)?research.news:[]} loading={loading} error={research?.error||(!Array.isArray(research?.news)?(research?.news as any)?.error:undefined)}/>}
          {panel==='fundamentals'&&<FundamentalPanel profile={research?.profile} metrics={research?.metrics}/>}
          {panel==='options'&&<OptionsPanel symbol={props.symbol} accountId={props.accountId} interpretation={finalReason}/>}
          {panel==='plan'&&<><NewsEventList symbol={props.symbol} items={Array.isArray(research?.news)?research.news:[]} loading={loading} error={research?.error||(!Array.isArray(research?.news)?(research?.news as any)?.error:undefined)} compact/><TradePlan recommendation={finalRecommendation} checks={checks} cash={props.cashAvailable}><HoldingCostBadge symbol={props.symbol} accountId={props.accountId} currentPrice={props.price} stop={props.stop}/><details><summary>Manual price scenario and saved plan</summary>{planner}</details><div id="sell-trim-analysis"><ChartExitReview key={props.accountId+':'+props.symbol} symbol={props.symbol} accountId={props.accountId} price={props.price} support={props.support} resistance={props.resistance} stop={props.stop} target={props.target1} relativeVolume={props.relativeVolume} fresh={props.fresh} recommendation={finalRecommendation} error={authoritative?.error}/></div><FlowValidation symbol={props.symbol} thesis="UNKNOWN"/><QuantDataEvidence symbol={props.symbol} compact/></TradePlan></>}
        </div>
      </div>}/>
  </section>;
}
