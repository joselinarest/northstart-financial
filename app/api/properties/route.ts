import { workspace, id } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(r: Request) {
  try {
    const { db, householdId } = await workspace(r);
    return Response.json(
      (
        await db
          .prepare(
            "SELECT p.*,e.name entity_name FROM properties p JOIN entities e ON e.id=p.entity_id WHERE e.household_id=?",
          )
          .bind(householdId)
          .all()
      ).results,
    );
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
export async function POST(r: Request) {
  try {
    const { db, householdId } = await workspace(r),
      b = (await r.json()) as Record<string, unknown>;
    if (!b.name)
      return Response.json(
        { error: "Property name required" },
        { status: 400 },
      );
    const eid = id("entity"),
      pid = id("property");
    await db.batch([
      db
        .prepare(
          "INSERT INTO entities(id,household_id,type,name,legal_name) VALUES(?,?,?,?,?)",
        )
        .bind(eid, householdId, "property", b.name, b.legalName || null),
      db
        .prepare(
          "INSERT INTO properties(id,entity_id,address,property_type,purchase_price_cents,estimated_value_cents,monthly_rent_cents,monthly_expenses_cents) VALUES(?,?,?,?,?,?,?,?)",
        )
        .bind(
          pid,
          eid,
          b.address || null,
          b.propertyType || "residential",
          b.purchasePriceCents || null,
          b.estimatedValueCents || null,
          b.monthlyRentCents || 0,
          b.monthlyExpensesCents || 0,
        ),
    ]);
    return Response.json({ id: pid, entityId: eid }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function PATCH(r: Request) {
  try {
    const { db, householdId } = await workspace(r),
      b = (await r.json()) as Record<string, unknown>,
      propertyId = String(b.propertyId || "");
    if (!propertyId || !String(b.name || "").trim())
      return Response.json(
        { error: "Property and property name are required" },
        { status: 400 },
      );
    const owned = await db
      .prepare(
        "SELECT p.entity_id FROM properties p JOIN entities e ON e.id=p.entity_id WHERE p.id=? AND e.household_id=?",
      )
      .bind(propertyId, householdId)
      .first<{ entity_id: string }>();
    if (!owned)
      return Response.json({ error: "Property not found" }, { status: 404 });
    await db.batch([
      db
        .prepare("UPDATE entities SET name=? WHERE id=? AND household_id=?")
        .bind(String(b.name).trim(), owned.entity_id, householdId),
      db
        .prepare(
          "UPDATE properties SET address=?,property_type=?,purchase_price_cents=?,estimated_value_cents=?,monthly_rent_cents=?,monthly_expenses_cents=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(
          String(b.address || "").trim() || null,
          String(b.propertyType || "OTHER"),
          Number(b.purchasePriceCents || 0),
          Number(b.estimatedValueCents || 0),
          Number(b.monthlyRentCents || 0),
          Number(b.monthlyExpensesCents || 0),
          propertyId,
        ),
    ]);
    return Response.json({ ok: true, id: propertyId });
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json(
      { error: e instanceof Error ? e.message : "Property could not be updated" },
      { status: 500 },
    );
  }
}
