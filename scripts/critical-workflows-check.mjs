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
const swingPageList = workspace.match(/const swingDecisionTabs = \[([^\]]+)\]/)?.[1] || "";
assert.doesNotMatch(swingPageList, /Daily Action Plan/, "Daily Action Plan must preserve the selected investment account instead of forcing the first Swing account");
assert.doesNotMatch(swingPageList, /Options Advisor/, "Options must preserve the selected investment account instead of forcing the first Swing account");
assert.match(workspace, /key=\{`today-guidance:\$\{advisorAccountId\}`\}/, "Daily guidance must remount for the selected investment account");
assert.match(workspace, /initialStrategy=\{advisorStrategy\}/, "Daily recommendations must use the selected account strategy");
const todayRender = workspace.slice(workspace.indexOf('className="daily-plan-intro card"'), workspace.indexOf('{tab === "Prepare Trade"', workspace.indexOf('className="daily-plan-intro card"')));
assert.doesNotMatch(todayRender, /swingAdvisor(Account|Holdings|Name)/, "Today must never substitute a hard-coded Swing account");
assert.match(todayRender, /key=\{`today-copilot:\$\{advisorAccountId\}:\$\{advisorStrategy\}`\}/, "Today candidate analysis must reset when the selected account changes");
assert.match(todayRender, /key=\{`today-holdings:\$\{advisorAccountId\}:\$\{advisorStrategy\}`\}/, "Today holdings analysis must reset when the selected account changes");
assert.match(workspace, /tab === "Options Advisor"[\s\S]*accountId=\{advisorAccountId\}/, "Options must analyze the globally selected investment account");
assert.match(workspace, /analysisScope === ALL_ACCOUNTS_SCOPE[\s\S]*setAdvisorAccountId\(analysisScope\)/, "The visible account selector must drive the analysis account after reload");
const portfolioStart = workspace.indexOf("<PortfolioBuilderWizard");
const portfolioRender = workspace.slice(portfolioStart, workspace.indexOf('{tab === "Growth Finder"', portfolioStart));
assert.match(portfolioRender, /key=\{`portfolio-plan:\$\{advisorAccountId\}:\$\{advisorStrategy\}`\}/, "Portfolio plan must reset when the selected account changes");
assert.match(portfolioRender, /key=\{`portfolio-guidance:\$\{advisorAccountId\}:\$\{advisorStrategy\}`\}/, "Portfolio guidance must reset when the selected account changes");
assert.match(portfolioRender, /key=\{`portfolio-holdings:\$\{advisorAccountId\}:\$\{advisorStrategy\}`\}/, "Portfolio holdings must reset when the selected account changes");
assert.match(portfolioRender, /key=\{`portfolio-copilot:\$\{advisorAccountId\}:\$\{advisorStrategy\}`\}/, "Portfolio recommendations must reset when the selected account changes");
assert.doesNotMatch(portfolioRender, /swingAdvisor(Account|Holdings|Name)/, "Portfolio must never substitute a hard-coded Swing account");

for (const label of ["Account:", "Entry / trigger", "Estimated proceeds", "Estimated cost", "Cash", "Stop / invalidation", "Targets", "Confidence", "Confirmation required:", "ticker\/sector concentration", "liquidity"])
  assert.match(actionGuidance, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Recommendation card is missing ${label}`);
assert.doesNotMatch(actionGuidance, /after confirmation/);
assert.match(styles, /recommendation-primary-facts/);
assert.match(styles, /@media\s*\(max-width:\s*380px\).*recommendation-primary-facts/s);

assert.match(marketCopilot, /NEXT MARKET OPEN · RANKED PREPARATION LIST/);
assert.match(marketCopilot, /\/api\/market\/candidates\?strategy=/);
assert.doesNotMatch(marketCopilot, /if \(marketPhase !== "open" && refresh === 0\)/, "Today must scan on initial load even when the market is closed");
assert.match(marketCopilot, /triggerPrice - item\.invalidation/, "Swing sizing must use the actual breakout entry rather than the cheaper current quote");
assert.match(marketCopilot, /target1 = triggerPrice \+ riskPerShare \* 2/, "Swing targets must be measured from the displayed entry trigger");
for (const label of ["Current price", "Confirmed breakout entry", "Cheaper alternative", "Why wait:", "Never chase above the displayed entry range"])
  assert.match(marketCopilot, new RegExp(label), `Swing recommendation is missing ${label}`);

assert.match(connectionUi, /\+ Bank, Card or Loan/);
assert.match(connectionUi, /\+ Investment Account/);
assert.match(connectionUi, /Add Investment Account Manually/);
assert.doesNotMatch(connectionUi, /Fidelity/i);
assert.match(connectionUi, /Retry \$\{institutionName\}/);
assert.match(connectionUi, /Add \{institutionName\} manually/);

assert.match(linkToken, /body\.includeInvestments\?\["investments"\]/);
assert.match(linkToken, /plaid_link_token_created/);
assert.match(linkToken, /Reference \$\{referenceId\}/);
assert.match(attempt, /institutionId/);
assert.match(attempt, /productsRequested:\["investments"\]/);
assert.match(attempt, /INSTITUTION_REGISTRATION_REQUIRED/);
assert.match(attempt, /Plaid Dashboard/);
assert.match(attempt, /requiresProviderRegistration/);
assert.match(connectionUi, /connection unavailable/);
assert.match(connectionUi, /retryable/);
assert.match(sync, /\/investments\/holdings\/get/);
assert.match(sync, /\/investments\/transactions\/get/);
assert.match(sync, /ON CONFLICT\(account_id,source,external_id\) DO UPDATE/);
assert.match(refresh, /WAITING_PROVIDER/);
assert.doesNotMatch(refresh, /Sync successful/i);
assert.match(webhook, /PLAID_INVESTMENT_SYNC/);
assert.match(webhook, /ON CONFLICT\(idempotency_key\) DO NOTHING/);

console.log("Critical Home, generic account connection, Plaid diagnostics, investment reconciliation, refresh, and webhook regressions verified.");
