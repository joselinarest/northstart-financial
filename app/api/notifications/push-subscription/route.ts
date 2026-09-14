import { workspace, id } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { loadRuntimeSecrets } from "@/lib/runtime-secrets";
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
export async function GET(request: Request) {
  try {
    const {db,householdId,userId}=await workspace(request);
    await loadRuntimeSecrets();
    const result=await db.prepare("SELECT id,device_name,platform,updated_at FROM push_subscriptions WHERE household_id=? AND user_id=? AND active=TRUE ORDER BY updated_at DESC").bind(householdId,userId).all();
    return Response.json({
      publicKey: process.env.VAPID_PUBLIC_KEY || null,
      configured: Boolean(
        process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
      ),devices:result.results,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: "Push configuration unavailable" },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const { db, householdId, userId } = await workspace(request),
      body = (await request.json()) as { endpoint?: string;keys?:unknown;subscription?:{endpoint?:string;keys?:unknown};deviceName?:string;platform?:string;userAgentHint?:string },
      subscription=body.subscription||body;
    if (!subscription.endpoint)
      return Response.json(
        { error: "A valid push subscription is required" },
        { status: 400 },
      );
    const endpointHash = await hash(subscription.endpoint),
      encrypted = await encryptSecret(JSON.stringify(subscription));
    await db
      .prepare(
        "INSERT INTO push_subscriptions(id,household_id,user_id,endpoint_hash,encrypted_subscription,device_name,platform,user_agent_hint,active,updated_at) VALUES(?,?,?,?,?,?,?,?,TRUE,CURRENT_TIMESTAMP) ON CONFLICT(endpoint_hash) DO UPDATE SET household_id=excluded.household_id,user_id=excluded.user_id,encrypted_subscription=excluded.encrypted_subscription,device_name=excluded.device_name,platform=excluded.platform,user_agent_hint=excluded.user_agent_hint,active=TRUE,updated_at=CURRENT_TIMESTAMP",
      )
      .bind(
        id("push_subscription"),
        householdId,
        userId,
        endpointHash,
        encrypted,
        String(body.deviceName||"Northstar device").slice(0,80),
        String(body.platform||"Web Push").slice(0,40),
        String(body.userAgentHint||"").slice(0,100),
      )
      .run();
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Push subscription could not be saved",
      },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request) {
  try {
    const { db, householdId, userId } = await workspace(request),subscriptionId=new URL(request.url).searchParams.get("id");
    await db
      .prepare(
        `UPDATE push_subscriptions SET active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE household_id=? AND user_id=?${subscriptionId?" AND id=?":""}`,
      )
      .bind(householdId, userId,...(subscriptionId?[subscriptionId]:[]))
      .run();
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: "Push subscription could not be disabled" },
      { status: 400 },
    );
  }
}
