import { workspace } from "@/lib/db";

export const dynamic = "force-dynamic";

const accountTypes = ["Taxable brokerage", "401(k)", "Traditional IRA", "Roth IRA", "SEP IRA", "Other investment"];
const purposes = ["Swing", "Options", "Long-term", "Retirement", "Dividend income", "Mixed"];

export async function POST(request: Request) {
  try {
    const { db, householdId } = await workspace(request);
    const body = await request.json() as { alias?: string; accountType?: string; purpose?: string };
    const alias = String(body.alias || "").trim().slice(0, 80);
    if (!alias) return Response.json({ error: "Account alias is required" }, { status: 400 });
    if (!accountTypes.includes(String(body.accountType))) return Response.json({ error: "Invalid account type" }, { status: 400 });
    if (!purposes.includes(String(body.purpose))) return Response.json({ error: "Invalid investment purpose" }, { status: 400 });

    let entity = await db.prepare("SELECT id FROM entities WHERE household_id=? AND type='investment' ORDER BY created_at LIMIT 1").bind(householdId).first<{id:string}>();
    if (!entity) {
      entity = { id: `entity_manual_${crypto.randomUUID()}` };
      await db.prepare("INSERT INTO entities(id,household_id,type,name) VALUES(?,?,'investment','Manual investment accounts')").bind(entity.id, householdId).run();
    }
    const id = `manual_account_${crypto.randomUUID()}`;
    await db.prepare("INSERT INTO accounts(id,entity_id,provider_account_id,name,official_name,nickname,investment_purpose,type,subtype,currency,current_balance_cents,updated_at) VALUES(?,?,?,'Manual investment account',?,?,?,'investment',?,'USD',0,CURRENT_TIMESTAMP)")
      .bind(id, entity.id, id, alias, alias, body.purpose, body.accountType).run();
    return Response.json({ ok: true, account: { id, nickname: alias, subtype: body.accountType, investment_purpose: body.purpose, source: "manual" } }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create manual investment account" }, { status: 500 });
  }
}
