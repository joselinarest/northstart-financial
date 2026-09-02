import { workspace } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { db, householdId } = await workspace(request);
    const connections = await db.prepare("SELECT id,institution_name,status,last_synced_at,error_code,created_at FROM connections WHERE household_id=? AND provider='plaid' ORDER BY created_at DESC").bind(householdId).all();
    const accounts = await db.prepare("SELECT a.id,a.connection_id,a.name,a.official_name,a.type,a.subtype,a.currency,a.mask,a.current_balance_cents,a.available_balance_cents,a.credit_limit_cents,a.updated_at FROM accounts a JOIN entities e ON e.id=a.entity_id WHERE e.household_id=? AND a.hidden=0 ORDER BY a.type,a.name").bind(householdId).all();
    const holdings = await db.prepare("SELECT h.account_id,s.ticker,s.name,s.type,h.quantity,h.cost_basis_cents,h.price_cents,h.price_at,(h.quantity*h.price_cents) market_value_cents FROM holdings h JOIN securities s ON s.id=h.security_id JOIN accounts a ON a.id=h.account_id JOIN entities e ON e.id=a.entity_id WHERE e.household_id=? ORDER BY market_value_cents DESC").bind(householdId).all();
    return Response.json({ connections: connections.results, accounts: accounts.results, holdings: holdings.results });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load connections" }, { status: 500 });
  }
}
