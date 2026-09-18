import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [workspace, connectionUi, styles, actionGuidance, marketCopilot, linkToken, attempt, sync, refresh, webhook] = await Promise.all([
  read("app/northstar-workspace.tsx"),
  read("app/investment-connection-flow.tsx"),
  read("app/globals.css"),
  read("app/action-guidance-panel.tsx"),
  read("app/automatic-market-copilot.tsx"),
  read("app/api/connections/plaid/link-token/route.ts"),
  read("app/api/connections/plaid/attempt/route.ts"),
  read("app/api/connections/plaid/sync/route.ts"),
  read("app/api/connections/plaid/investments-refresh/route.ts"),
  read("app/api/connections/plaid/webhook/route.ts"),
]);

for (const label of ["IMPORTANT NOW", "TODAY’S ACTIONS", "PORTFOLIO SUMMARY", "HOUSEHOLD FINANCIAL HEALTH", "IMPORTANT MARKET / NEWS", "MONITORING STATUS"])
  assert.match(workspace, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Home is missing ${label}`);
assert.match(workspace, /className="command-center home-command-center"/);
assert.match(styles, /\.page-dashboard\s+\.command-center\s*\{\s*display:\s*block\s*;?\s*\}/);
assert.match(styles, /@media\s*\(max-width:\s*600px\).*home-status-strip/s);
assert.match(workspace, /No critical events right now/);
assert.match(workspace, /Select one investment account above/);
for (const label of ["Checking cash", "Savings", "Credit-card balances", "Upcoming bills", "Monthly income", "Monthly spending", "Monthly cash flow", "Safe-to-spend", "Net worth", "Total debt"])
  assert.match(workspace, new RegExp(label), `Household Financial Health is missing ${label}`);
for (const tab of ["Dashboard", "Portfolio", "Daily Action Plan", "Growth Finder", "New Candidates", "Market Intel", "Professional Charts", "Prepare Trade"]) assert.match(workspace, new RegExp(`showInvestmentContext[\\s\\S]*["']${tab}["']`), `Investment context is missing ${tab}`);
assert.match(workspace, /localStorage\.setItem\("northstar-analysis-scope",\s*scope\)/);
assert.match(workspace, /AccountScopeDashboard/);

for (const label of ["Account:", "Entry / trigger", "Estimated proceeds", "Estimated cost", "Cash", "Stop / invalidation", "Targets", "Confidence", "Confirmation required:", "ticker\/sector concentration", "liquidity"])
  assert.match(actionGuidance, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Recommendation card is missing ${label}`);
assert.doesNotMatch(actionGuidance, /after confirmation/);
assert.match(styles, /recommendation-primary-facts/);
assert.match(styles, /@media\s*\(max-width:\s*380px\).*recommendation-primary-facts/s);

assert.match(marketCopilot, /NEXT MARKET OPEN · RANKED PREPARATION LIST/);
assert.match(marketCopilot, /\/api\/market\/candidates\?strategy=/);
assert.doesNotMatch(marketCopilot, /if \(marketPhase !== "open" && refresh === 0\)/, "Today must scan on initial load even when the market is closed");

assert.match(connectionUi, /\+ Bank, Card or Loan/);
assert.match(connectionUi, /\+ Investment Account/);
assert.match(connectionUi, /Add Investment Account Manually/);
assert.doesNotMatch(connectionUi, /Fidelity/i);
assert.match(connectionUi, /Retry \{institutionName\}/);
assert.match(connectionUi, /Add \{institutionName\} manually/);

assert.match(linkToken, /body\.includeInvestments\?\["investments"\]/);
assert.match(linkToken, /plaid_link_token_created/);
assert.match(linkToken, /Reference \$\{referenceId\}/);
assert.match(attempt, /institutionId/);
assert.match(attempt, /productsRequested:\["investments"\]/);
assert.match(sync, /\/investments\/holdings\/get/);
assert.match(sync, /\/investments\/transactions\/get/);
assert.match(sync, /ON CONFLICT\(account_id,source,external_id\) DO UPDATE/);
assert.match(refresh, /WAITING_PROVIDER/);
assert.doesNotMatch(refresh, /Sync successful/i);
assert.match(webhook, /PLAID_INVESTMENT_SYNC/);
assert.match(webhook, /ON CONFLICT\(idempotency_key\) DO NOTHING/);

console.log("Critical Home, generic account connection, Plaid diagnostics, investment reconciliation, refresh, and webhook regressions verified.");
