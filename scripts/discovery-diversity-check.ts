import { database } from "../lib/db";
import { runMarketDiscovery } from "../lib/market-discovery-engine";

const db=await database();
const result=await runMarketDiscovery(db,{force:true});
const rows=await db.prepare(`SELECT symbol,company_name,discovery_category,cap_bucket,hotness_crowding,
  discovery_confidence,status,scores_json FROM market_discovery_candidates
  WHERE scan_run_id=? ORDER BY status='REJECTED',discovery_confidence DESC`).bind(String(result.runId)).all<Record<string,unknown>>();
const accepted=rows.results.filter(row=>row.status!=="REJECTED"),categories=[...new Set(accepted.map(row=>row.discovery_category))],caps=[...new Set(accepted.map(row=>row.cap_bucket))];
if(!rows.results.length)throw new Error("The provider-backed scan persisted no candidate records");
if(!categories.length)throw new Error("The scan persisted no discovery categories");
for(const row of rows.results){const scores=typeof row.scores_json==="string"?JSON.parse(row.scores_json):row.scores_json;if(!scores||typeof scores!=="object"||!("entryAttractiveness" in scores))throw new Error(`Missing diversified scorecard for ${row.symbol}`)}
console.log(JSON.stringify({result,persisted:rows.results.length,accepted:accepted.length,categories,caps,top:rows.results.slice(0,12)},null,2));
process.exit(0);
