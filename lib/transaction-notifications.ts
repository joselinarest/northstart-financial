import { createHash } from "node:crypto";
import { id, type PostgresDatabase } from "@/lib/db";
export type TransactionEventType =
  | "IMPORTED"
  | "UPDATED"
  | "PENDING_POSTED"
  | "RECURRING_IDENTIFIED"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "CARD_PURCHASE"
  | "LARGE_TRANSACTION"
  | "NEW_MERCHANT"
  | "SUBSCRIPTION_INCREASE"
  | "ATM_WITHDRAWAL"
  | "FOREIGN_TRANSACTION"
  | "FEE"
  | "DUPLICATE_CHARGE"
  | "SUSPICIOUS"
  | "REMOVED";
export type TransactionNotificationInput = {
  householdId: string;
  accountId: string;
  transactionId: string;
  providerTransactionId?: string | null;
  eventType: TransactionEventType;
  institution?: string | null;
  accountName: string;
  mask?: string | null;
  merchant?: string | null;
  description: string;
  amountCents: number;
  currency?: string;
  postedAt: string;
  category?: string | null;
  direction: "inflow" | "outflow";
  pending: boolean;
  previousPending?: boolean | null;
  recurring?: boolean;
  riskScore?: number;
  riskReasons?: string[];
  foreign?: boolean;
  newMerchant?: boolean;
};
const parse = (value: unknown) => {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, any>;
  try {
    return JSON.parse(String(value)) as Record<string, any>;
  } catch {
    return {};
  }
};
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Math.abs(cents) / 100,
  );
const quietDelay = (quiet: Record<string, any>, timezone: string) => {
  if (!quiet.enabled || !quiet.start || !quiet.end) return new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date()),
    now =
      Number(parts.find((x) => x.type === "hour")?.value || 0) * 60 +
      Number(parts.find((x) => x.type === "minute")?.value || 0),
    toMinutes = (v: string) => {
      const [h, m] = v.split(":").map(Number);
      return h * 60 + m;
    },
    start = toMinutes(quiet.start),
    end = toMinutes(quiet.end),
    inside =
      start < end ? now >= start && now < end : now >= start || now < end;
  if (!inside) return new Date();
  const wait = (end - now + 1440) % 1440 || 1440;
  return new Date(Date.now() + wait * 60000);
};

async function enqueueTransactionNotificationAtomic(
  db: PostgresDatabase,
  input: TransactionNotificationInput,
) {
  const stable = JSON.stringify([
      input.householdId,input.accountId,input.providerTransactionId || input.transactionId,
      input.eventType,
      input.amountCents,
      input.pending,
      input.category || "",
      input.postedAt,
    ]),
    fingerprint = createHash("sha256").update(stable).digest("hex"),
    eventId = id("txn_notice"),
    severity =
      input.eventType === "SUSPICIOUS"
        ? Number(input.riskScore || 0) >= 70
          ? "CRITICAL"
          : "WARNING"
        : ["DUPLICATE_CHARGE", "SUBSCRIPTION_INCREASE", "LARGE_TRANSACTION", "FOREIGN_TRANSACTION"].includes(input.eventType)
          ? "WARNING"
        : input.eventType === "PENDING_POSTED"
          ? "WATCH"
          : "INFO";
  const snapshot = {
    accountId:input.accountId,transactionId:input.transactionId,
    institution: input.institution || "Financial institution",
    accountName: input.accountName,
    mask: input.mask || null,
    merchant: input.merchant || input.description,
    amountCents: input.amountCents,
    currency: input.currency || "USD",
    postedAt: input.postedAt,
    category: input.category || "Uncategorized",
    direction: input.direction,
    pending: input.pending,
    recurring: Boolean(input.recurring),
    riskScore: input.riskScore || 0,
    riskReasons: input.riskReasons || [],
    foreign: Boolean(input.foreign),
    newMerchant: Boolean(input.newMerchant),
    deepLink: `/workspace/accounts/${encodeURIComponent(input.accountId)}/transactions?transactionId=${encodeURIComponent(input.transactionId)}`,
  };
  const inserted = await db
    .prepare(
      "INSERT INTO transaction_notification_events(id,household_id,account_id,transaction_id,event_type,idempotency_key,severity,snapshot_json) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id",
    )
    .bind(
      eventId,
      input.householdId,
      input.accountId,
      input.eventType === "REMOVED" ? null : input.transactionId,
      input.eventType,
      fingerprint,
      severity,
      JSON.stringify(snapshot),
    )
    .first<{ id: string }>();
  if (!inserted) return { queued: 0, duplicate: true };
  const account = `${input.institution || "Account"} · ${input.accountName}${input.mask ? ` •••• ${input.mask}` : ""}`,
    amount = money(input.amountCents, input.currency || "USD"),
    eventLabel: Partial<Record<TransactionEventType, string>> = {
      DEPOSIT: "Deposit received",
      WITHDRAWAL: "Withdrawal posted",
      CARD_PURCHASE: "Card purchase",
      LARGE_TRANSACTION: "Large transaction",
      NEW_MERCHANT: "Purchase at a new merchant",
      SUBSCRIPTION_INCREASE: "Recurring charge increased",
      ATM_WITHDRAWAL: "ATM withdrawal",
      FOREIGN_TRANSACTION: "Foreign transaction",
      FEE: "Fee charged",
      DUPLICATE_CHARGE: "Possible duplicate charge",
      PENDING_POSTED: "Pending transaction posted",
      RECURRING_IDENTIFIED: "Recurring charge identified",
    },
    title =
      input.eventType === "SUSPICIOUS"
        ? "Possible suspicious transaction detected"
        : `${eventLabel[input.eventType] || "Transaction update"} · ${account} — ${amount} at ${snapshot.merchant}`,
    eventTime = new Date(input.postedAt).toLocaleString("en-US", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }),
    explanation =
      input.eventType === "SUSPICIOUS"
        ? `${account} · ${amount} ${snapshot.currency} · ${snapshot.category} · ${eventTime} UTC · ${input.pending ? "Pending" : "Posted"}. Risk ${snapshot.riskScore}/100. ${input.riskReasons?.join("; ") || "Activity differs from expected behavior."}`
        : `${account} · ${snapshot.merchant} · ${amount} ${snapshot.currency} · ${snapshot.category} · ${eventTime} UTC · ${input.pending ? "Pending" : "Posted"}${input.eventType === "PENDING_POSTED" ? " · previously pending" : ""}${input.eventType === "RECURRING_IDENTIFIED" ? " · recurring pattern identified" : ""}`;
  const alertId = `alert_${eventId}`;
  await db
    .prepare(
      "INSERT INTO alerts(id,household_id,severity,type,title,explanation,evidence_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
    )
    .bind(
      alertId,
      input.householdId,
      severity.toLowerCase(),
      "transaction",
      title,
      explanation,
      JSON.stringify({ ...snapshot, eventId, eventType: input.eventType, sourceJob: "PLAID_TRANSACTION_SYNC" }),
    )
    .run();
  const recipients = await db
    .prepare(
      `SELECT hm.user_id,np.in_app_enabled,np.browser_push_enabled,np.email_enabled,np.quiet_hours_json,np.timezone,np.transaction_mode,np.minimum_amount_cents,np.transaction_filters_json,np.suspicious_override,np.fallback_json,ap.enabled account_enabled,ap.transaction_mode account_mode,ap.channels_json,ap.minimum_amount_cents account_minimum,ap.filters_json account_filters FROM household_members hm LEFT JOIN notification_preferences np ON np.household_id=hm.household_id AND np.user_id=hm.user_id LEFT JOIN account_notification_preferences ap ON ap.household_id=hm.household_id AND ap.user_id=hm.user_id AND ap.account_id=? WHERE hm.household_id=? AND hm.status='active'`,
    )
    .bind(input.accountId, input.householdId)
    .all<Record<string, any>>();
  let queued = 0;
  for (const recipient of recipients.results) {
    const suspicious = input.eventType === "SUSPICIOUS",
      override = suspicious && recipient.suspicious_override !== false;
    const suppress=async(reason:string)=>db.prepare("INSERT INTO transaction_notification_audit(event_id,user_id,household_id,reason) VALUES(?,?,?,?) ON CONFLICT DO NOTHING").bind(eventId,recipient.user_id,input.householdId,reason).run();
    if (recipient.account_enabled === false && !override) {await suppress('Account notifications disabled');continue;}
    const mode =
        recipient.account_mode && recipient.account_mode !== "INHERIT"
          ? recipient.account_mode
          : recipient.transaction_mode || "MATERIAL",
      every = mode === "EVERY_TRANSACTION";
    if (mode === "OFF" && !override) {await suppress("Transaction notifications switched off");continue;}
    const filters = {
        ...parse(recipient.transaction_filters_json),
        ...parse(recipient.account_filters),
      },
      minimum = Number(
        recipient.account_minimum ?? recipient.minimum_amount_cents ?? 0,
      );
    if (!every && !override && ["IMPORTED", "UPDATED", "REMOVED"].includes(input.eventType)) {await suppress("Routine update excluded by material-events mode");continue;}
    if (!every && !override && Math.abs(input.amountCents) < minimum) {await suppress("Below configured minimum amount");continue;}
    if (
      !every &&
      !override &&
      filters.expensesOnly &&
      input.direction !== "outflow"
    )
      {await suppress("Transaction excluded by configured filters");continue;}
    if (
      !every &&
      !override &&
      filters.depositsOnly &&
      input.direction !== "inflow"
    )
      {await suppress("Transaction excluded by configured filters");continue;}
    if (!every && !override && filters.foreignOnly && !input.foreign) {await suppress("Transaction excluded by configured filters");continue;}
    if (!every && !override && filters.newMerchantsOnly && !input.newMerchant)
      {await suppress("Transaction excluded by configured filters");continue;}
    if (!every && !override && filters.suspiciousOnly && !suspicious) {await suppress("Transaction excluded by configured filters");continue;}
    if (!every && !override && filters.largeOnly && input.eventType !== "LARGE_TRANSACTION") {await suppress("Transaction excluded by configured filters");continue;}
    if (!every && !override && filters.recurringOnly && !["RECURRING_IDENTIFIED", "SUBSCRIPTION_INCREASE"].includes(input.eventType)) {await suppress("Transaction excluded by configured filters");continue;}
    if (!every && !override && filters.atmOnly && input.eventType !== "ATM_WITHDRAWAL") {await suppress("Transaction excluded by configured filters");continue;}
    if (!every && !override && filters.feesOnly && input.eventType !== "FEE") {await suppress("Transaction excluded by configured filters");continue;}
    if (!every && !override && filters.duplicatesOnly && input.eventType !== "DUPLICATE_CHARGE") {await suppress("Transaction excluded by configured filters");continue;}
    const overrides = parse(recipient.channels_json),
      channels = [
        recipient.in_app_enabled !== false && overrides.inApp !== false
          ? "IN_APP"
          : null,
        (overrides.push ?? recipient.browser_push_enabled)
          ? "BROWSER_PUSH"
          : null,
        (overrides.email ?? recipient.email_enabled) ? "EMAIL" : null,
      ].filter(Boolean) as string[];
    if (override && !channels.length) channels.push("IN_APP");
    const availableAt =
      every || override
        ? new Date()
        : quietDelay(
            parse(recipient.quiet_hours_json),
            recipient.timezone || "America/Phoenix",
          );
    await db.prepare("INSERT INTO transaction_notification_audit(event_id,user_id,household_id,reason,channels_json,available_at) VALUES(?,?,?,?,?::jsonb,?) ON CONFLICT DO NOTHING").bind(eventId,recipient.user_id,input.householdId,channels.length?(availableAt.getTime()>Date.now()+1000?'Queued after quiet hours':'Rules matched; delivery queued'):'All delivery channels disabled',JSON.stringify(channels),availableAt.toISOString()).run();
    for (const channel of channels) {
      await db
        .prepare(
          "INSERT INTO alert_deliveries(id,alert_id,user_id,channel,status,available_at) VALUES(?,?,?,?, 'QUEUED',?) ON CONFLICT(alert_id,user_id,channel) DO NOTHING",
        )
        .bind(
          id("alert_delivery"),
          alertId,
          recipient.user_id,
          channel,
          availableAt.toISOString(),
        )
        .run();
      queued++;
    }
  }
  if (queued)
    await db
      .prepare(
        "INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,'NOTIFICATION_DELIVERY',?,?) ON CONFLICT(idempotency_key) DO NOTHING",
      )
      .bind(
        id("job"),
        input.householdId,
        `delivery:${eventId}`,
        JSON.stringify({ eventId }),
      )
      .run();
  return { queued, duplicate: false, eventId, alertId };
}

export async function enqueueTransactionNotification(db:PostgresDatabase,input:TransactionNotificationInput){return db.transaction(tx=>enqueueTransactionNotificationAtomic(tx,input));}
