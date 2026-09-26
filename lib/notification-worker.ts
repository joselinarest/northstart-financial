import {runOptionsDiscovery} from '@/lib/options-discovery';
import {analyzeAndStoreOptions} from '@/lib/options-analysis';
import {coalesceRefreshJobs} from '@/lib/worker-refresh-queue';
import {exchangeDay} from '@/lib/exchange-calendar';
import {scheduleQuantFlow,monitorQuantFlow} from "@/lib/quant-data-monitor";
import {withWorkBudget} from "@/lib/work-budget";
import {claimWorker,releaseWorker} from "@/lib/worker-lease";
import {workerFailure} from "@/lib/worker-failure";
import {deliverPushDevices} from "@/lib/notification-push-delivery";
import { database, id } from "@/lib/db";
import {indexNotificationEvents,eventLink,quietUntil,severity} from "@/lib/notification-events";
import { loadRuntimeSecrets } from "@/lib/runtime-secrets";
import { decryptSecret } from "@/lib/crypto";
import webpush from "web-push";
import {evaluateMarketIntelligence} from "@/lib/market-alert-engine";
import {runMarketDiscovery} from "@/lib/market-discovery-engine";
import {generateDailyMarketReview} from "@/lib/daily-market-review";
import {marketSessionAt} from "@/lib/market-session";
import {evaluateTacticalSellRebuy} from "@/lib/tactical-rebuy-engine";
// Execution monitoring and outcomes are owned by the account Trade Lifecycle Engine.
import {evaluateOptionsFlow} from "@/lib/options-flow-engine";
import {refreshInvestmentNotificationCoverage} from "@/lib/investment-notification-coverage";
import {runAccountIntelligenceLoop} from "@/lib/continuous-intelligence-loop";
import {authoritativeRecommendation} from "@/lib/authoritative-recommendation";
import {reviewKidsPlans} from "@/lib/kids-planning";


const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const json = (value: unknown) => {
  if (typeof value === "object" && value) return value as Record<string, any>;
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    return {};
  }
};
const template = (row: Record<string, any>) => {
  const evidence = json(row.evidence_json),
    url = `${process.env.APP_URL || ""}${evidence.deepLink || "/workspace/accounts"}`;
  const market=row.type==="market_intelligence";
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,sans-serif;color:#10251d"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border:1px solid #d9e3de;border-radius:18px;overflow:hidden"><tr><td style="padding:22px 26px;background:#12372c;color:#fff"><b style="letter-spacing:.14em">NORTHSTAR</b><div style="margin-top:7px;color:#bfe3d4">${market?"Market intelligence":"Transaction notification"}</div></td></tr><tr><td style="padding:26px"><h1 style="font-size:21px;margin:0 0 10px">${escape(row.title)}</h1><p style="color:#52665e;line-height:1.55">${escape(row.explanation)}</p>${market?`<p><b>${escape(evidence.symbol||evidence.macroEvent||"Market")}</b> · ${escape(evidence.eventClass)} · ${escape(evidence.timeframe)}<br>Confidence ${escape(evidence.confidence)}% · ${escape(evidence.dataBasis)}</p>`:`<p><b>${escape(evidence.institution)}</b> · ${escape(evidence.accountName)} ${evidence.mask ? `•••• ${escape(evidence.mask)}` : ""}<br>${escape(evidence.merchant)} · ${escape(evidence.category)} · ${evidence.pending ? "Pending" : "Posted"}</p>`}<a href="${escape(url)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#147a5b;color:#fff;text-decoration:none;font-weight:bold">Open ${market?"Northstar analysis":"exact transaction"}</a><p style="margin-top:24px;color:#718078;font-size:12px">Northstar provides explainable monitoring and never places an order or moves money.</p></td></tr></table></td></tr></table></body></html>`;
};
async function processNotifications(request: Request,limits:{totalMs:number;jobMs:number}) {
  const startedAt=Date.now(),jobDeadline=startedAt+limits.totalMs-10_000,deliveryDeadline=startedAt+limits.totalMs;
  await loadRuntimeSecrets();
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = await database(),base = process.env.APP_URL || new URL(request.url).origin,
    households=await db.prepare("SELECT DISTINCT household_id FROM household_members WHERE status='active'").all<{household_id:string}>(),
    minuteBucket=new Date().toISOString().slice(0,16);
  const session=marketSessionAt(Date.now()),et=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).filter(x=>x.type!=="literal").map(x=>[x.type,x.value])),sessionDate=`${et.year}-${et.month}-${et.day}`,etMinute=Number(et.hour)*60+Number(et.minute);
  await db.prepare("INSERT INTO worker_heartbeats(worker_name,status,market_session,metadata_json,heartbeat_at) VALUES('aws-market-worker','RUNNING',?,?,CURRENT_TIMESTAMP) ON CONFLICT(worker_name) DO UPDATE SET status='RUNNING',market_session=EXCLUDED.market_session,metadata_json=EXCLUDED.metadata_json,heartbeat_at=CURRENT_TIMESTAMP").bind(session,JSON.stringify({minuteBucket,households:households.results.length})).run();
  for(const household of households.results)await db.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) SELECT ?,?,'MARKET_INTELLIGENCE',?,? WHERE NOT EXISTS(SELECT 1 FROM background_jobs WHERE job_type='MARKET_INTELLIGENCE' AND household_id=? AND status IN ('QUEUED','RUNNING','FAILED')) ON CONFLICT(idempotency_key) DO NOTHING").bind(id("job"),household.household_id,`market:${household.household_id}:${minuteBucket}`,JSON.stringify({householdId:household.household_id}),household.household_id).run();
  const loopWindow=session==="REGULAR"?5:30,loopBucket=`${sessionDate}:${Math.floor(etMinute/loopWindow)}`;
  for(const household of households.results){const accounts=await db.prepare("SELECT a.id FROM accounts a JOIN entities e ON e.id=a.entity_id LEFT JOIN investment_account_settings s ON s.account_id=a.id WHERE e.household_id=? AND a.hidden=0 AND (a.type='investment' OR s.account_id IS NOT NULL)").bind(household.household_id).all<{id:string}>();for(const account of accounts.results)await db.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) SELECT ?,?,'ACCOUNT_INTELLIGENCE_LOOP',?,? WHERE NOT EXISTS(SELECT 1 FROM background_jobs WHERE job_type='ACCOUNT_INTELLIGENCE_LOOP' AND payload_json->>'accountId'=? AND status IN ('QUEUED','RUNNING','FAILED')) ON CONFLICT(idempotency_key) DO NOTHING").bind(id("job"),household.household_id,`account-loop:${account.id}:${loopBucket}`,JSON.stringify({householdId:household.household_id,accountId:account.id,trigger:"SCHEDULED",cycleKey:`scheduled:${account.id}:${loopBucket}`}),account.id).run()}  const discoveryBucket=`${sessionDate}:${Math.floor(etMinute/(session==="REGULAR"?1:15))}`;
  await db.prepare("INSERT INTO background_jobs(id,job_type,idempotency_key,payload_json) SELECT ?,'MARKET_DISCOVERY',?,? WHERE NOT EXISTS(SELECT 1 FROM background_jobs WHERE job_type='MARKET_DISCOVERY' AND status IN ('QUEUED','RUNNING','FAILED')) ON CONFLICT(idempotency_key) DO NOTHING").bind(id("job"),`discovery:${discoveryBucket}`,JSON.stringify({scheduledAt:new Date().toISOString()})).run();
  if(session!=="CLOSED"){const flowBucket=`${sessionDate}:${Math.floor(etMinute/5)}`;await db.prepare("INSERT INTO background_jobs(id,job_type,idempotency_key,payload_json) VALUES(?,'OPTIONS_FLOW',?,?) ON CONFLICT(idempotency_key) DO NOTHING").bind(id("job"),`options-flow:${flowBucket}`,JSON.stringify({session,scheduledAt:new Date().toISOString()})).run()}
  if(session!=="CLOSED")await scheduleQuantFlow(db,`${sessionDate}:${Math.floor(etMinute/5)}`);
  if(session==="AFTER_HOURS"&&etMinute>=exchangeDay(Date.now()).closeMinute+5)for(const household of households.results)await db.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,'INVESTMENT_COVERAGE_AUDIT',?,?) ON CONFLICT(idempotency_key) DO NOTHING").bind(id("job"),household.household_id,`coverage:${household.household_id}:${sessionDate}`,JSON.stringify({householdId:household.household_id,sessionDate})).run();
  if(session==="AFTER_HOURS"&&etMinute>=exchangeDay(Date.now()).closeMinute+5)for(const household of households.results)await db.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,'KIDS_PLAN_REVIEW',?,?) ON CONFLICT(idempotency_key) DO NOTHING").bind(id("job"),household.household_id,`kids-review:${household.household_id}:${sessionDate}`,JSON.stringify({householdId:household.household_id,sessionDate})).run();
  if(session==="AFTER_HOURS"&&etMinute>=exchangeDay(Date.now()).closeMinute+5)for(const household of households.results)await db.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,'DAILY_CLOSE_REVIEW',?,?) ON CONFLICT(idempotency_key) DO NOTHING").bind(id("job"),household.household_id,`close-review:${household.household_id}:${sessionDate}`,JSON.stringify({householdId:household.household_id,sessionDate})).run();
  if(session==="PREMARKET"&&etMinute>=8*60+30)for(const household of households.results)await db.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,'OVERNIGHT_OUTLOOK_REFRESH',?,?) ON CONFLICT(idempotency_key) DO NOTHING").bind(id("job"),household.household_id,`premarket-review:${household.household_id}:${sessionDate}`,JSON.stringify({householdId:household.household_id,sessionDate})).run();
  if(session!=="CLOSED"){const tacticalBucket=`${sessionDate}:${Math.floor(etMinute/5)}`;await db.prepare("INSERT INTO background_jobs(id,job_type,idempotency_key,payload_json) VALUES(?,'TACTICAL_REENTRY_MONITOR',?,?) ON CONFLICT(idempotency_key) DO NOTHING").bind(id("job"),`tactical-monitor:${tacticalBucket}`,JSON.stringify({session,tacticalBucket})).run()}
  await db.prepare("INSERT INTO background_jobs(id,job_type,idempotency_key,payload_json) SELECT ?,'OPTIONS_DISCOVERY',?,'{}'::jsonb WHERE NOT EXISTS(SELECT 1 FROM background_jobs WHERE job_type='OPTIONS_DISCOVERY' AND status IN ('QUEUED','RUNNING','FAILED')) ON CONFLICT(idempotency_key) DO NOTHING").bind(id('job'),'options-discovery:'+Math.floor(Date.now()/300000)).run();
  // Claim work atomically. EventBridge can invoke more than once and an SSR
  // request can die mid-job; SKIP LOCKED plus stale-lock recovery prevents both
  // duplicate execution and permanently RUNNING work.
  await coalesceRefreshJobs(db);
  const jobs={results:[] as Record<string, any>[]};
  const lanes=["MARKET_DISCOVERY","OPTIONS_DISCOVERY","OPTIONS_ACCOUNT_REVIEW","ACCOUNT_INTELLIGENCE_LOOP","MARKET_INTELLIGENCE","MAINTENANCE"];
  const preferredLane=lanes[Math.floor(Date.now()/60000)%lanes.length];
  const claimJob = async(preferBroad=false)=>await db.prepare(`WITH claimable AS (
      SELECT id FROM background_jobs
      WHERE attempts<6 AND available_at<=CURRENT_TIMESTAMP
        AND (status IN ('QUEUED','FAILED') OR (status='RUNNING' AND locked_at<CURRENT_TIMESTAMP-INTERVAL '10 minutes'))
      ORDER BY CASE WHEN ?::boolean AND (job_type=?::text OR (?::text='MAINTENANCE' AND job_type IN ('DAILY_CLOSE_REVIEW','OVERNIGHT_OUTLOOK_REFRESH','TACTICAL_REENTRY_MONITOR','INVESTMENT_COVERAGE_AUDIT','KIDS_PLAN_REVIEW'))) THEN 0 ELSE 1 END,CASE WHEN job_type='OPTIONS_ACCOUNT_REVIEW' AND payload_json->>'manual'='true' THEN 0 ELSE 1 END,CASE WHEN created_at<CURRENT_TIMESTAMP-INTERVAL '10 minutes' THEN 0 ELSE 1 END,CASE job_type WHEN 'AI_EVENT_REVIEW' THEN 0 WHEN 'PLAID_INVESTMENT_SYNC' THEN 1 WHEN 'PLAID_SYNC' THEN 1 WHEN 'NOTIFICATION_DELIVERY' THEN 2 WHEN 'ACCOUNT_INTELLIGENCE_LOOP' THEN 3 WHEN 'MARKET_DISCOVERY' THEN 4 WHEN 'OPTIONS_DISCOVERY' THEN 4 WHEN 'OPTIONS_ACCOUNT_REVIEW' THEN 4 WHEN 'MARKET_INTELLIGENCE' THEN 5 ELSE 5 END,created_at FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE background_jobs j SET status='RUNNING',attempts=j.attempts+1,
      locked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
      FROM claimable c WHERE j.id=c.id RETURNING j.*`).bind(preferBroad,preferredLane,preferredLane).all<Record<string, any>>();
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    webpush.setVapidDetails(
      process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1]
        ? `mailto:${process.env.EMAIL_FROM.match(/<([^>]+)>/)![1]}`
        : "mailto:security@northstar.local",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  let jobsCompleted = 0,
    jobsFailed = 0;
  for (let claimCount=0;claimCount<20&&Date.now()+limits.jobMs+1_000<jobDeadline;claimCount++) {
    const job=(await claimJob(claimCount===0)).results[0];if(!job)break;jobs.results.push(job);
    try {
      await withWorkBudget(Math.max(1,Math.min(limits.jobMs,jobDeadline-Date.now())),async()=>{
      if (job.job_type === "PLAID_SYNC" || job.job_type === "PLAID_INVESTMENT_SYNC") {
        const payload = json(job.payload_json),
          response = await fetch(`${base}/api/connections/plaid/sync`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.CRON_SECRET}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal:AbortSignal.timeout(12_000),
          });
        if (!response.ok) throw new Error(`PLAID_SYNC_${response.status}`);
      }
      if(job.job_type==="MARKET_INTELLIGENCE"){
        const payload=json(job.payload_json),householdId=String(payload.householdId||job.household_id||"");
        if(!householdId)throw new Error("MARKET_HOUSEHOLD_REQUIRED");
        await evaluateMarketIntelligence(db,householdId);
      }
      if(job.job_type==='OPTIONS_DISCOVERY')await runOptionsDiscovery(db);
      if(job.job_type==='OPTIONS_ACCOUNT_REVIEW'){const response=await analyzeAndStoreOptions(db,String(job.household_id),json(job.payload_json));if(!response.ok)throw Error('OPTIONS_REVIEW_'+response.status);}
      if(job.job_type==="MARKET_DISCOVERY")await runMarketDiscovery(db);
      if(job.job_type==="AI_EVENT_REVIEW"){const payload=json(job.payload_json);await authoritativeRecommendation(db,{householdId:String(job.household_id),accountId:String(payload.accountId),symbol:String(payload.symbol),force:true});}
      if(job.job_type==="QUANT_FLOW")await monitorQuantFlow(db,String(json(job.payload_json).symbol));
      if(job.job_type==="OPTIONS_FLOW")await evaluateOptionsFlow(db);
      if(job.job_type==="KIDS_PLAN_REVIEW"){const householdId=String(job.household_id||"");if(!householdId)throw new Error("KIDS_REVIEW_HOUSEHOLD_REQUIRED");await reviewKidsPlans(db,householdId,"MONTHLY");}
      if(job.job_type==="ACCOUNT_INTELLIGENCE_LOOP"){const payload=json(job.payload_json);await runAccountIntelligenceLoop(db,{householdId:String(payload.householdId||job.household_id||""),accountId:String(payload.accountId||""),trigger:String(payload.trigger||"SCHEDULED"),cycleKey:String(payload.cycleKey||job.id)});}
      if(job.job_type==="INVESTMENT_COVERAGE_AUDIT"){const householdId=String(job.household_id||"");if(!householdId)throw new Error("COVERAGE_HOUSEHOLD_REQUIRED");await refreshInvestmentNotificationCoverage(db,householdId);}
      if(job.job_type==="DAILY_CLOSE_REVIEW"||job.job_type==="OVERNIGHT_OUTLOOK_REFRESH"){
        const householdId=String(job.household_id||"");if(!householdId)throw new Error("REVIEW_HOUSEHOLD_REQUIRED");
        await generateDailyMarketReview(db,householdId,job.job_type==="DAILY_CLOSE_REVIEW"?"MARKET_CLOSE":"PREMARKET_REVISION");
      }
      if(job.job_type==="TACTICAL_REENTRY_MONITOR"){if(session==="REGULAR")for(const household of households.results)await evaluateTacticalSellRebuy(db,household.household_id)}
      });
      await db
        .prepare(
          "UPDATE background_jobs SET status='SUCCEEDED',completed_at=CURRENT_TIMESTAMP,error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(job.id)
        .run();
      jobsCompleted++;
    } catch (error) {
      const attempt = Number(job.attempts || 0),
        dead = attempt >= 6,
        delay = Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1));
      await db
        .prepare(
          "UPDATE background_jobs SET status=?,available_at=CURRENT_TIMESTAMP+(? * INTERVAL '1 second'),error_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(
          dead ? "DEAD" : "FAILED",
          delay,
          String(error instanceof Error ? error.message : "JOB_FAILED").slice(
            0,
            80,
          ),
          job.id,
        )
        .run();
      jobsFailed++;
    }
  }
  await db.prepare("UPDATE worker_heartbeats SET status='DELIVERING',jobs_succeeded=jobs_succeeded+?,jobs_failed=jobs_failed+?,metadata_json=?,heartbeat_at=CURRENT_TIMESTAMP WHERE worker_name='aws-market-worker'").bind(jobsCompleted,jobsFailed,JSON.stringify({minuteBucket,session,jobsProcessed:jobs.results.length})).run();
  await indexNotificationEvents(db);
  const deliveries = await db.prepare(`WITH claimable AS (
      SELECT d.id FROM alert_deliveries d JOIN alerts a ON a.id=d.alert_id
      WHERE d.available_at<=CURRENT_TIMESTAMP AND a.dismissed_at IS NULL AND NOT EXISTS(SELECT 1 FROM notification_event_updates eu JOIN notification_event_states es ON es.event_id=eu.event_id WHERE eu.alert_id=a.id AND es.user_id=d.user_id AND es.dismissed_at IS NOT NULL)
        AND (SELECT COUNT(*) FROM notification_delivery_attempts ax WHERE ax.delivery_id=d.id)<5 AND (
        d.status IN ('QUEUED','PENDING') OR
        (d.status='FAILED' AND NOT EXISTS(SELECT 1 FROM notification_delivery_attempts x WHERE x.delivery_id=d.id AND x.next_retry_at>CURRENT_TIMESTAMP)) OR
        (d.status='SENT' AND d.attempted_at<CURRENT_TIMESTAMP-INTERVAL '5 minutes' AND COALESCE((SELECT x.provider_code FROM notification_delivery_attempts x WHERE x.delivery_id=d.id ORDER BY x.attempt_number DESC LIMIT 1),'')<>'ACCEPTED')
      ) ORDER BY CASE a.severity WHEN 'action_now' THEN 0 WHEN 'critical' THEN 0 WHEN 'important' THEN 1 WHEN 'warning' THEN 1 WHEN 'watch' THEN 2 ELSE 3 END,d.created_at
      FOR UPDATE OF d SKIP LOCKED LIMIT 10
    ), claimed AS (
      UPDATE alert_deliveries d SET status='SENT',attempted_at=CURRENT_TIMESTAMP
      FROM claimable c WHERE d.id=c.id RETURNING d.*
    ) SELECT d.*,a.household_id,a.title,a.explanation,a.evidence_json,a.severity,a.type,u.email,np.fallback_json,np.quiet_hours_json,np.timezone,ne.id event_id,ne.summary event_summary,ne.category event_category
      FROM claimed d JOIN alerts a ON a.id=d.alert_id JOIN users u ON u.id=d.user_id
      LEFT JOIN notification_preferences np ON np.household_id=a.household_id AND np.user_id=d.user_id
      LEFT JOIN notification_event_updates eu ON eu.alert_id=a.id LEFT JOIN notification_events ne ON ne.id=eu.event_id`)
    .all<Record<string, any>>();
  let delivered = 0,
    failed = 0;
  for (let deliveryIndex=0;deliveryIndex<deliveries.results.length;deliveryIndex++) {
    const row=deliveries.results[deliveryIndex];
    if(Date.now()>=deliveryDeadline){await db.prepare("UPDATE alert_deliveries SET status='QUEUED' WHERE id=ANY(?::text[]) AND status='SENT'").bind(deliveries.results.slice(deliveryIndex).map(d=>d.id)).run();break;}
    const cancelled=await db.prepare("SELECT 1 cancelled FROM alert_deliveries d JOIN alerts a ON a.id=d.alert_id WHERE d.id=? AND (d.status='DISMISSED' OR a.dismissed_at IS NOT NULL OR EXISTS(SELECT 1 FROM notification_event_updates eu JOIN notification_event_states es ON es.event_id=eu.event_id WHERE eu.alert_id=a.id AND es.user_id=d.user_id AND es.dismissed_at IS NOT NULL))").bind(row.id).first();
    if(cancelled){await db.prepare("UPDATE alert_deliveries SET status='DISMISSED',error_code='USER_DISMISSED' WHERE id=?").bind(row.id).run();continue;}
    const preference=await db.prepare("SELECT in_app,push,email FROM notification_category_preferences WHERE household_id=? AND user_id=? AND category=?").bind(row.household_id,row.user_id,row.event_category||"System").first<Record<string,boolean>>();
    const channelKey=row.channel==="BROWSER_PUSH"?"push":row.channel==="EMAIL"?"email":"in_app";
    if(preference?.[channelKey]===false){await db.prepare("UPDATE alert_deliveries SET status='DISMISSED',error_code='CATEGORY_DISABLED' WHERE id=?").bind(row.id).run();continue;}
    const resume=quietUntil(json(row.quiet_hours_json),String(row.timezone||"America/New_York"),severity(row.severity));
    if(row.channel!=="IN_APP"&&resume.getTime()>Date.now()){await db.prepare("UPDATE alert_deliveries SET status='QUEUED',available_at=? WHERE id=?").bind(resume.toISOString(),row.id).run();continue;}
    row.explanation=row.event_summary||row.explanation;
    row.evidence_json={...json(row.evidence_json),deepLink:row.event_id?eventLink(row.event_id):"/workspace/notifications"};
    const prior = await db
        .prepare(
          "SELECT COUNT(*) count FROM notification_delivery_attempts WHERE delivery_id=?",
        )
        .bind(row.id)
        .first<{ count: string }>(),
      attempt = Number(prior?.count || 0) + 1;
    if (attempt > 5) {
      await db.prepare("UPDATE alert_deliveries SET status='FAILED',error_code=COALESCE(error_code,'PERMANENT_RETRY_LIMIT') WHERE id=?").bind(row.id).run();
      continue;
    }
    const attemptId = id("delivery_attempt");
    await db.batch([
      db
        .prepare(
          "INSERT INTO notification_delivery_attempts(id,delivery_id,attempt_number,status) VALUES(?,?,?,'SENT')",
        )
        .bind(attemptId, row.id, attempt),
    ]);
    try {
      if (row.channel === "EMAIL") {
        if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
          throw new Error("EMAIL_NOT_CONFIGURED");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          signal:AbortSignal.timeout(10000),
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key":row.id,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [row.email],
            subject: row.title,
            html: template(row),
          }),
        });
        if (!response.ok) throw new Error(`EMAIL_${response.status}`);
      } else if (row.channel === "BROWSER_PUSH") {
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
          throw new Error("PUSH_NOT_CONFIGURED");
        const evidence=json(row.evidence_json);
        await deliverPushDevices(db,row as {id:string;household_id:string;user_id:string},async encrypted=>{
          await webpush.sendNotification(JSON.parse(await decryptSecret(encrypted)),JSON.stringify({title:row.title,body:row.explanation,url:row.event_id?eventLink(row.event_id):"/workspace/notifications",analysisUrl:evidence.deepLink,tag:row.event_id||row.alert_id,eventId:row.event_id,severity:severity(row.severity),urgency:severity(row.severity)==="CRITICAL"?"critical":"normal"}),{TTL:300,timeout:10000,urgency:severity(row.severity)==="CRITICAL"?"high":"normal"});
        });
      }
      await db.batch([
        db
          .prepare(
            "UPDATE alert_deliveries SET status=?,delivered_at=CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE delivered_at END,error_code=NULL WHERE id=?",
          )
          .bind(row.channel==="IN_APP"?"DELIVERED":"SENT",row.channel==="IN_APP",row.id),
        db
          .prepare(
            "UPDATE notification_delivery_attempts SET status=?,provider_code='ACCEPTED',next_retry_at=NULL WHERE id=?",
          )
          .bind(row.channel==="IN_APP"?"DELIVERED":"SENT",attemptId),
      ]);
      delivered++;
    } catch (error) {
      const code = String(
          error instanceof Error ? error.message : "DELIVERY_FAILED",
        ).slice(0, 80),
        delay = Math.min(3600, 30 * 2 ** (attempt - 1)),
        terminal = attempt >= 5;
      await db.batch([
        db
          .prepare(
            "UPDATE alert_deliveries SET status='FAILED',error_code=? WHERE id=?",
          )
          .bind(terminal ? `PERMANENT_${code}` : code, row.id),
        db
          .prepare(
            "UPDATE notification_delivery_attempts SET status='FAILED',provider_code=?,next_retry_at=? WHERE id=?",
          )
          .bind(
            code,
            terminal ? null : new Date(Date.now() + delay * 1000).toISOString(),
            attemptId,
          ),
      ]);
      const fallback = json(row.fallback_json),
        fallbackChannel =
          row.channel === "BROWSER_PUSH" && fallback.pushToEmail
            ? "EMAIL"
            : row.channel === "EMAIL" && fallback.emailToInApp
              ? "IN_APP"
              : null;
      if (terminal && fallbackChannel)
        await db
          .prepare(
            "INSERT INTO alert_deliveries(id,alert_id,user_id,channel,status,available_at) VALUES(?,?,?,?, 'QUEUED',CURRENT_TIMESTAMP) ON CONFLICT(alert_id,user_id,channel) DO NOTHING",
          )
          .bind(
            id("alert_delivery"),
            row.alert_id,
            row.user_id,
            fallbackChannel,
          )
          .run();
      failed++;
    }
  }
  await db.prepare("UPDATE worker_heartbeats SET status=?,metadata_json=metadata_json||?::jsonb,heartbeat_at=CURRENT_TIMESTAMP WHERE worker_name='aws-market-worker'").bind(jobsFailed||failed?"DEGRADED":"IDLE",JSON.stringify({durationMs:Date.now()-startedAt,delivered,deliveryFailures:failed,budgetReached:Date.now()>=deliveryDeadline})).run();
  return Response.json({
    jobs: {
      processed: jobs.results.length,
      completed: jobsCompleted,
      failed: jobsFailed,
    },
    deliveries: { processed: deliveries.results.length, delivered, failed },
  });
}

export async function runNotificationWorker(request:Request,limits={totalMs:22_000,jobMs:12_000}){
  const correlationId=id("worker");
  try{
    await loadRuntimeSecrets();
    if(!process.env.CRON_SECRET||request.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({error:"Unauthorized"},{status:401});
    const db=await database();
    if(!await claimWorker(db,correlationId))return Response.json({status:"ALREADY_RUNNING",correlationId},{status:202});
    try{return await processNotifications(request,limits);}finally{await releaseWorker(db,correlationId);}
  }
  catch(error){const failure=workerFailure(error);console.error("NORTHSTAR_WORKER_FAILED",{correlationId,code:failure.code});return Response.json({error:failure.code,correlationId,retryable:failure.status===503},{status:failure.status,headers:{"X-Correlation-ID":correlationId,...(failure.retryAfter?{"Retry-After":String(failure.retryAfter)}:{})}});}
}
