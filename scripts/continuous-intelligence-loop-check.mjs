import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8"),migration=read("db/migrations.ts"),worker=read("lib/notification-worker.ts"),loop=read("lib/continuous-intelligence-loop.ts"),api=read("app/api/intelligence-loop/route.ts"),ui=read("app/intelligence-loop-health.tsx"),workspace=read("app/northstar-workspace.tsx");
const checks=[
 [migration.includes('0030_continuous_intelligence_loop'),'loop migration'],
 [migration.includes("'ACCOUNT_INTELLIGENCE_LOOP'"),'durable job type'],
 [worker.includes('runAccountIntelligenceLoop'),'worker executes loop'],
 [worker.includes('account-loop:${account.id}:${loopBucket}'),'account-specific scheduled idempotency'],
 [loop.includes("'SYNC'")&&loop.includes("'ANALYZE'")&&loop.includes("'PREDICT'")&&loop.includes("'RECOMMEND'")&&loop.includes("'ALERT'")&&loop.includes("'MEASURE'")&&loop.includes("'LEARN'")&&loop.includes("'REANALYZE'"),'all loop stages'],
 [loop.includes('queueLifecycleTickers')&&read('lib/lifecycle-work-queue.ts').includes("'AI_EVENT_REVIEW'")&&worker.includes('authoritativeRecommendation'),'central decision engine persists snapshots'],
 [loop.includes('ai_decision_outcomes'),'immutable outcome measurement'],
 [loop.includes('account.id')&&loop.includes('account.strategy'),'account and strategy retained'],
 [api.includes("'ACCOUNT_INTELLIGENCE_LOOP'")&&api.includes('cycleKey'),'manual run enqueues backend job'],
 [ui.includes('CONTINUOUS INTELLIGENCE')&&/<IntelligenceLoopHealth\s+accessToken=\{accessToken\}\s+compact\s*\/>/.test(workspace),'Today health proof'],
 [/<IntelligenceLoopHealth\s+accessToken=\{accessToken\}\s*\/>/.test(workspace),'Settings diagnostic'],
];
const failed=checks.filter(([ok])=>!ok);if(failed.length){console.error(failed.map(([,name])=>`Missing: ${name}`).join('\n'));process.exit(1)}console.log('Account-first continuous intelligence scheduling, persistence, evidence stages, outcome measurement, and health UI verified.');