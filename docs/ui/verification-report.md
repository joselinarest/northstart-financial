# UI verification report — 2026-09-25

This is an in-progress refactor, not a claim that the entire redesign or authenticated production rollout is complete. The source inventory preceded removal of the duplicate chart markup. Browser fixtures use actual shared components with all production styles, not authenticated account data.

| PAGE | OLD DUPLICATION / PROBLEM | CHANGE MADE | TEST | PASS / FAIL | REMAINING ISSUE |
|---|---|---|---|---|---|
| Research / Security Detail / Charts | Competing inline and integrated charts, duplicate quote and research sections, uncalibrated ATR scenario probabilities | One ChartEngine and tabbed SecurityHeader, Analysis, News, Fundamentals, Options/Flow and TradePlan; duplicate chart JSX removed | Actual component with production CSS, all tabs at 360/390/430/768/1440, one canvas, fullscreen, request dedup | PASS fixture | Authenticated account switching and complete indicator coverage need live route verification; forecast deliberately unavailable without calibration |
| Chart links | Saved ticker/timeframe could override linked setup | Existing link handling retained | chart-link-selection-check | PASS | Live account route not authenticated |
| Portfolio / Watchlist | Compressed headers and overflowing badges | Existing corrected cards preserved | watchlist-layout-check, 360–1920 | PASS fixture | Full portfolio route and growth attribution require authenticated validation |
| New Candidates | No separate Quant Data evidence | Collapsed, lazy market-structure panel per candidate | TypeScript / shared flow panel fixture | PASS component | Full discovery route not verified |
| Options | Missing dedicated provider context | Quant Data panel plus central decision explanation and account-preserving option link | Shared Options/Flow tab fixture | PASS component | Contract suitability is still governed by existing underlying/Greek/liquidity gates; live provider entitlements not tested |
| Today / Important Now | New institutional evidence absent | Durable flow alerts feed existing notification index and re-analysis | Worker bundle / adapter tests | PASS build | Live scheduler and push delivery not verified; full Today deduplication still pending |
| Settings / System Health | No Quant Data health | Configuration, success, latency, quota and errors | TypeScript / adapter mocks | PASS build | Live credential verification pending |
| Trading / Finance / Alerts / Account pages | Crowded navigation and repeated content | Seven primary navigation groups, secondary tools retained | TypeScript | NOT FULLY TESTED | Authenticated all-route visual sweep and remaining content ownership refactor pending |

Older `ai-decision-engine-check.mjs` fails a source-text assertion expecting “Investment account not found” in the route; account checking has moved into the delegated service. That script's full pass is not claimed. The provider-specific behavioral tests pass. No production UI verification is claimed from the Google sign-in chooser.
