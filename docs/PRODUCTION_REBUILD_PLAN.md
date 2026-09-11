# Northstar production rebuild plan

## Product boundary

Northstar is a read-only financial intelligence and decision-support product. It may analyze accounts, propose actions, monitor conditions, and record a transaction only after the user explicitly confirms that they executed it elsewhere. It must never submit a brokerage order, transfer, ACH transaction, payment, or Plaid transfer.

Every decision must identify, in order: account, goal, market context, company context, fundamentals, valuation, chart evidence, prediction, portfolio exposure, household capacity, risk budget, suggested quantity, price/condition, invalidation, and concise reason. Financial arithmetic is deterministic code. AI can explain and synthesize evidence but cannot invent or directly set action, shares, prices, stops, targets, or confidence.

## Repository audit — 2026-09-11

### Existing foundation to retain

- Next.js 15 and React 19 application deployed by AWS Amplify.
- PostgreSQL access with household-scoped query helpers.
- Cognito JWT verification with issuer, audience/client, expiry, algorithm, key, and signature checks.
- AES-GCM encryption for stored financial-provider tokens and AWS Secrets Manager loading.
- Read-only Plaid connection, account, holding, transaction, investment, liability, and sync routes.
- Manual investment accounts and manual holdings.
- Alpaca quote, bar, clock, snapshot, and options-data routes with server-only credentials.
- Finnhub fundamentals, NewsAPI.ai/Event Registry news, and FRED macro routes.
- Holding daily snapshots, market watchlists, alerts, audit log, household membership, and paper trading.
- A safe product posture: analysis and simulation only; no order or transfer endpoints are present.

### Critical gaps

1. `app/page.tsx` is a 2,100+ line client monolith containing navigation, financial calculations, fixtures, data loading, and most workspace views. This prevents reliable testing and strategy isolation.
2. Database changes are executed from one runtime statement array. There is no durable, ordered migration ledger or rollback/forward-only deployment process.
3. `transactions` models household cash flow, not an investment ledger. It cannot deterministically process BUY, SELL, DIVIDEND, DEPOSIT, WITHDRAWAL, INTEREST, FEE, TRANSFER, and SPLIT with tax lots and realized P&L.
4. Investment purpose is a free label with a short fixed list. There is no independent `InvestmentAccount` strategy, goal, benchmark, share mode, cash, target allocation, risk policy, thesis, or recommendation history.
5. Candidate routes use fixed ticker universes. Static prices, scores, fair values, and company catalogs remain in UI code. These must be fixtures only and never feed production recommendations.
6. Recommendation state, evidence completeness, triggers, cooldowns, expiration, invalidation, execution confirmation, and missed outcomes are not persisted.
7. Prediction inputs, versions, points, scenarios, confidence bands, and honest outcome evaluation are not persisted.
8. Current polling is not a one-second streaming market engine. WebSocket support is a generic refresh signal rather than a normalized quote stream.
9. Provider calls are embedded directly in routes; there are no explicit provider interfaces, freshness contracts, normalized errors, circuit breakers, or shared cache policy.
10. No automated unit, integration, component, API, security, migration, or end-to-end suite exists in `package.json`.
11. No application-level rate limiter is visible. Audit logging exists but does not cover every sensitive mutation/read boundary.
12. The current chart components do not meet the requested professional interaction, overlay, prediction-band, multi-pane, or mobile requirements.
13. The current UI can show partial evidence scores, but no single server-side readiness gate guarantees that missing evidence can never become actionable.

## Target domain boundaries

Use these server modules; UI components consume typed APIs and never calculate authoritative financial state independently.

```text
domains/
  accounts/        strategies, account settings, share mode, cash
  ledger/          investment transactions, lots, positions, P&L
  portfolio/       allocation, exposure, health, goals, projections
  market/          normalized quotes, candles, calendar, regime
  fundamentals/    statements, estimates, valuation, company quality
  predictions/     features, model adapter, scenarios, calibration
  recommendations/ policy, scoring, readiness, lifecycle, sizing
  alerts/          conditions, cooldown, delivery, acknowledgements
  discovery/       universe, factors, themes, backtests, evaluation
  household/       assets, liabilities, spending, capacity, Plaid
  audit/           immutable security and decision audit events
providers/
  market-data.ts
  fundamentals.ts
  news.ts
  macro.ts
  financial-aggregator.ts
  predictions.ts
  screening.ts
  revisions.ts
  themes.ts
  ownership.ts
workers/
  market-ingestion, candle-aggregation, fundamentals-refresh,
  news-processing, prediction-runner, recommendation-runner,
  alert-evaluator, discovery-scan, plaid-sync, portfolio-snapshot
```

Provider interfaces must return normalized timestamps, source, entitlement/feed, freshness, and typed unavailable/stale/error states. A time-sensitive Swing decision is disabled when required market evidence is stale.

## Deterministic investment ledger

Introduce versioned migrations for:

- `investment_accounts`: account goal/purpose, strategy policy, risk profile, whole/fractional share mode, benchmark, base currency, available cash, horizon, and status.
- `investment_transactions`: immutable BUY, SELL, DIVIDEND, DEPOSIT, WITHDRAWAL, INTEREST, FEE, TRANSFER, SPLIT events with trade/settlement timestamps, quantity, price, fees, currency, source, external id, and reversal link.
- `tax_lots` and `lot_disposals`: quantity remaining, unit basis, acquisition date, disposal allocation, and realized P&L.
- `position_snapshots` and `portfolio_snapshots`: reproducible daily/intraday values, cash, cost basis, realized/unrealized P&L, weights, and data freshness.
- `account_strategies`, `allocation_targets`, `goals`, and `goal_snapshots`.

Use integer minor currency units and fixed-precision decimal quantities in the database. Do not use JavaScript floating point for authoritative money, quantity, cost basis, or return calculations. Every transaction mutation must be idempotent and household/account ownership must be checked server-side.

## Recommendation contract

All strategy policies emit one schema-validated contract:

```ts
type RecommendationAction =
  | "STRONG_BUY" | "BUY" | "BUY_PARTIAL" | "ACCUMULATE"
  | "HOLD" | "WAIT" | "WATCH" | "TAKE_PARTIAL_PROFIT"
  | "REDUCE" | "SELL" | "EXIT" | "THESIS_REVIEW"
  | "THESIS_BROKEN" | "EVENT_RISK";

type Recommendation = {
  accountId: string;
  symbol: string;
  action: RecommendationAction;
  suggestedQuantity: string;
  shareMode: "WHOLE" | "FRACTIONAL";
  entryRange: { low: number; high: number } | null;
  idealPrice: number | null;
  invalidation: number | null;
  targets: number[];
  confidence: number;
  reason: string;
  requiredChecks: Record<string, "PASS" | "FAIL" | "MISSING" | "STALE">;
  actionable: boolean;
  evidenceAsOf: string;
  expiresAt: string;
};
```

`actionable` is computed server-side and is false whenever a required check is FAIL, MISSING, or STALE. The UI may say READY TO PREPARE, WAIT, MONITOR, or REJECT, but it must never reinterpret readiness. Recommendation creation never creates a transaction. A later explicit user confirmation may create a manual investment transaction.

## Strategy isolation

- `SwingStrategy`: intraday/multi-timeframe data, liquidity, spread, catalyst, risk/reward, risk-based sizing, and short expiration. Requires fresh entitled data.
- `LongTermGrowthStrategy`: 5–7 year business quality, acceleration, cash flow, moat, valuation, portfolio fit, staged entries, and thesis state.
- `RetirementStrategy`: long horizon, diversification, fees, tax/account constraints, contribution-first rebalancing, and no swing stops.
- `ChildGrowthStrategy`: goal date, contribution path, age-appropriate glide path, concentration limits.
- `IncomeStrategy`: dividend coverage, growth, durability, valuation, tax fit, and total return.
- `AggressiveGrowthStrategy`: tighter company/sector/theme caps, higher volatility allowance, explicit loss capacity.
- Custom strategies are configuration over validated policy primitives, not arbitrary AI prompts.

## Prediction architecture

Predictions are versioned probabilistic scenarios, not trade decisions. Store model version, feature snapshot ids, provider timestamps, horizon, Bull/Base/Bear probabilities, forecast points, expected range, confidence, material-change fingerprint, and evaluation status. The chart renders actual candles separately from a bold gray dashed `AI PREDICTION — BASE SCENARIO` line and gray range band.

Only regenerate a published prediction when the material-change fingerprint changes: regime, price/volume threshold, technical structure, fundamentals, guidance, material news, portfolio constraint, or elapsed horizon. Evaluate direction, range coverage, and target accuracy after the horizon; retain misses.

## Security and operational requirements

- Versioned forward-only migrations with a migration ledger and production backup gate.
- Server-side account/resource ownership checks on every request.
- Secure, HTTP-only session strategy or short-lived Cognito tokens; never store provider secrets client-side.
- AES-GCM token encryption retained, with key rotation/version support added.
- Per-user, per-household, per-IP rate limits for authentication, AI, providers, mutations, and exports.
- CSRF protection for cookie-authenticated mutations, strict origin checks, payload size limits, schema validation, and safe error envelopes.
- Immutable audit events for authentication, membership, provider connection, account changes, transactions, recommendation decisions, alerts, and exports.
- Freshness metadata and stale-data interlocks. Never label delayed IEX/indicative options data as real-time.
- Structured logs, request ids, worker/job ids, metrics, tracing, alerting, dead-letter queues, and provider health dashboards.

## Incremental delivery phases

### Phase 0 — foundation and safety

1. Add test runner, browser E2E runner, schema validation, decimal-money library, and migration tooling.
2. Move static production fixtures behind an explicit development-fixture flag.
3. Extract typed API errors, freshness types, provider interfaces, request ids, rate limiting, and audit helpers.
4. Add a server-side recommendation readiness gate and prove missing/stale evidence cannot pass.
5. Break `app/page.tsx` into route-level workspaces without changing current behavior.

Exit gate: existing production features pass smoke tests; no live decision uses fixture prices/scores; security regression tests pass.

### Phase 1 — accounts, strategies, holdings, and ledger

1. Add versioned migrations and new account/strategy/ledger/lot tables.
2. Build account CRUD for all required purposes and Whole/Fractional modes.
3. Implement all manual investment transaction types and deterministic lot accounting.
4. Import current manual/Plaid holdings without deleting existing accounts.
5. Add per-account cash, target, watchlist, thesis, prediction, alert, and history boundaries.

Exit gate: same symbol in two accounts remains independent; BUY/SELL/SPLIT/dividend math and realized/unrealized P&L are reproducible.

### Phase 2 — portfolio, household capacity, and goals

Implement exposure, target gaps, health scores, goal projections, household reserve/debt gates, share suggestions, and contribution-first rebalancing.

Exit gate: suggested quantity changes correctly with cash, share mode, existing position, concentration, emergency reserve, and high-interest debt.

### Phase 3 — market layer, calendar, and professional charts

Normalize providers, freshness, caching, streaming/fallback polling, exchange calendar, timezone conversion, responsive chart primitives, indicators, and overlays.

Exit gate: regular/premarket/after-hours, DST, Phoenix display, holidays, early closes, and stale data are tested.

### Phase 4 — predictions, strategies, and recommendations

Add feature snapshots, scenario predictions, calibration/evaluation, policy engines, staged entries, thesis lifecycle, recommendation history, and concise decision cards.

Exit gate: all outputs are schema validated, portfolio-aware, account-specific, versioned, explainable, and non-executing.

### Phase 5 — alerts and discovery

Add lifecycle/cooldown alerts, execution confirmation, broad survivorship-safe universe ingestion, configurable opportunity scoring, dynamic theme/supply-chain discovery, and historical evaluation.

Exit gate: alerts do not spam; discoveries include failures; high opportunity score means Research Candidate rather than BUY.

### Phase 6 — household intelligence and advisor UX

Complete manual/connected assets and liabilities, categorization corrections, recurring expenses, spending anomalies, financial capacity, home dashboard, question answering, and mobile layouts.

### Phase 7 — hardening and release

Load/performance/security tests, provider failure drills, migration rehearsal, accessibility, all required viewport tests, observability, backup/restore drill, and phased production rollout.

## Immediate implementation slice

The next code slice should be Phase 0, not prediction UI. It should add:

1. versioned migration runner and baseline migration ledger;
2. schema validation and typed recommendation/evidence contracts;
3. deterministic money/quantity primitives and tests;
4. recommendation readiness policy and tests;
5. a production-fixture interlock;
6. Vitest plus Playwright configuration and first security/domain tests;
7. extraction of account and recommendation code from `app/page.tsx`.

Do not deploy new tables or transform current holding data until the migration is rehearsed against a production-shaped backup and verified to preserve every manually entered account and holding.

## Mandatory Action Guidance Engine

Every account-facing analysis must resolve through one account-scoped Action Guidance Engine. Its concise output answers: WHAT, WHICH SECURITY, HOW MANY SHARES, AT WHAT PRICE, WHEN, WHY, and CAPITAL SOURCE. It combines strategy settings, goal/horizon, holdings, available cash, allocation drift, position limits, household reserve/debt gates, current market evidence, fundamentals, valuation, technical confirmation, predictions, events, and existing plans. Missing or stale required evidence produces WAIT/WATCH/DO NOTHING, never an invented actionable answer.

Planned Actions are persistent, non-executing objects with `PROPOSED`, `MONITORING`, `READY`, `TRIGGERED`, `INVALIDATED`, `EXPIRED`, `COMPLETED`, and `MISSED` states. READY only means the stored conditions still pass. A manual investment transaction may be created only after explicit user confirmation. Daily and monthly plans, cash deployment, contribution-first rebalancing, thesis failures, unusually strong multi-factor opportunities, and the cross-account priority queue all use these same objects and retain their full history.
