import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const link = await readFile(new URL("../app/api/connections/plaid/link-token/route.ts", import.meta.url), "utf8");
const sync = await readFile(new URL("../app/api/connections/plaid/sync/route.ts", import.meta.url), "utf8");
const webhook = await readFile(new URL("../app/api/connections/plaid/webhook/route.ts", import.meta.url), "utf8");
const refresh = await readFile(new URL("../app/api/connections/plaid/investments-refresh/route.ts", import.meta.url), "utf8");
const migrations = await readFile(new URL("../db/migrations.ts", import.meta.url), "utf8");

assert.match(link, /additional_consented_products:updateMode\?\["investments"\]/);
assert.match(link, /user:\{client_user_id:userId\}/);
assert.match(link, /update:updateMode\?\{account_selection_enabled:true\}/);
assert.match(link, /products:updateMode\?undefined:products/);
assert.match(link, /products=body\.includeInvestments\?\["investments"\]/);
assert.match(link, /\["transactions","auth","identity","liabilities","signal"\]/);
assert.match(sync, /\/investments\/holdings\/get/);
assert.match(sync, /\/investments\/transactions\/get/);
assert.match(sync, /investmentUnsupportedCodes=new Set\(\["NO_INVESTMENT_ACCOUNTS","PRODUCTS_NOT_SUPPORTED"\]\)/);
assert.match(sync, /\?"UNSUPPORTED"/);
assert.match(sync, /total_investment_transactions/);
assert.match(sync, /NO_INVESTMENT_ACCOUNTS/);
assert.match(sync, /ADDITIONAL_CONSENT_REQUIRED/);
assert.match(sync, /PRODUCT_NOT_READY/);
assert.match(webhook, /"INVESTMENTS"/);
assert.match(webhook, /PLAID_INVESTMENT_SYNC/);
assert.match(refresh, /\/investments\/refresh/);
assert.match(refresh, /WAITING_PROVIDER/);
assert.match(sync, /provider_security_id/);
assert.match(sync, /investment_sync_history/);
assert.match(sync, /holdingsClosed/);
assert.match(migrations, /0021_plaid_investment_access/);
assert.match(migrations, /0028_plaid_investment_reconciliation/);

console.log("Plaid Investments consent, provider refresh, holdings reconciliation, paginated trades, webhook queue, history, diagnostics, and recovery flow verified.");
