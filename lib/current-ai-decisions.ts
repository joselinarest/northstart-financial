import type {PostgresDatabase} from "@/lib/db";
import type {DecisionOutput} from "@/lib/ai-investment-decision-engine";

/** Read the same persisted, unexpired account decision on every list surface. */
export async function currentAccountDecisions(db:PostgresDatabase,householdId:string,accountId:string){
  const rows=await db.prepare("SELECT DISTINCT ON(c.ticker) c.ticker,d.output_json FROM ai_current_decisions c JOIN ai_decision_runs d ON d.id=c.decision_id WHERE d.household_id=? AND c.account_id=? AND c.expires_at>CURRENT_TIMESTAMP ORDER BY c.ticker,c.captured_at DESC").bind(householdId,accountId).all<{ticker:string;output_json:DecisionOutput}>();
  return new Map(rows.results.map(row=>[row.ticker,row.output_json]));
}
