/* eslint-disable @typescript-eslint/no-explicit-any */
import {entryOrderReady} from "@/lib/entry-plan";
import type { PostgresDatabase } from "@/lib/db";
type J = Record<string, any>;
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const parse = (value: any, fallback: any) => {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
};
const sectorFor = (ticker: string, name: string, providerSector: string) =>
  providerSector ||
  (/NVDA|AVGO|AMD|QCOM|TSM|SEMICONDUCTOR/i.test(`${ticker} ${name}`)
    ? "Semiconductors"
    : /MSFT|ORCL|CRM|SOFTWARE|TECH/i.test(`${ticker} ${name}`)
      ? "Technology"
      : "Unknown");
export async function rankCandidatesForAccount(
  db: PostgresDatabase,
  householdId: string,
  accountId: string,
  rows: J[],
) {
  const account = await db
    .prepare(
      `SELECT a.id,COALESCE(a.nickname,a.name) account_name,COALESCE(a.investment_purpose,s.strategy_type,'Long-term') strategy,COALESCE(a.current_balance_cents,0)::text balance_cents,COALESCE(s.available_cash_cents,a.available_balance_cents,0)::text cash_cents FROM accounts a JOIN entities e ON e.id=a.entity_id LEFT JOIN investment_account_settings s ON s.account_id=a.id WHERE a.id=? AND e.household_id=?`,
    )
    .bind(accountId, householdId)
    .first<J>();
  if (!account) throw new Error("Selected investment account was not found");
  const holdings = (
      await db
        .prepare(
          `SELECT sec.ticker,sec.name,SUM(h.quantity*COALESCE(h.price_cents,0))::text value_cents FROM holdings h JOIN securities sec ON sec.id=h.security_id WHERE h.account_id=? GROUP BY sec.ticker,sec.name`,
        )
        .bind(accountId)
        .all<J>()
    ).results,
    total = Math.max(
      1,
      Number(account.balance_cents || 0),
      holdings.reduce((sum, row) => sum + Number(row.value_cents || 0), 0),
    ),
    strategy = String(account.strategy || "Long-term"),
    swing = /swing|trading/i.test(strategy),
    retirement = /retire|401|ira/i.test(strategy),
    owned = new Map(
      holdings.map((row) => [
        String(row.ticker).toUpperCase(),
        (Number(row.value_cents || 0) / total) * 100,
      ]),
    ),
    sectorWeights: J = {};
  for (const holding of holdings) {
    const sector = sectorFor(holding.ticker, holding.name, "");
    sectorWeights[sector] =
      (sectorWeights[sector] || 0) +
      (Number(holding.value_cents || 0) / total) * 100;
  }
  const central=(await db.prepare("SELECT DISTINCT ON(s.ticker) s.ticker,r.* FROM recommendations r JOIN securities s ON s.id=r.security_id WHERE r.account_id=? AND r.household_id=? ORDER BY s.ticker,r.created_at DESC").bind(accountId,householdId).all<J>()).results;
  const ranked = rows
    .map((row) => {
      const ticker = String(row.symbol || row.ticker).toUpperCase(),
        metrics = parse(row.metrics, parse(row.metrics_json, {})),
        quality = Number(
          row.business_quality ?? row.business_quality_score ?? 0,
        ),
        growth = Number(
          row.growth_acceleration ?? row.growth_acceleration_score ?? 0,
        ),
        valuation = Number(row.valuation ?? row.valuation_score ?? 0),
        technical = Number(row.technical_setup ?? row.technical_score ?? 0),
        risk = Number(row.risk ?? row.risk_score ?? 50),
        confidence = Number(row.discovery_confidence ?? row.ai_confidence ?? 0),
        technicalData = parse(row.technical, parse(row.technical_json, {})),
        sector = sectorFor(ticker, row.company_name, row.sector),
        existingWeight = owned.get(ticker) || 0,
        sectorWeight = sectorWeights[sector] || 0,
        currentPrice = Number(metrics.price || 0),
        entryLow = Number(technicalData.entryZoneLow || metrics.sma20 || 0),
        entryHigh = Number(
          technicalData.entryZoneHigh || metrics.resistance || 0,
        ),
        invalidation = Number(
          technicalData.invalidation || metrics.support || 0,
        ),
        relativeVolume = Number(metrics.relativeVolume || 0),
        cash = Number(account.cash_cents || 0) / 100;
      let fit =
        72 -
        existingWeight * 3 -
        Math.max(0, sectorWeight - 25) * 1.5 -
        risk * 0.18;
      if (swing)
        fit +=
          technical * 0.18 +
          Number(metrics.relativeVolume || 0) * 3 -
          quality * 0.04;
      if (retirement)
        fit +=
          quality * 0.16 +
          valuation * 0.1 -
          risk * 0.22 -
          (String(row.cap_bucket) === "SMALL" ? 12 : 0);
      else fit += quality * 0.1 + growth * 0.08 + valuation * 0.08;
      fit = clamp(fit);
      const score = clamp(
        swing
          ? technical * 0.28 +
              confidence * 0.2 +
              growth * 0.14 +
              quality * 0.1 +
              valuation * 0.08 +
              fit * 0.2 -
              risk * 0.08
          : quality * 0.24 +
              growth * 0.18 +
              valuation * 0.18 +
              confidence * 0.14 +
              fit * 0.2 +
              technical * 0.08 -
              risk * 0.1,
      );
      const decision=central.find(x=>x.ticker===ticker),entry=parse(decision?.checks_json,{}).aiEvidence?.entryPlan;
      const confirmed=decision?.actionable===true&&Date.parse(decision?.expires_at)>Date.now()&&['BUY','ACCUMULATE','STRONG_BUY','BUY_PARTIAL','ADD','REENTER'].includes(decision.action)&&entryOrderReady(entry);
      const researchComplete =
          Date.now()-Date.parse(row.source_as_of)<36*3600000 &&
          Number(String(parse(row.evidence,parse(row.evidence_json,{})).fundamentalCoverage||"0").split("/")[0])>=4 &&
          currentPrice > 0 &&
          entryLow > 0 &&
          invalidation > 0 &&
          confidence >= 62 &&
          quality > 0 &&
          growth > 0 &&
          valuation > 0 &&
          technical > 0,
        priceInEntryZone =
          researchComplete &&
          currentPrice >= entryLow * 0.98 &&
          (!entryHigh || currentPrice <= entryHigh),
        buyNow =
          confirmed && researchComplete &&
          score >= 84 &&
          confidence >= 75 &&
          quality >= 65 &&
          growth >= 55 &&
          valuation >= 45 &&
          technical >= 68 &&
          fit >= 60 &&
          risk <= 55 &&
          priceInEntryZone &&
          relativeVolume >= 1 &&
          existingWeight <= 8 &&
          cash >= currentPrice,
        conditionalBuy =
          Boolean(entry)&&['BUY','ACCUMULATE','STRONG_BUY','BUY_PARTIAL','ADD','REENTER'].includes(decision?.action)&&parse(decision?.checks_json,{}).aiEvidence?.providerStatus==="AVAILABLE"&&Date.parse(decision?.expires_at)>Date.now()&&
          researchComplete &&
          score >= 76 &&
          confidence >= 65 &&
          quality >= 60 &&
          fit >= 55 &&
          risk <= 65 &&
          existingWeight <= 8 &&
          cash >= currentPrice,
        maxPositionDollars = Math.max(
          0,
          total / 1000 - ((existingWeight / 100) * total) / 100,
        ),
        affordableShares = currentPrice
          ? Math.floor(Math.min(cash, maxPositionDollars) / currentPrice)
          : 0,
        triggerPrice = entryLow || currentPrice,
        decisionCondition = buyNow
          ? `BUY NOW only while price remains between $${entryLow.toFixed(2)} and $${entryHigh.toFixed(2)}, relative volume remains at least 1.0×, and no material thesis-changing news appears.`
          : conditionalBuy
            ? `BUY IF price reclaims and holds $${triggerPrice.toFixed(2)} with relative volume at least 1.2×, technical score at least 68, and confidence at least 70%. Invalidate below $${invalidation.toFixed(2)}.`
            : researchComplete
              ? `NO BUY until price, fundamentals, valuation, account fit, and risk jointly pass the configured thresholds.`
              : "WAIT — required price, fundamental, valuation, technical, or risk evidence is incomplete.",
        rejected = row.status === "REJECTED" || confidence < 45 || fit < 30,
        label = rejected
          ? "REJECTED_NOT_SUITABLE"
          : buyNow
            ? "BUY_DECISION_READY"
            : conditionalBuy
              ? "CONDITIONAL_BUY"
              : score >= 68
                ? "GOOD_BUY_BUILD"
                : score >= 58
                  ? "WATCH_FOR_BETTER_ENTRY"
                  : "EARLY_WATCH",
        action = rejected
          ? "NO ACTION"
          : fit < 48
            ? "DO NOT ADD"
            : technical < 55
              ? "WAIT"
              : existingWeight > 8
                ? "HOLD / DO NOT ADD"
                : buyNow && affordableShares > 0
                  ? "BUY NOW"
                  : conditionalBuy && affordableShares > 0
                    ? "BUY IF"
                    : researchComplete
                      ? "NO ACTION"
                      : "WAIT — DATA REQUIRED",
        why =
          fit < 48
            ? `${ticker} conflicts with this account's current concentration or risk limits.`
            : swing
              ? `Technical ${technical}/100 and account fit ${fit}/100 drive the Swing ranking.`
              : retirement
                ? `Quality ${quality}/100, valuation ${valuation}/100 and retirement fit ${fit}/100 drive the rank.`
                : `Quality, growth, valuation and portfolio fit are balanced for ${strategy}.`,
        failure =
          risk >= 65
            ? `Risk score is ${risk}/100; downside, leverage, volatility or evidence gaps could invalidate the setup.`
            : technical < 55
              ? "Price confirmation is incomplete; a strong company can still be a poor entry."
              : "Fundamentals, valuation, market regime or portfolio concentration can change before action.";
      return {
        ...row,
        metrics,
        account_rank_score: score,
        portfolio_fit: fit,
        account_rank_label: label,
        ai_action: action,
        research_complete: researchComplete,
        decision_condition: decisionCondition,
        suggested_shares:
          action === "BUY NOW" || action === "BUY IF" ? Math.min(affordableShares,entry?.shares||0) : 0,
        estimated_cost:
          action === "BUY NOW"
            ? Math.min(affordableShares,entry?.shares||0) *
              Number(entry?.orderPrice||currentPrice)
            : 0,
        current_price: currentPrice,
        entry_plan:entry||null,
        trigger_price: action === "BUY IF" ? triggerPrice : currentPrice,
        invalidation_price: invalidation,
        account_strategy: strategy,
        existing_weight: existingWeight,
        sector_weight: sectorWeight,
        why_ranked: why,
        why_fail: failure,
        entry_attractiveness: clamp(valuation * 0.45 + technical * 0.55),
      };
    })
    .sort((a, b) => b.account_rank_score - a.account_rank_score)
    .map((row, index) => ({ ...row, account_rank: index + 1 }));
  return {
    account: {
      id: account.id,
      name: account.account_name,
      strategy,
      cashCents: Number(account.cash_cents || 0),
      holdingCount: holdings.length,
    },
    candidates: ranked,
  };
}
