import {createHash} from "node:crypto";
import {id,type PostgresDatabase} from "@/lib/db";
export const NOTIFICATION_CATEGORIES=["Trading Actions","Portfolio","News","Options","Household Finance","Fraud/Security","System"] as const;
export type NotificationCategory=typeof NOTIFICATION_CATEGORIES[number];
export function severity(value:unknown):"CRITICAL"|"HIGH"|"MEDIUM"|"LOW"{const s=String(value).toUpperCase();return ["CRITICAL","ACTION_NOW"].includes(s)?"CRITICAL":["HIGH","IMPORTANT","WARNING"].includes(s)?"HIGH":["MEDIUM","WATCH"].includes(s)?"MEDIUM":"LOW";}
export function category(type:string,title:string):NotificationCategory{const text=type+" "+title;return /fraud|suspicious|security/i.test(text)?"Fraud/Security":/sync|system|provider.*fail/i.test(text)?"System":/option/i.test(text)?"Options":/buy|sell|trim|reentry|rebuy|recommendation|trade_lifecycle|stop|target/i.test(text)?"Trading Actions":/news|earnings|macro|market_intelligence/i.test(text)?"News":/portfolio|concentration|thesis/i.test(text)?"Portfolio":"Household Finance";}
export function quietUntil(quiet:{enabled?:boolean;start?:string;end?:string;criticalBypass?:boolean},timezone:string,level:string,now=new Date()):Date{
  if(!quiet.enabled||(level==="CRITICAL"&&quiet.criticalBypass===true))return now;
  const valid=(v:string|undefined)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v||"");if(!valid(quiet.start)||!valid(quiet.end))return now;
  const minutes=(value:string)=>Number(value.slice(0,2))*60+Number(value.slice(3)),start=minutes(quiet.start!),end=minutes(quiet.end!);
  const inside=(date:Date)=>{const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date),m=Number(parts.find(p=>p.type==="hour")?.value)*60+Number(parts.find(p=>p.type==="minute")?.value);return start<end?m>=start&&m<end:start===end?false:m>=start||m<end;};
  try{if(!inside(now))return now;for(let m=1;m<=1500;m++){const next=new Date(now.getTime()+m*60000);if(!inside(next))return next;}}catch{return new Date(now.getTime()+3600000);}return new Date(now.getTime()+86400000);
}
// Legacy alert payloads are normalized at this boundary; no provider secrets are copied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row=Record<string,any>;
const parse=(v:unknown):Row=>typeof v==="string"?JSON.parse(v):v&&typeof v==="object"?v as Row:{};
export const eventLink=(eventId:string)=>`/workspace/notifications/${encodeURIComponent(eventId)}`;
/** Server-only bridge covers every alert producer, including webhooks and closed-app cron. */
export async function indexNotificationEvents(db:PostgresDatabase){
  const alerts=await db.prepare("SELECT a.* FROM alerts a WHERE NOT EXISTS(SELECT 1 FROM notification_event_updates u WHERE u.alert_id=a.id) ORDER BY a.created_at LIMIT 250").all<Row>();
  for(const alert of alerts.results)await db.transaction(async tx=>{
    // Serialize indexing within a household, including the first event insert.
    await tx.prepare('SELECT id FROM households WHERE id=? FOR UPDATE').bind(alert.household_id).first();
    if(await tx.prepare('SELECT id FROM notification_event_updates WHERE alert_id=?').bind(alert.id).first())return;
    const evidence=parse(alert.evidence_json),accountId=String(evidence.accountId||""),ticker=String(evidence.ticker||evidence.symbol||"");
    const account=accountId?await tx.prepare("SELECT COALESCE(a.nickname,a.name) name,s.strategy_type FROM accounts a JOIN entities e ON e.id=a.entity_id LEFT JOIN investment_account_settings s ON s.account_id=a.id WHERE a.id=? AND e.household_id=?").bind(accountId,alert.household_id).first<Row>():null;
    const linked=evidence.decisionId?await tx.prepare("SELECT id FROM recommendations WHERE household_id=? AND checks_json->\'aiEvidence\'->>\'decisionId\'=? ORDER BY created_at DESC LIMIT 1").bind(alert.household_id,evidence.decisionId).first<{id:string}>():null;
    if(linked)evidence.recommendationId=linked.id;
    const recommendation=evidence.recommendationId?await tx.prepare("SELECT r.* FROM recommendations r WHERE r.id=? AND r.household_id=?").bind(evidence.recommendationId,alert.household_id).first<Row>():null;
    const decision=parse(parse(recommendation?.checks_json).aiEvidence),entry=decision.entryPlan;
    const eventKey=String(evidence.rootEventId||evidence.eventId||evidence.recommendationId||alert.id)+":"+accountId;
    const eventId="event_"+createHash("sha256").update(alert.household_id+":"+eventKey).digest("hex").slice(0,32);
    const actionable=Boolean(recommendation?.actionable&&decision.providerStatus==="AVAILABLE"&&Date.parse(recommendation.expires_at)>Date.now()&&['MONITORING','TRIGGERED'].includes(recommendation.lifecycle)),level=severity(alert.severity),kind=category(String(alert.type),String(alert.title));
    const snapshot={ticker,accountId,account:account?.name||"Household",strategy:account?.strategy_type||null,event:String(alert.title),reason:String(alert.explanation),severity:level,immediateAction:level==="CRITICAL"||actionable,action:actionable?decision.action:"No trade required",shares:actionable?decision.shares:null,currentPrice:evidence.currentPrice??evidence.price??null,trigger:entry?.trigger??decision.trigger??evidence.triggerPrice??null,orderPrice:actionable?entry?.orderPrice??null:null,costProceeds:actionable?decision.expectedCostProceeds:null,stop:decision.stop??null,targets:decision.targets||[],confidence:decision.confidence??null,entryPlan:entry||null,evidence:{technical:evidence.technical||null,fundamental:evidence.fundamental||null,news:evidence.news||null,providerFacts:decision.providerFacts||[]},cancelConditions:entry?.cancelConditions||decision.whatWouldChange||["Recheck current evidence before any action"],previousRecommendation:evidence.previousRecommendation||null,currentRecommendation:decision.action||null,recommendationId:recommendation?.id||null,source:evidence.source||alert.type,dataTimestamp:decision.dataTimestamp||evidence.asOf||alert.created_at,freshness:decision.dataTimestamp?"Check current recommendation before acting":"Timestamp from event; current market data unverified",timestamp:alert.created_at};
    const summary=[ticker||"Northstar",snapshot.account,snapshot.action,snapshot.trigger!=null?`Trigger $${snapshot.trigger}`:"",level,snapshot.reason,String(snapshot.timestamp),snapshot.immediateAction?"Review now":"No immediate action"].filter(Boolean).join(" — ");
    const previous=await tx.prepare("SELECT snapshot_json FROM notification_events WHERE id=? FOR UPDATE").bind(eventId).first<{snapshot_json:Row}>();
    const fingerprint=(v:Row)=>JSON.stringify([v.event,v.reason,v.severity,v.action,v.trigger,v.orderPrice,v.shares,v.currentRecommendation]);
    const duplicate=previous&&fingerprint(parse(previous.snapshot_json))===fingerprint(snapshot);
    if(duplicate){
      await tx.prepare("INSERT INTO notification_event_updates(id,event_id,alert_id,snapshot_json) VALUES(?,?,?,?) ON CONFLICT(alert_id) DO NOTHING").bind(id("event_update"),eventId,alert.id,JSON.stringify({...snapshot,duplicateSuppressed:true})).run();
      await tx.prepare("UPDATE alert_deliveries SET status='DISMISSED',error_code='DUPLICATE_EVENT' WHERE alert_id=? AND status IN ('QUEUED','PENDING','FAILED')").bind(alert.id).run();return;
    }
    await tx.prepare("INSERT INTO notification_events(id,household_id,event_key,category,severity,title,summary,snapshot_json) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(household_id,event_key) DO UPDATE SET severity=EXCLUDED.severity,title=EXCLUDED.title,summary=EXCLUDED.summary,snapshot_json=EXCLUDED.snapshot_json,updated_at=CURRENT_TIMESTAMP").bind(eventId,alert.household_id,eventKey,kind,level,alert.title,summary,JSON.stringify(snapshot)).run();
    await tx.prepare("INSERT INTO notification_event_updates(id,event_id,alert_id,snapshot_json) VALUES(?,?,?,?) ON CONFLICT(alert_id) DO NOTHING").bind(id("event_update"),eventId,alert.id,JSON.stringify(snapshot)).run();
    if(alert.dismissed_at)await tx.prepare("INSERT INTO notification_event_states(event_id,user_id,read_at,dismissed_at) SELECT ?,user_id,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM household_members WHERE household_id=? AND status='active' ON CONFLICT(event_id,user_id) DO UPDATE SET dismissed_at=COALESCE(notification_event_states.dismissed_at,EXCLUDED.dismissed_at)").bind(eventId,alert.household_id).run();
    // All events stay discoverable even if push is denied or delivery fails.
    const recipients=await tx.prepare("SELECT hm.user_id,np.browser_push_enabled,np.email_enabled FROM household_members hm LEFT JOIN notification_preferences np ON np.household_id=hm.household_id AND np.user_id=hm.user_id WHERE hm.household_id=? AND hm.status='active' AND NOT EXISTS(SELECT 1 FROM notification_event_states ns JOIN notification_events ne ON ne.id=ns.event_id WHERE ns.event_id=? AND ns.user_id=hm.user_id AND ns.dismissed_at>=ne.updated_at)").bind(alert.household_id,eventId).all<Row>();
    for(const r of recipients.results)for(const channel of ["IN_APP",...(r.browser_push_enabled?["BROWSER_PUSH"]:[]),...(r.email_enabled?["EMAIL"]:[])])await tx.prepare("INSERT INTO alert_deliveries(id,alert_id,user_id,channel,status,available_at) VALUES(?,?,?,?, 'QUEUED',CURRENT_TIMESTAMP) ON CONFLICT(alert_id,user_id,channel) DO NOTHING").bind(id("event_delivery"),alert.id,r.user_id,channel).run();
  });
  return alerts.results.length;
}
