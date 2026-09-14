"use client";
import { useMemo, useState } from "react";
type Holding = {
  ticker: string;
  name: string;
  value: number;
  quantity: number;
  price: number;
  bucket: string;
  weight: number;
  isFund: boolean;
};
type AllocationRow = {
  key: string;
  label: string;
  actual: number;
  target: number;
  delta: number;
  status: string;
  amount: number;
};
type Candidate = {
  symbol: string;
  name: string;
  price?: number;
  adjusted?: number;
  gap?: number | null;
  isHeld?: boolean;
  accountWhy?: string;
  sizeAtLimit?: boolean;
  positionLimit?: number;
  weight?: number;
};
type Props = {
  accountName: string;
  accountType: string;
  accountValue: number;
  accountCash: number;
  householdCash: number;
  monthlyIncome: number;
  monthlySpending: number;
  holdings: Holding[];
  rows: AllocationRow[];
  candidates: Candidate[];
  targetMix: Record<string, number>;
};
type Action = {
  tone: string;
  title: string;
  detail: string;
  amount: number;
  shares: number | null;
  symbol: string;
  trigger: string;
  funding: string;
  timing:
    | "BUY FIRST TRANCHE"
    | "WAIT FOR PULLBACK"
    | "DO NOT BUY"
    | "TRIM REVIEW"
    | "NO ACTION";
  sourceRank?: number;
};
const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const models: Record<string, { symbol: string; label: string }> = {
  cash: { symbol: "CASH", label: "Money market / stable value" },
  bonds: { symbol: "BND", label: "Broad investment-grade bond ETF" },
  diversified: { symbol: "VTI", label: "Total U.S. stock-market ETF" },
  dividend: { symbol: "SCHD", label: "Dividend-growth ETF" },
  growth: { symbol: "QQQ", label: "Diversified growth ETF" },
};
export default function LongTermPortfolioPlan({
  accountName,
  accountType,
  accountValue,
  accountCash,
  householdCash,
  monthlyIncome,
  monthlySpending,
  holdings,
  rows,
  candidates,
  targetMix,
}: Props) {
  const [templateAmount, setTemplateAmount] = useState(
      Math.max(10000, Math.round((accountValue || 100000) / 1000) * 1000),
    ),
    [showTemplate, setShowTemplate] = useState(false);
  const plan = useMemo(() => {
    const monthlySurplus = Math.max(0, monthlyIncome - monthlySpending),
      protectedReserve = Math.max(monthlySpending * 3, 1000),
      cashAboveReserve = Math.max(0, householdCash - protectedReserve),
      freshCash = Math.max(
        0,
        Math.floor(Math.min(monthlySurplus * 0.5, cashAboveReserve / 6) / 50) *
          50,
      ),
      actions: Action[] = [],
      used = new Set<string>();
    const buyTiming = (
      candidate: Candidate | undefined,
      price: number,
      amount: number,
      shares: number | null,
    ): Action["timing"] => {
      if (candidate?.sizeAtLimit) return "DO NOT BUY";
      if (!price || !amount || shares === null) return "NO ACTION";
      const valuationGap = Number(candidate?.gap ?? 0);
      if (valuationGap > 25) return "DO NOT BUY";
      if (valuationGap > 0) return "WAIT FOR PULLBACK";
      return "BUY FIRST TRANCHE";
    };
    for (const row of rows.filter((item) => item.status === "overweight")) {
      const largest = holdings
        .filter((item) => item.bucket === row.key)
        .sort((a, b) => b.value - a.value)[0];
      if (!largest) continue;
      used.add(largest.ticker);
      actions.push({
        tone: "watch",
        title: `Hold ${largest.ticker} · stop adding while concentration is reviewed`,
        detail: `${row.label} is ${row.actual.toFixed(1)}% versus the ${row.target}% target, but portfolio size alone does not justify selling a strong holding. Redirect new contributions and preserve the position unless the complete sell-evidence gate fails.`,
        amount: 0,
        shares: null,
        symbol: largest.ticker,
        trigger:
          "SELL NOT JUSTIFIED. A future sell review requires confirmed fundamental deterioration, unattractive valuation, weakening forward outlook/prediction, broken thesis, unacceptable risk, tax/account review, and a demonstrably better replacement. Concentration alone cannot pass this gate.",
        funding:
          "No sale proceeds assumed. New purchases may use only existing Roth cash or an approved new contribution.",
        timing: "NO ACTION",
      });
    }
    let remainingAccount = Math.max(0, accountCash),
      remainingFresh = freshCash,
      remainingSale = 0;
    const allocate = (wanted: number) => {
      const account = Math.min(wanted, remainingAccount);
      remainingAccount -= account;
      const fresh = Math.min(wanted - account, remainingFresh);
      remainingFresh -= fresh;
      const sale = 0;
      const total = account + fresh + sale,
        parts: string[] = [];
      if (account) parts.push(`${usd(account)} existing Roth cash`);
      if (fresh) parts.push(`${usd(fresh)} proposed new contribution`);
      return {
        total,
        source: parts.length
          ? parts.join(" + ")
          : "No safe funding source is currently available",
      };
    };
    for (const row of rows.filter((item) => item.status === "underweight")) {
      const existing = holdings
          .filter((item) => item.bucket === row.key)
          .sort((a, b) => b.value - a.value)[0],
        model = models[row.key] || { symbol: row.label, label: row.label },
        candidate =
          candidates.find((item) => item.symbol === existing?.ticker) ||
          candidates.find(
            (item) => item.symbol === model.symbol && !item.sizeAtLimit,
          ) ||
          candidates.find(
            (item) => !used.has(item.symbol) && !item.sizeAtLimit,
          ),
        symbol = existing?.ticker || candidate?.symbol || model.symbol,
        price = existing?.price || Number(candidate?.price || 0),
        allocation = allocate(Math.max(0, row.amount)),
        shares =
          price > 0 && allocation.total >= price
            ? Math.floor(allocation.total / price)
            : null,
        timing = buyTiming(candidate, price, allocation.total, shares),
        pullbackPrice =
          price * (Number(candidate?.gap ?? 0) > 10 ? 0.93 : 0.97);
      used.add(symbol);
      actions.push({
        tone: allocation.total > 0 ? "healthy" : "watch",
        title: existing
          ? `Buy-more plan for owned ${symbol}`
          : `Long-Term Opportunity: research ${symbol}`,
        detail: `${row.label} is ${row.actual.toFixed(1)}% versus its ${row.target}% target, about ${usd(row.amount)} underweight. ${candidate?.accountWhy || `${model.label} is the portfolio-role reference.`}`,
        amount: allocation.total,
        shares,
        symbol,
        trigger:
          timing === "BUY FIRST TRANCHE"
            ? `Best available window: the valuation gap is not positive. After refreshing the evidence, deploy only the first 50% tranche near ${usd(price)} and keep the remainder for the next scheduled review.`
            : timing === "WAIT FOR PULLBACK"
              ? `Wait for approximately ${usd(pullbackPrice)} or lower, then refresh valuation, trend and news before approving a first tranche.`
              : timing === "DO NOT BUY"
                ? "Do not buy at the current valuation or position size. Re-evaluate after price, fundamentals, or account weight changes."
                : "Price or funded whole-share quantity is unavailable. Do nothing until both are verified.",
        funding: allocation.source,
        timing,
        sourceRank: candidates.findIndex((item) => item.symbol === symbol) + 1,
      });
    }
    for (const candidate of candidates
      .filter((item) => !used.has(item.symbol))
      .slice(0, 3)) {
      const available = remainingAccount + remainingFresh + remainingSale,
        allocation = allocate(
          Math.min(Math.max(accountValue * 0.02, 250), Math.max(0, available)),
        ),
        price = Number(candidate.price || 0),
        shares =
          price > 0 && allocation.total >= price
            ? Math.floor(allocation.total / price)
            : null,
        rank =
          candidates.findIndex((item) => item.symbol === candidate.symbol) + 1,
        timing = buyTiming(
          candidate,
          price,
          candidate.sizeAtLimit ? 0 : allocation.total,
          candidate.sizeAtLimit ? null : shares,
        ),
        pullbackPrice = price * (Number(candidate.gap ?? 0) > 10 ? 0.93 : 0.97);
      actions.push({
        tone:
          allocation.total > 0 && !candidate.sizeAtLimit ? "healthy" : "watch",
        title: candidate.isHeld
          ? `Ranked opportunity: consider adding to ${candidate.symbol}`
          : `Ranked opportunity: evaluate ${candidate.symbol}`,
        detail: `#${rank} from Long-Term Opportunities for this exact account. ${candidate.accountWhy || "It must pass diversification, valuation, quality and account-fit review before inclusion."}`,
        amount: candidate.sizeAtLimit ? 0 : allocation.total,
        shares: candidate.sizeAtLimit ? null : shares,
        symbol: candidate.symbol,
        trigger: candidate.sizeAtLimit
          ? `Do not buy: the holding is already near or above its ${candidate.positionLimit || "configured"}% position limit.`
          : timing === "BUY FIRST TRANCHE"
            ? `Best available window: review now and, only if the full thesis still passes, deploy the first 50% tranche near ${usd(price)}.`
            : timing === "WAIT FOR PULLBACK"
              ? `Wait for approximately ${usd(pullbackPrice)} or lower, then refresh price, valuation, trend, fundamentals and news.`
              : timing === "DO NOT BUY"
                ? "Current valuation is too extended for this account. Do not buy; keep it on the watch list."
                : "Wait for a verified quote and a funded whole-share quantity.",
        funding: candidate.sizeAtLimit
          ? "No funding allocated because the position-size control blocks another purchase."
          : allocation.source,
        timing,
        sourceRank: rank,
      });
      used.add(candidate.symbol);
    }
    return {
      monthlySurplus,
      protectedReserve,
      cashAboveReserve,
      freshCash,
      actions,
      unallocated: remainingAccount + remainingFresh,
      conditionalSaleRemaining: remainingSale,
    };
  }, [
    monthlyIncome,
    monthlySpending,
    householdCash,
    rows,
    holdings,
    candidates,
    accountCash,
    accountValue,
  ]);
  const template = Object.entries(targetMix).map(([key, pct]) => {
      const model = models[key] || { symbol: key.toUpperCase(), label: key },
        holding = holdings.find((item) => item.ticker === model.symbol),
        candidate = candidates.find((item) => item.symbol === model.symbol),
        price = holding?.price || Number(candidate?.price || 0),
        dollars = (templateAmount * pct) / 100,
        shares =
          model.symbol === "CASH"
            ? null
            : price > 0
              ? Math.floor(dollars / price)
              : null;
      return { ...model, pct, dollars, shares, price };
    }),
    transactionActions = plan.actions.filter((action) => action.amount > 0),
    primaryAction = plan.actions.find(
      (action) => action.timing === "BUY FIRST TRANCHE",
    ),
    primaryShares = primaryAction?.shares
      ? Math.max(1, Math.floor(primaryAction.shares / 2))
      : 0,
    primaryAmount = primaryAction ? Math.round(primaryAction.amount / 2) : 0;
  return (
    <section className="long-term-account-plan">
      <header>
        <div>
          <span>ACCOUNT-SPECIFIC LONG-TERM PLAN</span>
          <h2>What to do this week and this month</h2>
          <p>
            {accountName} · {accountType}. This imports the ranked Long-Term
            Opportunities for this account and assigns each dollar only once.
            Nothing is traded or transferred automatically.
          </p>
        </div>
        <strong>
          {transactionActions.length
            ? `${transactionActions.length} FUNDED ACTIONS`
            : "NO FUNDED TRADE"}
          <small>{plan.actions.length} reviews · financial impact order</small>
        </strong>
      </header>
      <section
        className={`long-term-decision ${primaryAction ? "do" : "wait"}`}
      >
        <strong>{primaryAction ? "DO THIS NEXT" : "DO NOTHING NOW"}</strong>
        {primaryAction ? (
          <>
            <b>
              Review a first tranche of {primaryShares.toLocaleString()} shares
              of {primaryAction.symbol}, using up to {usd(primaryAmount)}.
            </b>
            <span>
              {primaryAction.funding} · {primaryAction.trigger}
            </span>
          </>
        ) : (
          <>
            <b>
              Do not buy, sell, or transfer money for this Roth account now.
            </b>
            <span>
              No fully funded recommendation has both a verified share quantity
              and acceptable account fit. Keep the current holdings and review
              again after prices, cash, or allocation gaps change.
            </span>
          </>
        )}
      </section>
      <div className="long-term-cash-check">
        <article>
          <small>Existing account cash</small>
          <b>{usd(accountCash)}</b>
        </article>
        <article>
          <small>Protected household reserve</small>
          <b>{usd(plan.protectedReserve)}</b>
        </article>
        <article>
          <small>Cash above reserve</small>
          <b>{usd(plan.cashAboveReserve)}</b>
        </article>
        <article>
          <small>Suggested fresh-cash transfer</small>
          <b>{usd(plan.freshCash)}</b>
          <em>
            {plan.freshCash > 0
              ? "This month · requires approval"
              : "Do not transfer this month"}
          </em>
        </article>
      </div>
      <div className="long-term-action-list">
        {plan.actions.map((action, index) => (
          <article className={action.tone} key={`${action.symbol}_${index}`}>
            <i>{index + 1}</i>
            <div>
              <span
                className={`timing timing-${action.timing.toLowerCase().replaceAll(" ", "-")}`}
              >
                {action.timing} ·{" "}
                {action.sourceRank && action.sourceRank > 0
                  ? `LONG-TERM OPPORTUNITY #${action.sourceRank} · `
                  : ""}
                {action.shares !== null && action.amount > 0
                  ? `${action.shares.toLocaleString()} SHARES · UP TO ${usd(action.amount)}`
                  : action.amount > 0
                    ? `UP TO ${usd(action.amount)}`
                    : "REVIEW · NO TRANSACTION NOW"}
              </span>
              <h3>{action.title}</h3>
              <p>{action.detail}</p>
              <small>
                <b>Funding:</b> {action.funding}
              </small>
              <small>
                <b>Timing and condition:</b> {action.trigger}
              </small>
            </div>
          </article>
        ))}
      </div>
      <div className="long-term-plan-balance">
        <b>Capital reconciliation</b>
        <span>{usd(plan.unallocated)} approved cash remains unassigned.</span>
        {plan.conditionalSaleRemaining > 0 && (
          <span>
            {usd(plan.conditionalSaleRemaining)} of proposed sale proceeds
            remains conditional and is not counted as owned cash.
          </span>
        )}
      </div>
      <footer>
        <div>
          <span>MODEL PORTFOLIO BUILDER</span>
          <b>Create a complete allocation template</b>
          <small>
            Choose a total amount. Northstar calculates target dollars and
            estimated whole shares when a usable price exists.
          </small>
        </div>
        <label>
          Total portfolio amount
          <input
            type="number"
            min="1000"
            step="1000"
            value={templateAmount}
            onChange={(event) =>
              setTemplateAmount(Math.max(0, Number(event.target.value)))
            }
          />
        </label>
        <button
          type="button"
          onClick={() => setShowTemplate((value) => !value)}
        >
          {showTemplate ? "Hide template" : "Create template portfolio"}
        </button>
      </footer>
      {showTemplate && (
        <div className="portfolio-template">
          <header>
            <b>{usd(templateAmount)} model portfolio</b>
            <span>
              Planning template only · verify funds, prices, fees, taxes and
              account restrictions
            </span>
          </header>
          {template.map((item) => (
            <article key={item.symbol}>
              <span>
                <b>
                  {item.symbol} · {item.label}
                </b>
                <small>{item.pct}% target</small>
              </span>
              <strong>
                {usd(item.dollars)}
                <small>
                  {item.symbol === "CASH"
                    ? "cash allocation"
                    : item.shares !== null
                      ? `about ${item.shares.toLocaleString()} whole shares at ${usd(item.price)}`
                      : "share estimate requires a current price"}
                </small>
              </strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
