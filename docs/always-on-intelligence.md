# Always-on intelligence: implementation and acceptance

## Server ownership

- `aws-scanner-worker`: EventBridge every five minutes, one concurrent invocation,
  up to four minutes of bounded work. Consumes durable MARKET_DISCOVERY and
  OPTIONS_DISCOVERY jobs, alternates lanes, retries with exponential backoff.
- `aws-research-worker`: independent account and Options deep-research consumer.
- `aws-market-worker`: finance ingestion, notifications, account scheduling and
  lifecycle monitoring. Discovery cannot occupy this worker after this release.
- Database leases recover interrupted jobs. Saved research remains visible while
  new jobs run. No browser session is required by any worker.

Each rotation snapshots the supported active universe. Completion means every
member was attempted or retired from the provider directory. Successful screens,
missing history and failed attempts remain distinct. Rotation completion is never
represented as proof that every security passed deep research or account risk.
Half each discovery batch is reserved for oldest due work; the other half gives
priority to holdings, active recommendations, manual requests and measured anomalies.

## Account and Options matching

Account jobs do not overlap merely because two hours elapsed or a close cycle
changed. Older queued account runs are superseded, with their research retained.
Options background queues retain a bounded working set; manual requests can be
prioritized, and deferred discovery is revisited. The migration keeps the strongest
25 and oldest 15 background Options jobs per account, plus manual/running jobs.

Long-term contribution quantities use target-category drift, existing holdings,
cash and position capacity. Swing quantities continue to use stop-distance risk.
Options shortlist scores include unusual movement and relative volume, independently
of long-term quality/valuation scores. ETF-only selection remains enforced.
Allocation capacity alone does not authorize a purchase: evidence, valuation,
confirmation and central risk controls still apply.

Options research cannot qualify with missing underlying stages, conflicting
market/sector direction or confidence below the account threshold. Contract cards
include the maximum entry premium, exit conditions, unresolved readiness checks and
comparison with a cheaper researched contract when available. Saved qualified
contract history is deduplicated and bounded.

## User interface

The account decision and ranked suggestions precede scanner diagnostics. Suggestions
and coverage are expanded by default. Trading and Options expose the current
rotation, worker heartbeats, stored coverage and last completed rotation. Refresh
and Retry continue to enqueue backend work. Failed diagnostics do not remove saved
account or Options results.

## Verification boundary

Automated PostgreSQL-compatible integration tests cover rotation membership,
retired/failed symbols, fair scheduling, queue deduplication, account overlap,
Options backpressure, strategy scoring, fractional sizing and default-open UI.
Separate existing tests cover cash constraints, research response bounds and the
trade lifecycle, including execution confirmation and reentry.

These tests are not a claim that the full requested production workflow is complete.
Production acceptance still requires observing completed continuous rotations,
independent account outcomes, closed-session plans, CALL/PUT research refreshes,
and real user-confirmed execution through monitoring and post-trade review.

Remaining product gaps include a fully integrated Options READY transition with
live aggregate account risk and intraday confirmation; calibrated or explicitly
validated scenario models; complete futures/IV-history/flow coverage; and the
entire strategy-specific chart and monitored recommendation experience. Contracts
remain conditional research until the missing execution gates are implemented and
verified. No broker execution is fabricated to satisfy acceptance.
