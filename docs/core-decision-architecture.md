# Northstar decision authority

**Core Decision Engine = Brain. Chart/Market Analysis = Heart and visual evidence. AI = Second-pass analyst and explanation layer.**

`decideInvestment` calls `runCoreDecision`. The core never calls an AI provider or requires an approved AI model. Research, the scanner, account matching, position lifecycle, contract ranking, alerts and numerical post-trade review run independently.

The core validates evidence freshness, candidate arithmetic, strategy permissions, confirmed entry plans, reserves, cash, concentration, open risk, liquidity and reward/risk. It compares verified proposals with holding existing exposure/cash. It produces exact quantities, prices, invalidation, targets, payoff scenarios, reasons and a versioned audit before any optional review is queued. PREPARE is not order approval; execution still requires user confirmation. Cash restrictions are not relaxed to manufacture recommendations.

The immutable decision ledger retains its legacy `ai_decision_runs`/`ai_current_decisions` names for compatibility. Core rows explicitly use `provider=RULES`, `decisionSource=RULES`, `coreAudit` and `account-rules-1`. Recommendation JSON exposes `coreDecision`; `aiEvidence` remains a compatibility alias. The database requires a completed, current, account/ticker-scoped decision and passed core audit before marking a recommendation actionable.

Optional reviews are stored separately in `secondary_ai_reviews`, exposed as `aiReview`. They cannot update the core ledger, quantities, risk limits or current pointer. A validated CHALLENGE queues an idempotent core recheck; agreement adds supporting commentary, not a fabricated increase in trade success probability. Optional reviews only follow shortlisted actionable/preparation results, are deduplicated per account/symbol/strategy/30 minutes, and receive lower queue priority than core and finance work.

`AI_AVAILABLE`, `AI_RATE_LIMITED`, `AI_CREDITS_EXHAUSTED`, `AI_ERROR` describe the optional service. Failed/disabled/unconfigured review automatically uses `CORE_ONLY_MODE`. Rate limits and exhausted credits have distinct error codes and shared cooldowns. `AI_REVIEW_ENABLED=false` disables optional requests without affecting core decisions.

Scenario weights are explicit, bounded model assumptions with a recorded basis, not calibrated win probabilities. Planned stock loss can be exceeded by gaps. Paid option premium is tracked separately from underlying share value. Missing IV rank or optional flow/macro observations are not fabricated. The chart uses core levels and shows potential gain/loss, assumed Bull/Base/Bear weights, opposing evidence and optional review conflicts.

## Acceptance checks

- `node scripts/core-engine-acceptance.mjs`: AI key removed, provider throws if called; stock BUY/sizing/payoff, cash and stale-data rejection, SELL, CALL/PUT selection/rejection, real database authority, then AI challenge without changing core numbers.
- `node scripts/trade-lifecycle-check.mjs` and `node scripts/trade-lifecycle-integration-check.mjs`: HOLD/TRIM/SELL, confirmed reentry, readiness alert/deduplication, execution-confirmed REBUY/ROTATE/CLOSE and cash release with zero core AI calls.
- `node scripts/ai-service-outage-check.mjs`: exhausted quota versus rate limits, bounded cooldown and recovery.
- `node scripts/research-pipeline-check.mjs`, `node scripts/always-on-intelligence-check.mjs`, `node scripts/next-session-check.mjs`: broad rotation, account matching, strategy/cash constraints and next-session continuity.
- `node scripts/pattern-review-check.mjs`: deterministic post-trade attribution and numerical review without AI.

Production verification must inspect `provider=RULES` records while AI remains unavailable, job progress, deployment versions and actual selected-account blockers. Passing a fixture does not establish that a particular real account currently has an executable trade.
