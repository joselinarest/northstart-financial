# Quant Data evidence integration

Quant Data is optional. Configure `QUANT_DATA_API_KEY` in the server environment or the JSON secret referenced by `NORTHSTAR_SECRET_ID`. Use the same secret for the Next.js runtime and scheduled market worker. Never use a `NEXT_PUBLIC_` variable or paste the key into a browser setting.

## Data path

`QuantDataProvider` → shared PostgreSQL cache/leases/quota → Research Engine and central AI evidence snapshot → existing deterministic candidate and account-risk gates → persisted recommendation. Flow alone cannot authorize execution. AI responses citing only flow are rejected. CALL/PUT direction requires execution-side evidence and remains provisional because hedges and opening/closing intent can be unknown.

The adapter uses the documented REST endpoints at https://quantdata.us/api/docs/endpoints . It requests consolidated flow, Net Flow, Net Drift, gamma/delta/vanna/charm exposure, IV rank inputs, skew, term structure, OI by strike, dark flow, dark-pool levels, gainers/losers and ticker news. Max pain uses a verified expiration from the returned sample. Empty or failed endpoints stay unavailable; failures do not create substitute values.

Cache TTL is five minutes for flow/exposure and fifteen minutes for slower datasets. Database leases coalesce requests across app instances. Shared per-second/per-minute reservations and provider Retry-After headers constrain requests. Slow endpoints can defer later datasets until another refresh. All consumers share this cache.

## Interpretation and displays

- Flow Conviction is an explainable **data-strength heuristic**, not a calibrated probability of profit. Execution, premium, volume/OI, repetition, DTE, IV and moneyness contribute explicitly.
- Intraday scoring uses a 15-minute window; central swing scoring can use seven-day observations from the returned sample. The provider supplies a latest-100-print sample. Observed prints are persisted and deduplicated for a seven-day, up-to-500-print swing context; this is not a guaranteed exhaustive multi-day tape.
- Chart events use supplied underlying prices and event timestamps. Aggregate dark-pool/OI/gamma levels have no invented event timestamp. Call/put walls mean peak observed OI concentration, not proven support/resistance; gamma concentration does not establish dealer position sign.
- Security research, Options, candidate details and trade-plan validation expose flow. The flow check compares against an explicitly chosen underlying thesis; it is independent of final order readiness.
- Settings/System Health shows configuration, last success, latency, quota and error state.

## Background monitoring and audit

The existing scheduled market worker queues ticker-level `QUANT_FLOW` jobs for visible accounts' holdings during open/extended sessions. Material new prints create deduplicated account alerts and queue `AI_EVENT_REVIEW`. The existing notification indexer and browser-push preferences deliver alerts while the app is closed. This requires the worker deployment, scheduler, push subscription and user channel preferences to be active; browser rendering alone does not monitor trades.

Central `ai_decision_runs` retains the flow evidence with ticker/account/strategy/time. Published recommendation `checks_json.aiEvidence.evidenceSources` retains the same snapshot under the recommendation ID. Closed-trade review reads that recorded snapshot, never a later replacement. Directional post-exit association may be useful/misleading/neutral; GEX/dark-pool attribution stays neutral without a preregistered hypothesis. No rule changes or retraining are performed.

## Verification and limits

Run `node scripts/quant-data-check.mjs`, `node scripts/security-workspace-check.mjs`, `node scripts/chart-axis-check.mjs`, `node scripts/pattern-review-check.mjs` and TypeScript. Fixtures exercise missing credentials, key non-disclosure, cache deduplication, rate-limit behavior, stale timestamps, strategy windows, validation alignment and chart coordinate transforms. Production build, standalone TypeScript, worker bundle and responsive shared-workspace tests passed. No live Quant Data credential or live push delivery was verified in this change. Local key presence checks found none; AWS secret configuration remains unverified because local AWS credentials were unavailable. Compatible providers can implement the two provider-neutral interfaces; only Quant Data is implemented here.
