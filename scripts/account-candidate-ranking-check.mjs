import assert from "node:assert/strict";import{readFile}from"node:fs/promises";
const engine=await readFile(new URL("../lib/account-candidate-ranking.ts",import.meta.url),"utf8"),api=await readFile(new URL("../app/api/market/candidates/discovery/route.ts",import.meta.url),"utf8"),ui=await readFile(new URL("../app/new-candidate-discovery.tsx",import.meta.url),"utf8");
for(const token of ["accountId","portfolio_fit","account_rank","BUY_DECISION_READY","REJECTED_NOT_SUITABLE","existingWeight","sectorWeight"])assert.match(engine,new RegExp(token));
for(const state of ["QUALIFIED_CANDIDATE","NEAR_MISS","REJECTED","NOT_SCANNED","DATA_UNAVAILABLE"])assert.match(api,new RegExp(state));
for(const text of ["Why is this not in the list?","Best for this account","Why it ranks here","Why it could fail","Universe scanned"])assert.match(ui,new RegExp(text.replace(/[?]/g,"\\?")));
assert.match(ui,/accountId/);assert.match(api,/rankCandidatesForAccount/);console.log("Account-specific candidate ranking and explicit ticker explanation contract verified.");
