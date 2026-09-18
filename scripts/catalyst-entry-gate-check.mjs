import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const [gate, today, options] = await Promise.all([
  "../lib/catalyst-entry-gate.ts",
  "../lib/authoritative-recommendation.ts",
  "../app/api/market/options/route.ts",
].map(path => readFile(new URL(path, import.meta.url), "utf8")));
assert.match(gate, /WAIT FOR CATALYST/);
assert.match(gate, /Current company-news and earnings-calendar coverage is unavailable/);
assert.match(gate, /Earnings fall inside the option holding window/);
assert.match(gate, /IV-crush and gap risk are not authorized/);
assert.match(gate, /recent adverse material news item/);
assert.match(today, /evaluateCatalystEntryGate\(catalystContext, \{ mode: "SHARES" \}\)/);
assert.match(today, /catalystGate\.pass/);
assert.match(today, /catalysts: \{ \.\.\.catalystGate/);
assert.match(today, /!stale && catalystGate\.pass/);
assert.match(options, /evaluateCatalystEntryGate\(catalystContext,\{mode:"OPTIONS"/);
assert.match(options, /catalystPass\?"BUY_IF":"WAIT"/);
assert.match(options, /"catalystGate","optionQuote"/);
assert.match(options, /WAIT FOR CATALYST/);
console.log("Today and Options catalyst entry gates verified.");