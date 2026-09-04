import { workspace } from "@/lib/db";

export const dynamic = "force-dynamic";

const accountTypes = ["Taxable brokerage", "401(k)", "Traditional IRA", "Roth IRA", "SEP IRA", "Other investment"];
const purposes = ["Swing", "Options", "Long-term", "Retirement", "Dividend income", "Mixed"];

export async function POST(request: Request) {
  try {
    const { db, householdId, entityId, userId } = await workspace(request);
    const body = await request.json() as { alias?: string; accountType?: string; purpose?: string };
    const alias = String(body.alias || "").trim().slice(0, 80);
    if (!alias) return Response.json({ error: "Account alias is required" }, { status: 400 });
    if (!accountTypes.includes(String(body.accountType))) return Response.json({ error: "Invalid account type" }, { status: 400 });
    if (!purposes.includes(String(body.purpose))) return Response.json({ error: "Invalid investment purpose" }, { status: 400 });

    const id = `manual_account_${crypto.randomUUID()}`;
    await db.prepare("INSERT INTO accounts(id,entity_id,provider_account_id,name,official_name,nickname,investment_purpose,type,subtype,currency,current_balance_cents,updated_at) VALUES(?,?,?,'Manual investment account',?,?,?,'investment',?,'USD',0,CURRENT_TIMESTAMP)")
      .bind(id, entityId, id, alias, alias, body.purpose, body.accountType).run();
    await db.prepare("INSERT INTO audit_log(id,household_id,user_id,action,target_type,target_id,metadata_json) VALUES(?,?,?,?,?,?,?)")
      .bind(`audit_${crypto.randomUUID()}`, householdId, userId, "manual_investment_account_created", "account", id, JSON.stringify({ accountType: body.accountType, purpose: body.purpose })).run();
    return Response.json({ ok: true, account: { id, nickname: alias, subtype: body.accountType, investment_purpose: body.purpose, source: "manual" } }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("MANUAL_INVESTMENT_ACCOUNT_CREATE_FAILED", error);
    return Response.json({ error: "Manual investment account could not be created.", code: "MANUAL_ACCOUNT_CREATE_FAILED" }, { status: 500 });
  }
}
