import assert from "node:assert/strict";
import {readFile,access} from "node:fs/promises";

const manifest=JSON.parse(await readFile(new URL("../public/manifest.webmanifest",import.meta.url),"utf8"));
assert.equal(manifest.display,"standalone");
assert.equal(manifest.scope,"/");
assert.ok(manifest.start_url.startsWith("/"));
assert.ok(manifest.icons.some(icon=>icon.sizes==="192x192"&&icon.purpose==="any"));
assert.ok(manifest.icons.some(icon=>icon.sizes==="512x512"&&icon.purpose==="maskable"));
for(const icon of manifest.icons)await access(new URL(`../public${icon.src}`,import.meta.url));

const worker=await readFile(new URL("../public/sw.js",import.meta.url),"utf8");
const layout=await readFile(new URL("../app/layout.tsx",import.meta.url),"utf8");
assert.match(layout,/apple-mobile-web-app-capable/);
assert.match(worker,/SKIP_WAITING/);
assert.match(worker,/request\.mode==="navigate"/);
assert.match(worker,/url\.pathname\.startsWith\("\/api\/"\)/);
assert.doesNotMatch(worker,/cache\.put\([^\n]*(\/api|transactions|accounts|balances|plaid)/i);
assert.match(worker,/notificationclick/);

console.log("PWA manifest, icons, safe-cache policy, updates, and notification deep links verified.");
