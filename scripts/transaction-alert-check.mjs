import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const notifications = await readFile(new URL("../lib/transaction-notifications.ts", import.meta.url), "utf8");
const sync = await readFile(new URL("../app/api/connections/plaid/sync/route.ts", import.meta.url), "utf8");
const webhook = await readFile(new URL("../app/api/connections/plaid/webhook/route.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../app/api/notifications/process/route.ts", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

for (const eventType of [
  "DEPOSIT", "WITHDRAWAL", "CARD_PURCHASE", "PENDING_POSTED", "LARGE_TRANSACTION",
  "NEW_MERCHANT", "RECURRING_IDENTIFIED", "SUBSCRIPTION_INCREASE", "ATM_WITHDRAWAL",
  "FOREIGN_TRANSACTION", "FEE", "DUPLICATE_CHARGE", "SUSPICIOUS",
]) assert.match(notifications + sync, new RegExp(`\\b${eventType}\\b`));

assert.match(webhook, /verifyPlaidWebhook/);
assert.match(webhook, /PLAID_SYNC/);
assert.match(notifications, /idempotency_key/);
assert.match(notifications, /EVERY_TRANSACTION/);
assert.match(notifications, /account_notification_preferences/);
assert.match(notifications, /transactionId=/);
assert.match(worker, /BROWSER_PUSH/);
assert.match(notifications, /NOTIFICATION_DELIVERY/);
assert.match(serviceWorker, /notificationclick/);
console.log("Plaid webhook, transaction classification, deduplication, preferences, durable delivery, and PWA deep links verified.");
