import {accountRiskSettings} from "@/lib/account-risk-settings";
import {positionSizing} from "@/lib/position-sizing";
import {holdingOpenRisk} from "@/lib/holding-open-risk";
import {QuantDataProvider} from "@/lib/providers/quant-data";
import {providerSignal} from "@/lib/work-budget";
import { id, type PostgresDatabase } from "@/lib/db";
import { marketDataProvider } from "@/lib/providers/alpaca-market-data";
import { loadRuntimeSecrets } from "@/lib/runtime-secrets";
import { evaluateCatalystEntryGate, loadCatalystContext } from "@/lib/catalyst-entry-gate";

type Json = Record<string, any>;
const num = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : null;
const avg = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const parse = (value: unknown, fallback: any = {}) => {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};
const metric = (data: Json, ...keys: string[]) => {
  for (const key of keys) {
    const value = num(data[key]);
    if (value !== null) return value;
  }
  return null;
};

async function fundamentals(symbol: string) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token)
    return {
      available: false,
      provider: "FINNHUB_NOT_CONFIGURED",
      asOf: null,
      profile: {},
      metrics: {},
      news: [],
    };
  const base = "https://finnhub.io/api/v1",
    today = new Date(),
    from = new Date(Date.now() - 30 * 86400000),
    date = (d: Date) => d.toISOString().slice(0, 10),
    get = async (path: string) => {
      const response = await fetch(`${base}${path}`, {
        headers: { "X-Finnhub-Token": token },
        cache: "no-store",
        signal: providerSignal(12000),
      });
      if (!response.ok) throw new Error(`FINNHUB_${response.status}`);
      return response.json();
    };
  try {
    const [profile, metricData, news] = await Promise.all([
      get(`/stock/profile2?symbol=${symbol}`),
      get(`/stock/metric?symbol=${symbol}&metric=all`),
      get(
        `/company-news?symbol=${symbol}&from=${date(from)}&to=${date(today)}`,
      ),
    ]);
    return {
      available: true,
      provider: "FINNHUB",
      asOf: new Date().toISOString(),
      profile,
      metrics: metricData.metric || {},
      news: Array.isArray(news) ? news.slice(0, 20) : [],
    };
  } catch (error) {
    return {
      available: false,
      provider: error instanceof Error ? error.message : "FINNHUB_ERROR",
      asOf: null,
      profile: {},
      metrics: {},
      news: [],
    };
  }
}

export async function researchRecommendation(
  db: PostgresDatabase,
  input: {
    householdId: string;
    accountId: string;
    symbol: string;
    force?: boolean;
  },
) {
  await loadRuntimeSecrets();
  const symbol = input.symbol.trim().toUpperCase();
  if (!/^[A-Z.]{1,10}$/.test(symbol)) throw new Error("Valid ticker required");
  const account = await db
    .prepare(
      `SELECT a.id,COALESCE(a.nickname,a.name) account_name,a.investment_purpose,COALESCE(s.strategy_type,'GROWTH_5_7') strategy_type,COALESCE(s.maximum_position_bps,1000) maximum_position_bps,COALESCE(s.maximum_risk_bps,50) maximum_risk_bps,COALESCE(s.available_cash_cents,a.available_balance_cents,a.current_balance_cents,0)::text cash_cents FROM accounts a JOIN entities e ON e.id=a.entity_id LEFT JOIN investment_account_settings s ON s.account_id=a.id WHERE a.id=? AND e.household_id=? AND a.type='investment'`,
    )
    .bind(input.accountId, input.householdId)
    .first<Json>();
  if (!account) throw new Error("Investment account not found");
  const prior = await db
    .prepare(
      `SELECT r.*,s.ticker FROM recommendations r JOIN securities s ON s.id=r.security_id WHERE r.household_id=? AND r.account_id=? AND s.ticker=? AND r.checks_json->>'researchOnly'='true' AND r.expires_at>CURRENT_TIMESTAMP ORDER BY r.created_at DESC LIMIT 1`,
    )
    .bind(input.householdId, input.accountId, symbol)
    .first<Json>();
  const priorChecks = parse(prior?.checks_json);
  const priorAgeMs = prior?.evidence_as_of
    ? Date.now() - Date.parse(String(prior.evidence_as_of))
    : Infinity;
  const priorActionableBuy = ["BUY", "ACCUMULATE"].includes(String(prior?.action || ""));
  const priorNeedsRefresh =
    !priorChecks?.portfolioFit?.riskPolicy ||
    priorChecks?.freshness?.stale === true ||
    /^FINNHUB_(?:401|403|429|5\d\d|NOT_CONFIGURED|ERROR)$/.test(String(priorChecks?.sources?.fundamental?.provider||"")) ||
    /DATA REFRESH REQUIRED/i.test(String(prior?.reason || "")) ||
    (priorActionableBuy && (priorAgeMs > 10 * 60_000 || !priorChecks?.catalysts));
  if (prior && !input.force && !priorNeedsRefresh)
    return {
      recommendation: prior,
      checks: priorChecks,
      source: "PERSISTED",
    };
  const market = marketDataProvider(),
    end = new Date(),
    start = new Date(Date.now() - 370 * 86400000).toISOString(),
    [quoteSet, barsSet, fundamental, catalystContext] = await Promise.all([
      market.getQuotes([symbol]),
      market.getBars(symbol, { timeframe: "1Day", start, limit: 260 }),
      fundamentals(symbol),
      loadCatalystContext(symbol),
    ]),
    quote = quoteSet.quotes[symbol],
    bars = barsSet.bars || [],
    closes = bars.map((bar: any) => Number(bar.close)),
    last = bars.at(-1) as any,
    marketAsOf = quote?.timestamp || quoteSet.asOf,
    barsAsOf = barsSet.asOf || marketAsOf,
    marketAge = Date.now() - Date.parse(marketAsOf),
    fundamentalAge = fundamental.asOf
      ? Date.now() - Date.parse(fundamental.asOf)
      : Infinity;
  const sma20 = avg(closes.slice(-20)),
    sma50 = avg(closes.slice(-50)),
    recent = bars.slice(-20),
    support = recent.length
      ? Math.min(...recent.map((bar: any) => Number(bar.low)))
      : null,
    resistance = recent.length
      ? Math.max(...recent.map((bar: any) => Number(bar.high)))
      : null,
    avgVolume = avg(recent.slice(0, -1).map((bar: any) => Number(bar.volume))),
    relativeVolume = avgVolume && last ? Number(last.volume) / avgVolume : null,
    currentPrice = Number(quote?.last || 0),
    previousClose = Number(quote?.previousClose || 0),
    dayChangePct = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : null,
    threeDayBase = closes.length >= 4 ? closes.at(-4) || 0 : 0,
    threeDayReturnPct = threeDayBase ? ((currentPrice - threeDayBase) / threeDayBase) * 100 : null,
    recentHigh = recent.length ? Math.max(...recent.slice(-10).map((bar: any) => Number(bar.high))) : null,
    pullbackFromHighPct = recentHigh ? ((currentPrice - recentHigh) / recentHigh) * 100 : null,
    technicalState =
      currentPrice > sma20 && sma20 > sma50
        ? "BULLISH"
        : currentPrice < sma20 && sma20 < sma50
          ? "BEARISH"
          : "NEUTRAL";
  const m = fundamental.metrics,
    revenueGrowth = metric(m, "revenueGrowthTTMYoy", "revenueGrowth5Y"),
    epsGrowth = metric(m, "epsGrowthTTMYoy", "epsGrowth5Y"),
    grossMargin = metric(m, "grossMarginTTM"),
    operatingMargin = metric(m, "operatingMarginTTM"),
    netMargin = metric(m, "netProfitMarginTTM"),
    fcfPerShare = metric(m, "freeCashFlowPerShareTTM"),
    roe = metric(m, "roeTTM"),
    debtEquity = metric(
      m,
      "totalDebtToEquityQuarterly",
      "totalDebt/totalEquityQuarterly",
    ),
    forwardPe = metric(m, "forwardPE"),
    trailingPe = metric(m, "peTTM", "peBasicExclExtraTTM"),
    marketCap = metric(fundamental.profile, "marketCapitalization"),
    coverage = [
      revenueGrowth,
      epsGrowth,
      grossMargin,
      operatingMargin,
      fcfPerShare,
      debtEquity,
      forwardPe,
      marketCap,
    ].filter((value) => value !== null).length;
  const fundamentalQuality = clamp(
      40 +
        (revenueGrowth !== null && revenueGrowth > 8
          ? 12
          : revenueGrowth !== null && revenueGrowth < 0
            ? -15
            : 0) +
        (operatingMargin !== null && operatingMargin > 15
          ? 12
          : operatingMargin !== null && operatingMargin < 0
            ? -15
            : 0) +
        (fcfPerShare !== null && fcfPerShare > 0 ? 12 : -8) +
        (debtEquity !== null && debtEquity < 150
          ? 8
          : debtEquity !== null && debtEquity > 300
            ? -18
            : 0),
    ),
    growthQuality = clamp(
      40 +
        (revenueGrowth !== null
          ? Math.max(-20, Math.min(25, revenueGrowth))
          : 0) +
        (epsGrowth !== null ? Math.max(-15, Math.min(20, epsGrowth / 2)) : 0),
    ),
    balanceSheetQuality = clamp(
      60 +
        (debtEquity === null
          ? -15
          : debtEquity < 100
            ? 20
            : debtEquity > 300
              ? -35
              : -5),
    ),
    valuationAttractiveness = clamp(
      55 +
        (forwardPe === null
          ? -15
          : forwardPe < 18
            ? 20
            : forwardPe < 30
              ? 5
              : forwardPe > 50
                ? -30
                : -10) +
        (revenueGrowth !== null &&
        forwardPe !== null &&
        revenueGrowth > forwardPe
          ? 12
          : 0),
    ),
    earningsQuality = clamp(
      35 +
        (operatingMargin !== null && operatingMargin > 0 ? 20 : -10) +
        (fcfPerShare !== null && fcfPerShare > 0 ? 20 : -10),
    ),
    competitivePosition = clamp(coverage >= 6 ? 65 : 45),
    fundamentalRisks = [
      ...(forwardPe !== null && forwardPe > 40
        ? [`Forward P/E ${forwardPe.toFixed(1)} requires strong execution`]
        : []),
      ...(debtEquity !== null && debtEquity > 200
        ? [`Debt/equity ${debtEquity.toFixed(1)} increases balance-sheet risk`]
        : []),
      ...(fcfPerShare !== null && fcfPerShare <= 0
        ? ["Free cash flow per share is not positive"]
        : []),
      ...(coverage < 6 ? ["Fundamental provider coverage is incomplete"] : []),
    ],
    valuation =
      valuationAttractiveness >= 65
        ? "CHEAP_OR_ATTRACTIVE"
        : valuationAttractiveness >= 45
          ? "FAIR"
          : "RICH",
    thesisStatus =
      fundamentalQuality >= 65 && growthQuality >= 55
        ? "INTACT"
        : fundamentalQuality < 40
          ? "WEAKENING"
          : "WATCH";
  const strategy = String(account.strategy_type),
    swing = /SWING|OPTIONS/i.test(strategy),
    fundamentalsPositive =
      fundamentalQuality >= 60 &&
      growthQuality >= 50 &&
      balanceSheetQuality >= 45,
    valuationAcceptable = valuationAttractiveness >= 45,
    adverseNews = fundamental.news.filter((item: Json) => {
      const published = Number(item.datetime || 0) * 1000;
      const recentEnough = published > Date.now() - 72 * 3600_000;
      return recentEnough && /cut|miss|downgrade|investigation|lawsuit|decline|weak|warning|delay|cancel|fraud|probe|guidance lowered/i.test(`${item.headline || ""} ${item.summary || ""}`);
    }),
    deteriorationReasons = [
      ...(dayChangePct !== null && dayChangePct <= -2.5 ? [`Current session decline ${dayChangePct.toFixed(1)}% exceeds the BUY release limit`] : []),
      ...(threeDayReturnPct !== null && threeDayReturnPct <= -4 ? [`Three-session momentum ${threeDayReturnPct.toFixed(1)}% is deteriorating`] : []),
      ...(pullbackFromHighPct !== null && pullbackFromHighPct <= -7 ? [`Price is ${Math.abs(pullbackFromHighPct).toFixed(1)}% below its recent high`] : []),
      ...(currentPrice < sma20 ? ["Price is below SMA20"] : []),
      ...(adverseNews.length ? [`${adverseNews.length} recent adverse company-news item${adverseNews.length === 1 ? "" : "s"} require review`] : []),
    ],
    catalystGate = evaluateCatalystEntryGate(catalystContext, { mode: "SHARES" }),
    technicalPositive =
      technicalState === "BULLISH" &&
      Number(relativeVolume || 0) >= 0.8 &&
      deteriorationReasons.length === 0,
    conflicts: string[] = [];
  if (technicalPositive && !valuationAcceptable)
    conflicts.push(
      "Technical setup is bullish, but valuation is not attractive",
    );
  if (fundamentalsPositive && technicalState === "BEARISH")
    conflicts.push(
      "Company fundamentals are constructive, but the short-term chart is bearish",
    );
  if (!fundamentalsPositive && technicalPositive)
    conflicts.push(
      "Price trend is bullish while fundamental quality remains insufficient",
    );
  if (deteriorationReasons.length)
    conflicts.push(...deteriorationReasons);

  const marketMaxAgeMs = swing ? 15 * 60_000 : 24 * 3600_000,
    fundamentalMaxAgeMs = 7 * 86400000,
    dataIssues: string[] = [];
  if (!quote?.last) dataIssues.push("Current market quote is unavailable.");
  if (!Number.isFinite(marketAge))
    dataIssues.push(
      "The market provider did not return a valid quote timestamp.",
    );
  else if (marketAge > marketMaxAgeMs)
    dataIssues.push(
      `The market quote is ${Math.max(1, Math.round(marketAge / 60000))} minutes old; this ${swing ? "swing" : "long-term"} account requires data no older than ${swing ? "15 minutes" : "24 hours"}.`,
    );
  if (bars.length < 50)
    dataIssues.push(
      `Only ${bars.length} daily price bars were received; at least 50 are required for trend and risk analysis.`,
    );
  if (!fundamental.available)
    dataIssues.push(
      `Fundamental data is unavailable (${fundamental.provider || "provider status unknown"}).`,
    );
  if (!Number.isFinite(fundamentalAge))
    dataIssues.push(
      "The fundamental provider did not return a valid timestamp.",
    );
  else if (fundamentalAge > fundamentalMaxAgeMs)
    dataIssues.push(
      `Fundamental data is ${Math.max(1, Math.round(fundamentalAge / 86400000))} days old; the maximum is 7 days.`,
    );
  if (coverage < 4)
    dataIssues.push(
      `Only ${coverage} of 8 required fundamental metrics are available; at least 4 are required.`,
    );
  const stale = dataIssues.length > 0;
  let action = "WAIT",
    reason = "Evidence is mixed; wait for a better risk-adjusted setup.",
    confidence = clamp(
      (fundamentalQuality +
        growthQuality +
        balanceSheetQuality +
        valuationAttractiveness +
        (technicalState === "BULLISH"
          ? 75
          : technicalState === "BEARISH"
            ? 25
            : 50)) /
        5,
    );
  if (stale) {
    action = "WAIT";
    confidence = Math.min(confidence, 45);
    reason = `WAIT — DATA REFRESH REQUIRED. ${dataIssues.join(" ")}`;
  } else if (swing) {
    if (
      technicalPositive &&
      fundamentalsPositive &&
      valuationAcceptable &&
      catalystGate.pass &&
      !conflicts.length
    ) {
      action = "BUY";
      reason =
        "Swing setup has technical confirmation and no fundamental or valuation veto.";
    } else if (!catalystGate.pass && technicalPositive && fundamentalsPositive && valuationAcceptable) {
      action = "WAIT";
      confidence = Math.min(confidence, 59);
      reason = catalystGate.summary;
      conflicts.push(...catalystGate.blockers);
    } else if (technicalState === "BEARISH") {
      action = "WAIT";
      reason = "Swing account: technical structure is bearish or unconfirmed.";
    }
  } else {
    if (
      fundamentalsPositive &&
      valuationAcceptable &&
      technicalState !== "BEARISH"
    ) {
      action = prior?.action === "HOLD" ? "HOLD" : "ACCUMULATE";
      reason =
        "Long-term fundamentals, valuation, and entry conditions are sufficiently aligned.";
    } else if (fundamentalsPositive && !valuationAcceptable) {
      action = "WAIT";
      reason =
        "Strong company quality, but expected return is not attractive enough at the current valuation — wait for a better price.";
    } else if (fundamentalsPositive && technicalState === "BEARISH") {
      action = "HOLD";
      reason =
        "Long-term thesis remains constructive; use technical weakness for monitoring rather than an automatic sale.";
    }
  }
  if (conflicts.length && action === "BUY") {
    action = "WAIT";
    reason = `${conflicts.join("; ")} — WAIT.`;
  }
  const riskSettings=await accountRiskSettings(db,input.householdId,input.accountId);
  const riskPolicy=riskSettings.effective;
  const exposures=(await db.prepare("SELECT s.ticker,h.quantity::text,h.price_cents::text,p.state_json FROM holdings h JOIN securities s ON s.id=h.security_id LEFT JOIN position_states p ON p.account_id=h.account_id AND p.security_id=h.security_id WHERE h.account_id=? AND h.quantity>0").bind(input.accountId).all<Json>()).results;
  // Unknown sector membership and protective stops consume conservative capacity.
  const invested=exposures.reduce((sum,h)=>sum+Number(h.quantity)*Number(h.price_cents)/100,0);
  const existingPosition=exposures.filter(h=>h.ticker===symbol).reduce((sum,h)=>sum+Number(h.quantity)*Number(h.price_cents)/100,0);
  const openRisk=exposures.reduce((sum,h)=>sum+holdingOpenRisk(h.quantity,h.price_cents,h.state_json),0);
  const equity=riskSettings.value,sectorRoom=Math.max(0,equity*riskPolicy.maxSectorBps/10000-invested),remainingOpenRisk=Math.max(0,equity*riskPolicy.combinedRiskBps/10000-openRisk),liquidityShares=Number(quote?.volume)>0?Math.floor(Number(quote?.volume)*.001):null;
  const reservation = await db.prepare("SELECT COALESCE(SUM((plan_json->>'reservedCash')::numeric),0)::text total FROM trade_lifecycle_exits WHERE account_id=? AND status IN ('REENTRY_WATCH','REENTRY_READY')").bind(input.accountId).first<Json>();
  const price = Number(quote?.last || 0),
    risk = Math.max(0.01, price - Number(support || price * 0.94)),
    cash = Math.max(0,Number(account.cash_cents || 0) / 100-Number(reservation?.total||0)),
    maxRisk = Number(account.maximum_risk_bps ?? 50) / 10000,
    accountValueRow = await db
      .prepare(
        "SELECT COALESCE(SUM(h.quantity*h.price_cents),0)::text value_cents FROM holdings h WHERE h.account_id=?",
      )
      .bind(input.accountId)
      .first<Json>(),
    accountValue = Number(accountValueRow?.value_cents || 0) / 100 + cash,
    sizing = positionSizing({entry:price,stop:Number(support),equity,cash:Number(account.cash_cents||0)/100,reservedCash:Number(reservation?.total||0),cashReserveBps:riskPolicy.cashReserveBps,riskBps:riskPolicy.swingRiskBps,positionBps:riskPolicy.maxPositionBps,existingPosition,sectorRoom,remainingOpenRisk,liquidityShares}),
    shares = sizing.shares,
    generatedAt = new Date(),
    expiresAt = new Date(
      generatedAt.getTime() + (swing ? 30 * 60_000 : 24 * 3600_000),
    ),
    modelVersion =
      process.env.NORTHSTAR_CHAMPION_MODEL_VERSION ||
      "northstar-decision-1.0.0",
    strategyVersion =
      process.env.NORTHSTAR_STRATEGY_VERSION || "account-strategy-1.0.0",
    researchSnapshotId = id("research"),
    marketSnapshotId = id("market"),
    checks: Json = {
      company: {industry:fundamental.profile.finnhubIndustry||null},
      recommendationId: null,
      account: { id: account.id, name: account.account_name, strategy },
      sources: {
        market: { provider: quote?.source || quoteSet.feed, asOf: marketAsOf },
        fundamental: { provider: fundamental.provider, asOf: fundamental.asOf },
        technical: { provider: barsSet.feed || quoteSet.feed, asOf: barsAsOf },
      },
      fundamentalThesis: {
        fundamentalQuality,
        growthQuality,
        balanceSheetQuality,
        valuationAttractiveness,
        capitalEfficiency: roe,
        earningsQuality,
        competitivePosition,
        fundamentalRisks,
        bullCase:
          "Growth and cash generation exceed expectations while valuation remains supportable.",
        baseCase: "Execution continues near current provider estimates.",
        bearCase:
          "Growth slows, margins compress, or debt/capital intensity reduces future returns.",
        thesisStatus,
        dataTimestamp: fundamental.asOf,
        metrics: {
          marketCap,
          revenueGrowth,
          epsGrowth,
          grossMargin,
          operatingMargin,
          netMargin,
          fcfPerShare,
          roe,
          debtEquity,
          forwardPe,
          trailingPe,
        },
      },
      valuation: {
        state: valuation,
        forwardPe,
        trailingPe,
        supportingMetrics: {
          growth: revenueGrowth,
          margin: operatingMargin,
          fcfPerShare,
        },
      },
      technical: {
        state: technicalState,
        price,
        sma20,
        sma50,
        support,
        resistance,
        relativeVolume,
        dayChangePct,
        threeDayReturnPct,
        pullbackFromHighPct,
        adverseNewsCount: adverseNews.length,
        deteriorationReasons,
      },
      marketRegime: "NOT_AVAILABLE",
      catalysts: { ...catalystGate, events: catalystContext.events },
      news: {
        state: fundamental.news.length ? "MIXED" : "UNAVAILABLE",
        items: fundamental.news.slice(0, 5).map((item: any) => ({
          headline: item.headline,
          source: item.source,
          datetime: item.datetime,
        })),
      },
      flow: await new QuantDataProvider(db).getEvidence(symbol).catch(()=>({state:"UNAVAILABLE",canAuthorizeTrade:false})),
      portfolioFit: {
        sectorRoomCents:sectorRoom*100,remainingOpenRiskCents:remainingOpenRisk*100,liquidityShares,sizingReason:sizing.reason,riskPolicy,capacityBasis:"Unknown sectors grouped together; missing stops reserve full position value",
        state: shares > 0 ? "GOOD" : "INSUFFICIENT_CASH_OR_RISK_CAPACITY",
        cash,
        accountValue,
        shares,
      },
      conflicts,
      whyThisAction: reason,
      whatWouldChange:
        action === "WAIT"
          ? [
              ...dataIssues.map((issue) => `Resolve: ${issue}`),
              ...(dataIssues.length
                ? []
                : ["Fresh provider data passes every gate"]),
              "Valuation becomes attractive relative to growth and quality",
              "Technical confirmation aligns with the account strategy",
            ]
          : [
              "Fundamental thesis deteriorates",
              "Price closes below invalidation",
              "Valuation or concentration exceeds the account limit",
            ],
      freshness: {
        marketAgeMs: marketAge,
        marketMaxAgeMs,
        fundamentalAgeMs: fundamentalAge,
        fundamentalMaxAgeMs,
        quoteAsOf: marketAsOf,
        barsAsOf,
        fundamentalAsOf: fundamental.asOf,
        barsReceived: bars.length,
        fundamentalMetricsAvailable: coverage,
        fundamentalMetricsRequired: 4,
        marketProvider: quote?.source || quoteSet.feed,
        fundamentalProvider: fundamental.provider,
        issues: dataIssues,
        stale,
      },
    };
  if (["BUY", "ACCUMULATE"].includes(action) && shares < 1) {
    action = "WAIT";
    confidence = Math.min(confidence, 55);
    reason =
      "NO ACTION — the selected account does not have enough available cash and risk capacity for one share.";
    conflicts.push(
      "Account cash and risk capacity do not support the minimum position size",
    );
    checks.whyThisAction = reason;
    checks.conflicts = conflicts;
    checks.portfolioFit = {
      state: "INSUFFICIENT_CASH_OR_RISK_CAPACITY",
      cash,
      accountValue,
      shares: 0,
    };
  }
  if (symbol === "ORCL")
    checks.companySpecific = {
      ociRevenueGrowth: null,
      remainingPerformanceObligations: null,
      cloudInfrastructureMomentum: null,
      aiBacklogConversion: null,
      capexIntensity: null,
      freeCashFlowAfterCapex: null,
      aiInfrastructureFinancingRisk: null,
      dataStatus:
        "These ORCL-specific filing/transcript facts are unavailable from the configured structured provider and are not inferred.",
    };
  const security = await db
      .prepare(
        "INSERT INTO securities(id,ticker,name,type,currency) VALUES(?,?,?,'equity','USD') ON CONFLICT(ticker,type) DO UPDATE SET name=COALESCE(EXCLUDED.name,securities.name) RETURNING id",
      )
      .bind(id("security"), symbol, fundamental.profile.name || symbol)
      .first<{ id: string }>(),
    recommendationId = id("recommendation");
  checks.recommendationId = recommendationId;
  checks.researchOnly = true;
  await db.transaction(async (tx) => {
    const active = await tx
      .prepare(
        `SELECT r.id FROM recommendations r JOIN securities s ON s.id=r.security_id WHERE r.household_id=? AND r.account_id=? AND s.ticker=? AND r.lifecycle IN ('MONITORING','TRIGGERED') FOR UPDATE`,
      )
      .bind(input.householdId, input.accountId, symbol)
      .all<{ id: string }>();
    for (const row of active.results)
      await tx
        .prepare("UPDATE recommendations SET lifecycle='SUPERSEDED' WHERE id=?")
        .bind(row.id)
        .run();
    await tx
      .prepare(
        `INSERT INTO recommendations(id,household_id,account_id,security_id,strategy_type,action,lifecycle,suggested_quantity,entry_low_cents,entry_high_cents,ideal_price_cents,invalidation_cents,targets_json,confidence,reason,checks_json,actionable,model_version,evidence_as_of,expires_at,strategy_version,research_snapshot_id,market_snapshot_id,generated_at) VALUES(?,?,?,?,?,?,'MONITORING',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        recommendationId,
        input.householdId,
        input.accountId,
        security!.id,
        strategy,
        action,
        String(action === "BUY" || action === "ACCUMULATE" ? shares : 0),
        support ? Math.round(Number(support) * 100) : null,
        price ? Math.round(price * 100) : null,
        price ? Math.round(price * 100) : null,
        support ? Math.round(Number(support) * 100) : null,
        JSON.stringify(
          resistance ? [Math.round(Number(resistance) * 100)] : [],
        ),
        confidence,
        reason,
        JSON.stringify(checks),
        false, // Research facts are published only after the central AI gate.
        modelVersion,
        marketAsOf,
        expiresAt.toISOString(),
        strategyVersion,
        researchSnapshotId,
        marketSnapshotId,
        generatedAt.toISOString(),
      )
      .run();
    for (const row of active.results)
      await tx
        .prepare("UPDATE recommendations SET superseded_by=? WHERE id=?")
        .bind(recommendationId, row.id)
        .run();
  });
  return {
    recommendation: {
      id: recommendationId,
      recommendationId,
      ticker: symbol,
      investmentAccountId: input.accountId,
      accountName: account.account_name,
      strategy,
      modelVersion,
      strategyVersion,
      researchSnapshotId,
      marketSnapshotId,
      generatedAt: generatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      action,
      confidence,
      quantity: ["BUY", "ACCUMULATE"].includes(action) ? shares : 0,
      reason,
      evidenceAsOf: marketAsOf,
    },
    checks,
    source: "GENERATED",
  };
}

/** All user-facing surfaces consume the same account-scoped published decision. */
export async function authoritativeRecommendation(db:PostgresDatabase,input:{householdId:string;accountId:string;symbol:string;force?:boolean}){
  const existing=await db.prepare("SELECT r.*,s.ticker FROM recommendations r JOIN securities s ON s.id=r.security_id WHERE r.household_id=? AND r.account_id=? AND s.ticker=? AND r.checks_json->'aiEvidence' IS NOT NULL AND r.lifecycle IN ('MONITORING','TRIGGERED') AND r.expires_at>CURRENT_TIMESTAMP ORDER BY r.created_at DESC LIMIT 1").bind(input.householdId,input.accountId,input.symbol.toUpperCase()).first<Json>();
  if(existing&&!input.force)return {recommendation:existing,checks:parse(existing.checks_json),source:"CENTRAL_AI_PERSISTED"};
  await researchRecommendation(db,input);
  const {runTradeLifecycle}=await import("@/lib/trade-lifecycle-service");
  await runTradeLifecycle(db,input.householdId,input.accountId,{symbol:input.symbol.toUpperCase()});
  const published=await db.prepare("SELECT r.*,s.ticker FROM recommendations r JOIN securities s ON s.id=r.security_id WHERE r.household_id=? AND r.account_id=? AND s.ticker=? AND r.checks_json->'aiEvidence' IS NOT NULL ORDER BY r.created_at DESC LIMIT 1").bind(input.householdId,input.accountId,input.symbol.toUpperCase()).first<Json>();
  if(!published)throw new Error("CENTRAL_DECISION_UNAVAILABLE");
  return {recommendation:published,checks:parse(published.checks_json),source:"CENTRAL_AI"};
}
