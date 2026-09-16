import { after } from "next/server";
import { createHash } from "node:crypto";
import { database, id } from "@/lib/db";
import { verifyPlaidWebhook } from "@/lib/plaid-webhook-verification";
import { loadRuntimeSecrets } from "@/lib/runtime-secrets";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const raw = await request.text(),
      verified = await verifyPlaidWebhook(
        raw,
        request.headers.get("plaid-verification"),
      );
    if (!verified)
      return Response.json(
        { error: "Invalid Plaid webhook signature" },
        { status: 401 },
      );
    const payload = JSON.parse(raw) as Record<string, any>,
      itemId = String(payload.item_id || ""),
      type = String(payload.webhook_type || "UNKNOWN"),
      code = String(payload.webhook_code || "UNKNOWN"),
      hash = createHash("sha256").update(raw).digest("hex"),
      db = await database();
    await db
      .prepare(
        "INSERT INTO plaid_webhook_events(id,item_id,webhook_type,webhook_code,request_hash,verified,payload_json) VALUES(?,?,?,?,?,TRUE,?) ON CONFLICT(request_hash) DO NOTHING",
      )
      .bind(id("plaid_hook"), itemId, type, code, hash, JSON.stringify(payload))
      .run();
    if (
      ["TRANSACTIONS","INVESTMENTS"].includes(type) &&
      [
        "SYNC_UPDATES_AVAILABLE",
        "DEFAULT_UPDATE",
        "INITIAL_UPDATE",
        "HISTORICAL_UPDATE",
      ].includes(code)
    ) {
      const connection = await db
        .prepare(
          "SELECT id,household_id FROM connections WHERE provider='plaid' AND provider_item_id=? AND status='active'",
        )
        .bind(itemId)
        .first<{ id: string; household_id: string }>();
      if (connection)
        await db
          .prepare(
            `INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,?, ?,?) ON CONFLICT(idempotency_key) DO NOTHING`,
          )
          .bind(
            id("job"),
            connection.household_id,
            type === "INVESTMENTS" ? "PLAID_INVESTMENT_SYNC" : "PLAID_SYNC",
            `plaid:${hash}`,
            JSON.stringify({
              connectionId: connection.id,
              householdId: connection.household_id,
              investmentOnly: type === "INVESTMENTS",
              trigger: type === "INVESTMENTS" ? `WEBHOOK_${code}` : `WEBHOOK_${type}_${code}`,
              webhookHash: hash,
            }),
          )
          .run();
    }
    if(type==="ITEM"&&["ERROR","PENDING_EXPIRATION","PENDING_DISCONNECT","USER_PERMISSION_REVOKED"].includes(code)){
      const plaidCode=String(payload.error?.error_code||code),message=String(payload.error?.error_message||"Plaid Item requires attention").slice(0,300);
      await db.prepare("UPDATE connections SET error_code=?,latest_plaid_error_message=?,investment_access_status=CASE WHEN ? IN ('ADDITIONAL_CONSENT_REQUIRED','ACCESS_NOT_GRANTED','ITEM_LOGIN_REQUIRED') THEN 'RECONNECT_REQUIRED' ELSE investment_access_status END WHERE provider='plaid' AND provider_item_id=?").bind(plaidCode,message,plaidCode,itemId).run();
    }
    await loadRuntimeSecrets();
    const base = process.env.APP_URL;
    if (base && process.env.CRON_SECRET)
      after(() =>
        fetch(`${base}/api/notifications/process`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        }).catch(() => undefined),
      );
    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook could not be accepted",
      },
      { status: 400 },
    );
  }
}
