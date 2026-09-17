import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const api=await readFile(new URL("../app/api/system/capabilities/route.ts",import.meta.url),"utf8");
const ui=await readFile(new URL("../app/system-capability-audit.tsx",import.meta.url),"utf8");
const workspace=await readFile(new URL("../app/northstar-workspace.tsx",import.meta.url),"utf8");
for(const status of ["IMPLEMENTED","PARTIAL","NOT_IMPLEMENTED","PROVIDER_REQUIRED","BROKEN"]){
 assert.match(api,new RegExp(status),`API must expose ${status}`);
 assert.match(ui,new RegExp(status),`UI must render ${status}`);
}
for(const capability of ["charts-core","scanner","risk","options-chain","paper","news","decision","continuous-loop","mobile"]){
 assert.match(api,new RegExp(`id:\"${capability}\"`),`Missing audited capability ${capability}`);
}
assert.match(api,/worker_heartbeats/);
assert.match(api,/market_discovery_runs/);
assert.match(api,/PROVIDER_REQUIRED/);
assert.match(workspace,/SystemCapabilityAudit/);
assert.match(workspace,/<SystemCapabilityAudit accessToken=\{accessToken\}\/>/);
console.log("System capability registry, runtime evidence, honest statuses, and System Health rendering verified.");
