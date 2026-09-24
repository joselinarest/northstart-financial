# Portfolio cash allocation

Portfolio's account-specific advice now includes a server-calculated cash plan.
The account value includes holdings and brokerage cash. Category percentages use
saved allocation targets or the existing account-strategy defaults. Within each
category, existing securities receive equal planning weights, capped by the
account maximum position percentage. This is an explicit allocation convention,
not an expected-return forecast.

The engine subtracts the greater of the target cash percentage and policy cash
reserve percentage, plus active reentry/rotation reservations. Household safety
capacity also caps spending. Positive security gaps are capped by category gaps,
then share a single budget proportionally. Whole/fractional rounding cannot
overspend that budget. Duplicate lots share one security limit. Missing prices,
unrepresented categories and rounding leave cash unallocated with an explanation.

The UI shows before/target/after percentages, dollar gaps, estimated quantities,
remaining gaps, and cash before/after. Prices are explicitly saved valuations,
not fresh order limits. All purchases remain entry-review estimates: current
quotes, central confirmation, costs and trade-risk approval are required. No
trade is executed, no account cash is modified, and faster returns are not promised.

Checks: `node scripts/cash-allocation-check.mjs` (including 200 budget scenarios)
and `node scripts/portfolio-cash-api-check.mjs` (PostgreSQL-compatible endpoint
queries, cash/reservations, saved targets and household isolation). A local
headless-browser component check verified display, expandable methodology and
no horizontal overflow at 360/390/430/768/1440px; it used synthetic data and is
not authenticated production UI verification.
