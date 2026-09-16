import { workspace } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, householdId, userId } = await workspace(request),
      url = new URL(request.url),
      limit = Math.min(
        200,
        Math.max(1, Number(url.searchParams.get("limit") || 100)),
      ),
      result = await db
        .prepare(
          `SELECT e.id event_id,e.event_type,e.severity,e.snapshot_json,e.created_at,a.id alert_id,a.title,a.explanation,a.read_at,d.channel,d.status delivery_status,d.attempted_at,d.delivered_at,d.error_code FROM transaction_notification_events e JOIN alerts a ON a.id=('alert_'||e.id) LEFT JOIN alert_deliveries d ON d.alert_id=a.id AND d.user_id=? WHERE e.household_id=? ORDER BY e.created_at DESC,d.channel LIMIT ?`,
        )
        .bind(userId, householdId, limit)
        .all();
    return Response.json(
      { notifications: result.results },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Notification history unavailable",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { db, householdId, userId } = await workspace(request),
      body = (await request.json()) as {
        alertId?: string;
        action?: "READ" | "DISMISSED";
      };
    if (!body.alertId || !["READ", "DISMISSED"].includes(String(body.action)))
      return Response.json(
        { error: "alertId and a valid action are required" },
        { status: 400 },
      );
    const alert = await db
      .prepare("SELECT id FROM alerts WHERE id=? AND household_id=?")
      .bind(body.alertId, householdId)
      .first();
    if (!alert)
      return Response.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    if (body.action === "READ")
      await db.batch([
        db
          .prepare(
            "UPDATE alerts SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP::text) WHERE id=?",
          )
          .bind(body.alertId),
        db
          .prepare(
            "UPDATE alert_deliveries SET status='READ' WHERE alert_id=? AND user_id=? AND channel='IN_APP' AND status NOT IN ('DISMISSED')",
          )
          .bind(body.alertId, userId),
      ]);
    else
      await db.batch([
        db
          .prepare(
            "UPDATE alerts SET dismissed_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .bind(body.alertId),
        db
          .prepare(
            "UPDATE alert_deliveries SET status='DISMISSED' WHERE alert_id=? AND user_id=? AND channel='IN_APP'",
          )
          .bind(body.alertId, userId),
      ]);
    return Response.json({ ok: true, status: body.action });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Notification could not be updated",
      },
      { status: 400 },
    );
  }
}
