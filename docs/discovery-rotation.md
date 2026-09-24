# Discovery and capital rotation

## Coverage and scheduling

The provider's active eligible U.S. stock directory is persisted in `discovery_queue`.
Eligibility currently excludes ETFs/ETNs, warrants, rights, units and explicitly named leveraged products. This is not a claim to cover every asset or exchange.

Each bounded batch screens up to 120 symbols and deeply researches up to two. Priority work includes owned and watched symbols, explicitly requested tickers and stronger technical seeds. Half of each claim is reserved for oldest work. Leases recover interrupted batches. Completed screening survives a later provider error. Unscanned, pending, incomplete and researched counts are distinct.

Alpaca candle pages are followed until complete. Finnhub profile/metric/news responses are cached with their original retrieval timestamps; 429 responses pause discovery's Finnhub requests for two minutes. This is a discovery budget, not an account-wide Finnhub rate limiter for every Northstar service. Price screening is not AI trade authorization. Account-specific shortlisted research is queued through the existing central engine.

The dedicated Lambda uses `infra/dedicated-market-worker.yml`; rebuild with `node scripts/build-market-worker.mjs`. Deploy its bundle separately from Amplify. Its schedule runs each minute. Discovery is eligible each minute during the regular session and every 15 minutes otherwise, subject to queue workload. Actual coverage speed depends on API access, quotas and worker capacity; a registered universe is not a completed scan. Disable the former HTTP scheduler after validating the dedicated worker to avoid duplicate polling.

## Rotation safety

Today displays persisted account reviews. Existing exposure is compared against up to three account-ranked alternatives. Insufficient data, stale evidence, mismatched horizons/models, insufficient advantage, missing confirmation or zero risk capacity produces HOLD/monitoring, not an order.

The central model receives explicit bull/base/bear price scenarios (verified target, current-price base, verified stop), with a 14-day default swing horizon (overridden by `tradingPolicy.maxSwingDays`) or a 365-day long-term comparison horizon. Its scenario probabilities are used to calculate an estimated return. Confidence is not used as the probability of making money. Estimates remain uncertain and are not a demonstrated forecast accuracy claim.

Comparisons require explicit policy `taxRatePct`, `slippageBps`, and `commissionCents`. Missing values are not assumed to be zero. Reviewed trading policy, known open-position risk and sector capacity are also required. Never fill a taxable account's tax estimate with zero simply to remove a warning.

A ready review requires an independently confirmed sale and replacement entry, separate order limit, stop, targets, position capacity, cash reserve and risk budget. It does not authorize trading. Whole-share sizing is capped by the central entry's approved shares. Hypothetical outcomes are labeled as paper comparisons; actual execution-attributed reentry/rotation outcomes remain in the Trade Lifecycle Engine. No automatic model retraining or rule changes occur.

## Verification

- `node scripts/discovery-queue-check.mjs`
- `node scripts/discovery-pagination-check.mjs`
- `node scripts/capital-rotation-check.mjs`
- `node scripts/rotation-service-check.mjs`
- `node scripts/trade-lifecycle-check.mjs`
- `node scripts/trade-lifecycle-integration-check.mjs`

Production migrations 0045–0047 add the queue/review records, allow `AI_EVENT_REVIEW` jobs (previously rejected by the database constraint), and index active queue lookups. They preserve existing holdings and trade history.
