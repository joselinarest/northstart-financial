# Northstar master verification — in progress

Baseline deployed commit: 50ad490. This audit does not certify the full product. Existing source-only checks are distinguished from behavioral database/browser tests. Real trades are never executed.

## Repaired and tested during this pass

| FEATURE | STATUS | FILES CHANGED | DB MIGRATION | API/WORKER/PROVIDER | TEST EXECUTED | ACTUAL RESULT | REMAINING LIMITATION |
|---|---|---|---|---|---|---|---|
| Manual holding persistence | PARTIAL | lib/manual-holdings.ts; app/api/connections/plaid/route.ts; account profile; workspace | None | Authenticated manual holdings POST | manual-holdings-check.mjs | PASS: 3 holdings, duplicate rejection, weighted merge, edit/date, delete, totals, isolation, database reread | Actual account component passed database-backed fixture saves/reload at 360/390/430/768/1440px; production authentication and live quotes remain unverified |
| Exchange sessions | PARTIAL | lib/exchange-calendar.ts; market-session.ts; notification-worker.ts | None | Worker scheduling, market provider | exchange-calendar-check.mjs | PASS: published holidays, early closes, DST, expired calendar fail-closed | Live clock must handle exceptional closures; published calendar covers 2026–2028 |
| Quote price integrity | PARTIAL | lib/providers/alpaca-market-data.ts; market-data.ts | None | Shared provider | exchange-calendar-check.mjs | PASS: last close and matching price timestamp | All frontend labels and historical-close freshness still need verification |
| Central lifecycle | PARTIAL | integration test loader/assertions | None | PostgreSQL + injected providers | trade-lifecycle-integration-check.mjs | PASS: sale, rebuy, rotation, dedup, isolation, AI schema and outage handling | No live brokerage/push acceptance; strategy-position integration incomplete |
| Portfolio snapshots | PARTIAL | lib/continuous-intelligence-loop.ts | None | Account worker | Type check PASS; worker bundle PASS | Mark fetched quotes; preserve partial state for missing marks; manual accounts no longer require Plaid timestamp | Dedicated database behavior test pending |

## Complete requirement ledger

The entries below remain conservative until their entire acceptance path is verified.

| FEATURE | STATUS | FILES CHANGED | DB MIGRATION | API/WORKER/PROVIDER | TEST EXECUTED | ACTUAL RESULT | REMAINING LIMITATION |
|---|---|---|---|---|---|---|---|
| CORE ENGINE LOOP | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| MARKET-WIDE SCANNER | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| CENTRAL DATA + PROVIDERS | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| API REPAIR | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| MANUAL INVESTMENT ACCOUNTS | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| MARKET PRICES | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| PLAID CONNECTIONS | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| ACCOUNT SWITCHER | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| ACCOUNT TYPES + STRATEGIES | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| RISK DEFAULTS | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| SWING + DAY TRADING | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| ORDER LOGIC | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| PRECISE RECOMMENDATIONS | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| TRADE LIFECYCLE | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| TODAY + MARKET SESSION | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| MARKET ROUTINE | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| PATTERNS | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| VALIDATE THIS TRADE | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| QUANT DATA / MARKET STRUCTURE | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| OPTIONS ADVISOR | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| AI DECISION ENGINE | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| CHART + RESEARCH WORKSPACE | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| FULLSCREEN CHART | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| FORECAST LAYER | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| NEWS & EVENTS TAB | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| NEWS INTELLIGENCE | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| PUSH / NOTIFICATIONS | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| SETTINGS CENTER | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| TIMEZONE | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| UI RESTRUCTURE | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| HOME | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| HOUSEHOLD FINANCE | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| CREDIT + DEBT INTELLIGENCE | BLOCKED BY EXTERNAL PROVIDER | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Approved credit provider and hosted identity/consent contract required |
| SENSITIVE DATA SECURITY | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| POST-TRADE REVIEW | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| LEARNING MODE WITH REAL MONEY | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| SYSTEM HEALTH | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| MOBILE FIRST | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| REGRESSION RULE | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |
| ACCEPTANCE TESTS | PARTIAL | Pending full trace; see API inventory | Not determined | End-to-end trace pending | Not fully executed | No completion claim | Requirement is not accepted until runtime evidence is recorded |

## Evidence

- API/request/environment inventory: api-environment-inventory.json (static inventory only).
- Baseline test run: baseline-tests.json. PASS means the named test passed, not that the entire feature is complete.
- Exchange calendar source: https://www.nyse.com/markets/hours-calendars
- Quant Data production key was absent at the previous release verification; do not fabricate flow.
- Production authenticated full-route UI and push-device receipt tests are still pending.

## Additional verified repairs

| FEATURE | STATUS | FILES CHANGED | DB MIGRATION | API/WORKER/PROVIDER | TEST EXECUTED | ACTUAL RESULT | REMAINING LIMITATION |
|---|---|---|---|---|---|---|---|
| Account risk initialization and discovery queue | PARTIAL | account-risk-settings.ts; lifecycle-work-queue.ts; authoritative-recommendation.ts | None | Account worker; settings | account-monitoring-check.mjs | PASS: missing settings initialized, zero risk preserved, owned/watch/new candidates queued, household isolation and cooldown | Daily/weekly/combined risk enforcement and Day Trade position separation remain incomplete |
| Server configuration and API failures | PARTIAL | server-configuration.ts; db.ts; middleware.ts; api-client.ts; configuration route | None | API middleware and workspace client | server-configuration-check.mjs; api-policy-check.mjs | PASS: required configuration checks, optional isolation, secret-safe errors, reference IDs, invalid response handling | Not every client migrated; full production route verification pending |
| Mobile manual account controls | PARTIAL | investment-account-profile.tsx; northstar-workspace.tsx | None | Existing manual-holding service | manual-holdings-ui-check.mjs; mobile-ux-check.mjs | PASS: three holdings saved/reloaded, five viewport widths; native confirmation replaced; missing prices explicitly labeled | Popup keyboard interaction needs dedicated browser assertion; broader mobile routes pending |
| Consumer credit | BLOCKED BY EXTERNAL PROVIDER | provider-health.ts | None | No credit provider connected | Configuration inspection | User confirmed no provider selected. Report/score unavailable; no fabricated scores or SSN collection | Approved provider and hosted consent integration required |

These audit changes are local and have not been deployed. The previous baseline release remains live.
