import { database } from "../lib/db";
import { authoritativeRecommendation } from "../lib/authoritative-recommendation";

const db = await database();
const account = await db.prepare(`
  SELECT a.id, e.household_id, COALESCE(s.strategy_type, 'GROWTH_5_7') strategy_type
  FROM accounts a
  JOIN entities e ON e.id = a.entity_id
  LEFT JOIN investment_account_settings s ON s.account_id = a.id
  WHERE a.type = 'investment'
  ORDER BY CASE WHEN COALESCE(s.strategy_type, '') ILIKE '%SWING%' THEN 1 ELSE 0 END, a.id
  LIMIT 1
`).first<{ id:string; household_id:string; strategy_type:string }>();

if (!account) throw new Error("No investment account is available for the acceptance check");
const result = await authoritativeRecommendation(db, {
  householdId: account.household_id,
  accountId: account.id,
  symbol: "ORCL",
  force: true,
});
const active = await db.prepare(`
  SELECT r.id, r.action, r.confidence, r.generated_at, r.strategy_version, r.research_snapshot_id,
         r.market_snapshot_id, r.checks_json, s.ticker
  FROM recommendations r JOIN securities s ON s.id = r.security_id
  WHERE r.household_id = ? AND r.account_id = ? AND s.ticker = 'ORCL'
    AND r.lifecycle IN ('MONITORING','TRIGGERED')
`).bind(account.household_id, account.id).all<Record<string, unknown>>();

if (active.results.length !== 1) throw new Error(`Expected exactly one active ORCL recommendation; found ${active.results.length}`);
if (active.results[0].id !== result.recommendation.recommendationId) throw new Error("Returned and persisted recommendation IDs differ");
console.log(JSON.stringify({ account, recommendation: result.recommendation, active: active.results[0] }, null, 2));
process.exit(0);
