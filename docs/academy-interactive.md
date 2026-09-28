# Academy and flow release

- 90 original scenarios across 18 modules; Spanish instructions with English technical terms. Generated OHLC charts are explicitly synthetic.
- Server-stored questions and grading. Answers, solution levels, future candles and trade outcomes are omitted until submission. Attempts are idempotent and scoped to both learner and household.
- Concept mastery: last ten answers, at least five attempts, configurable 60–100% threshold (default 80%). Incorrect concepts become due after one day; correct concepts after 2–14 days. Modules remain open.
- Daily five-question practice, weekly ten-question review, a coherent ten-decision Options case, module practice, scanner historical exercises and private completed-trade exercises. Historical exercises require sufficient cached daily bars; missing entry dates/history produce an explicit unavailable state.
- Student roles can save educational activity but cannot inspect household trades. Read-only household members can save their own learning progress.
- Learn This Setup links on ranked stock and option cards; chart indicator practice; Post-Trade Review integration.
- Flow panel hides empty metrics when a verified provider is absent, avoids duplicated evidence, preserves available Quant Data evidence and guards against responses for a previously selected symbol.

Validation: `node scripts/academy-check.mjs` checks 270 generated variants, hidden solutions, historical cutoffs, private/idempotent persistence, mastery and cache-backed scenarios. Headless browser checks use real React components and production CSS at 390/768/1440px, exercise submission and outcome reveal. No user login is used.

Limits: the 90 exercises include chart-marking, numerical and decision tasks, not 90 entirely different technical patterns. Historical exercises depend on retained provider coverage. The guided full-market case currently covers one multi-day Options thesis; it is not a library of every market regime. Indicator and pattern Explain/Practice links cover 18 core concepts. A real flow feed still requires provider configuration; the UI cannot create missing institutional data. This release does not assert completion of all earlier always-on queue/lifecycle requirements.
