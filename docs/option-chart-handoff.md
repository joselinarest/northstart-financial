# Option recommendation → chart handoff

Problem: Options cards linked only the underlying ticker. The chart could choose a different saved account, lose the contract identity and show general stock AI/flow status instead of the suggested CALL/PUT.

Behavior:
- Card links include the account, underlying and exact contract identifier, and use a daily underlying chart for multi-day research.
- The chart loads account-scoped saved option research through `/api/market/options/contract` and shows the selected contract above the chart: type, strike, expiration, DTE, premium, modeled sizing/risk, break-even, Greeks, trigger, invalidation, target, confirmation and exit conditions.
- Missing stock AI or optional flow does not hide saved option research. Flow is collapsed supporting evidence.
- A missing exact contract produces an explicit refresh message. It never silently substitutes a different CALL/PUT.
- Old quote evidence cannot receive execution approval. Refresh queues the selected account/ticker and retains saved details while polling.
- PUT links do not render bullish stock validation or manual share-buy price-plan warnings.
- Trading alternatives show company names from the existing universe/profile data. Readiness and research completion have distinct plain-language labels and visible rejection reasons.
- Version mismatch notice and a service-worker release update address old open pages.

Validation: `node scripts/option-chart-check.mjs` clicks the actual Options card and renders the actual chart component with controlled API fixtures, including stock-AI failure and unavailable flow. It checks exact contract/account, PUT levels, visible Greeks, queued refresh and responsive layouts. `node scripts/option-contract-api-check.mjs` checks auth, account scoping, stale evidence and no contract substitution. `node scripts/always-on-intelligence-check.mjs` includes saved-result company-name lookup and household isolation. `node scripts/chart-link-selection-check.mjs` preserves ordinary chart navigation behavior.

No schema migration or execution of a trade is part of this release. Production verification uses public build/assets and unauthenticated API protection, without the user's signed-in session.
