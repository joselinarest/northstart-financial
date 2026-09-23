import path from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve(".cache/playwright");
import{defineConfig}from"@playwright/test";

export default defineConfig({testDir:"./tests/mobile",outputDir:"test-results/mobile-artifacts",timeout:45_000,fullyParallel:false,retries:0,reporter:[["list"],["html",{outputFolder:"playwright-report/mobile",open:"never"}]],use:{baseURL:process.env.NORTHSTAR_E2E_BASE_URL||"http://localhost:3100",storageState:process.env.NORTHSTAR_E2E_STORAGE_STATE||undefined,trace:"retain-on-failure",screenshot:"only-on-failure"},webServer:process.env.NORTHSTAR_E2E_BASE_URL?undefined:{command:"node node_modules/next/dist/bin/next dev -p 3100",url:"http://localhost:3100",reuseExistingServer:true,timeout:120_000}});
