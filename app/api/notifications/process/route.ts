import { database, id } from "@/lib/db";
import { loadRuntimeSecrets } from "@/lib/runtime-secrets";
import { decryptSecret } from "@/lib/crypto";
import webpush from "web-push";
import {evaluateMarketIntelligence} from "@/lib/market-alert-engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const json = (value: unknown) => {
  if (typeof value === "object" && value) return value as Record<string, any>;
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    return {};
  }
};
const template = (row: Record<string, any>) => {
  const evidence = json(row.evidence_json),
    url = `${process.env.APP_URL || ""}${evidence.deepLink || "/workspace/accounts"}`;
  const market=row.type==="market_intelligence";
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,sans-serif;color:#10251d"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border:1px solid #d9e3de;border-radius:18px;overflow:hidden"><tr><td style="padding:22px 26px;background:#12372c;color:#fff"><b style="letter-spacing:.14em">NORTHSTAR</b><div style="margin-top:7px;color:#bfe3d4">${market?"Market intelligence":"Transaction notification"}</div></td></tr><tr><td style="padding:26px"><h1 style="font-size:21px;margin:0 0 10px">${escape(row.title)}</h1><p style="color:#52665e;line-height:1.55">${escape(row.explanation)}</p>${market?`<p><b>${escape(evidence.symbol||evidence.macroEvent||"Market")}</b> · ${escape(evidence.eventClass)} · ${escape(evidence.timeframe)}<br>Confidence ${escape(evidence.confidence)}% · ${escape(evidence.dataBasis)}</p>`:`<p><b>${escape(evidence.institution)}</b> · ${escape(evidence.accountName)} ${evidence.mask ? `•••• ${escape(evidence.mask)}` : ""}<br>${escape(evidence.merchant)} · ${escape(evidence.category)} · ${evidence.pending ? "Pending" : "Posted"}</p>`}<a href="${escape(url)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#147a5b;color:#fff;text-decoration:none;font-weight:bold">Open ${market?"Northstar analysis":"exact transaction"}</a><p style="margin-top:24px;color:#718078;font-size:12px">Northstar provides explainable monitoring and never places an order or moves money.</p></td></tr></table></td></tr></table></body></html>`;
};
export async function POST(request: Request) {
  await loadRuntimeSecrets();
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = await database(),base = process.env.APP_URL || new URL(request.url).origin,
    households=await db.prepare("SELECT DISTINCT household_id FROM market_alert_preferences WHERE enabled=TRUE UNION SELECT DISTINCT household_id FROM market_watchlist").all<{household_id:string}>(),
    minuteBucket=new Date().toISOString().slice(0,16);
  for(const household of households.results)await db.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,'MARKET_INTELLIGENCE',?,?) ON CONFLICT(idempotency_key) DO NOTHING").bind(id("job"),household.household_id,`market:${household.household_id}:${minuteBucket}`,JSON.stringify({householdId:household.household_id})).run();
  const jobs = await db
      .prepare(
        "SELECT * FROM background_jobs WHERE status IN ('QUEUED','FAILED') AND available_at<=CURRENT_TIMESTAMP AND attempts<6 ORDER BY created_at LIMIT 25",
      )
      .all<Record<string, any>>();
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    webpush.setVapidDetails(
      process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1]
        ? `mailto:${process.env.EMAIL_FROM.match(/<([^>]+)>/)![1]}`
        : "mailto:security@northstar.local",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  let jobsCompleted = 0,
    jobsFailed = 0;
  for (const job of jobs.results) {
    await db
      .prepare(
        "UPDATE background_jobs SET status='RUNNING',attempts=attempts+1,locked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .bind(job.id)
      .run();
    try {
      if (job.job_type === "PLAID_SYNC") {
        const payload = json(job.payload_json),
          response = await fetch(`${base}/api/connections/plaid/sync`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.CRON_SECRET}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
        if (!response.ok) throw new Error(`PLAID_SYNC_${response.status}`);
      }
      if(job.job_type==="MARKET_INTELLIGENCE"){
        const payload=json(job.payload_json),householdId=String(payload.householdId||job.household_id||"");
        if(!householdId)throw new Error("MARKET_HOUSEHOLD_REQUIRED");
        await evaluateMarketIntelligence(db,householdId);
      }
      await db
        .prepare(
          "UPDATE background_jobs SET status='SUCCEEDED',completed_at=CURRENT_TIMESTAMP,error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(job.id)
        .run();
      jobsCompleted++;
    } catch (error) {
      const attempt = Number(job.attempts || 0) + 1,
        dead = attempt >= 6,
        delay = Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1));
      await db
        .prepare(
          "UPDATE background_jobs SET status=?,available_at=CURRENT_TIMESTAMP+(? * INTERVAL '1 second'),error_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(
          dead ? "DEAD" : "FAILED",
          delay,
          String(error instanceof Error ? error.message : "JOB_FAILED").slice(
            0,
            80,
          ),
          job.id,
        )
        .run();
      jobsFailed++;
    }
  }
  const deliveries = await db
    .prepare(
      `SELECT d.*,a.household_id,a.title,a.explanation,a.evidence_json,a.severity,a.type,u.email,np.fallback_json FROM alert_deliveries d JOIN alerts a ON a.id=d.alert_id JOIN users u ON u.id=d.user_id LEFT JOIN notification_preferences np ON np.household_id=a.household_id AND np.user_id=d.user_id WHERE d.status IN ('QUEUED','FAILED') AND d.available_at<=CURRENT_TIMESTAMP AND (d.status='QUEUED' OR NOT EXISTS(SELECT 1 FROM notification_delivery_attempts x WHERE x.delivery_id=d.id AND x.next_retry_at>CURRENT_TIMESTAMP)) ORDER BY CASE a.severity WHEN 'action_now' THEN 0 WHEN 'critical' THEN 0 WHEN 'important' THEN 1 WHEN 'warning' THEN 1 WHEN 'watch' THEN 2 ELSE 3 END,d.created_at LIMIT 50`,
    )
    .all<Record<string, any>>();
  let delivered = 0,
    failed = 0;
  for (const row of deliveries.results) {
    const prior = await db
        .prepare(
          "SELECT COUNT(*) count FROM notification_delivery_attempts WHERE delivery_id=?",
        )
        .bind(row.id)
        .first<{ count: string }>(),
      attempt = Number(prior?.count || 0) + 1;
    if (attempt > 5) continue;
    const attemptId = id("delivery_attempt");
    await db.batch([
      db
        .prepare(
          "UPDATE alert_deliveries SET status='SENT',attempted_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(row.id),
      db
        .prepare(
          "INSERT INTO notification_delivery_attempts(id,delivery_id,attempt_number,status) VALUES(?,?,?,'SENT')",
        )
        .bind(attemptId, row.id, attempt),
    ]);
    try {
      if (row.channel === "EMAIL") {
        if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
          throw new Error("EMAIL_NOT_CONFIGURED");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [row.email],
            subject: row.title,
            html: template(row),
          }),
        });
        if (!response.ok) throw new Error(`EMAIL_${response.status}`);
      } else if (row.channel === "BROWSER_PUSH") {
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
          throw new Error("PUSH_NOT_CONFIGURED");
        const evidence = json(row.evidence_json),
          subscriptions = await db
            .prepare(
              "SELECT id,encrypted_subscription FROM push_subscriptions WHERE household_id=? AND user_id=? AND active=TRUE",
            )
            .bind(row.household_id, row.user_id)
            .all<{ id: string; encrypted_subscription: string }>();
        if (!subscriptions.results.length)
          throw new Error("PUSH_SUBSCRIPTION_MISSING");
        let sent = 0;
        for (const subscription of subscriptions.results) {
          try {
            await webpush.sendNotification(
              JSON.parse(
                await decryptSecret(subscription.encrypted_subscription),
              ),
              JSON.stringify({
                title: row.title,
                body: row.explanation,
                url: evidence.deepLink || "/workspace/accounts",
                tag: row.alert_id,
                severity: String(row.severity||"info"),
                eventId: evidence.eventId,
                urgency: ["critical","action_now"].includes(String(row.severity).toLowerCase())||String(row.title).toLowerCase().includes("suspicious")
                  ? "critical"
                  : "normal",
              }),
              {
                TTL: 300,
                urgency: ["critical","action_now"].includes(String(row.severity).toLowerCase())||String(row.title).toLowerCase().includes("suspicious")
                  ? "high"
                  : "normal",
              },
            );
            sent++;
          } catch (error: any) {
            if ([404, 410].includes(Number(error?.statusCode)))
              await db
                .prepare(
                  "UPDATE push_subscriptions SET active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id=?",
                )
                .bind(subscription.id)
                .run();
          }
        }
        if (!sent) throw new Error("PUSH_DELIVERY_FAILED");
      }
      await db.batch([
        db
          .prepare(
            "UPDATE alert_deliveries SET status='DELIVERED',delivered_at=CURRENT_TIMESTAMP,error_code=NULL WHERE id=?",
          )
          .bind(row.id),
        db
          .prepare(
            "UPDATE notification_delivery_attempts SET status='DELIVERED',provider_code='ACCEPTED',next_retry_at=NULL WHERE id=?",
          )
          .bind(attemptId),
      ]);
      delivered++;
    } catch (error) {
      const code = String(
          error instanceof Error ? error.message : "DELIVERY_FAILED",
        ).slice(0, 80),
        delay = Math.min(3600, 30 * 2 ** (attempt - 1)),
        terminal = attempt >= 5;
      await db.batch([
        db
          .prepare(
            "UPDATE alert_deliveries SET status='FAILED',error_code=? WHERE id=?",
          )
          .bind(terminal ? `PERMANENT_${code}` : code, row.id),
        db
          .prepare(
            "UPDATE notification_delivery_attempts SET status='FAILED',provider_code=?,next_retry_at=? WHERE id=?",
          )
          .bind(
            code,
            terminal ? null : new Date(Date.now() + delay * 1000).toISOString(),
            attemptId,
          ),
      ]);
      const fallback = json(row.fallback_json),
        fallbackChannel =
          row.channel === "BROWSER_PUSH" && fallback.pushToEmail
            ? "EMAIL"
            : row.channel === "EMAIL" && fallback.emailToInApp
              ? "IN_APP"
              : null;
      if (terminal && fallbackChannel)
        await db
          .prepare(
            "INSERT INTO alert_deliveries(id,alert_id,user_id,channel,status,available_at) VALUES(?,?,?,?, 'QUEUED',CURRENT_TIMESTAMP) ON CONFLICT(alert_id,user_id,channel) DO NOTHING",
          )
          .bind(
            id("alert_delivery"),
            row.alert_id,
            row.user_id,
            fallbackChannel,
          )
          .run();
      failed++;
    }
  }
  return Response.json({
    jobs: {
      processed: jobs.results.length,
      completed: jobsCompleted,
      failed: jobsFailed,
    },
    deliveries: { processed: deliveries.results.length, delivered, failed },
  });
}
