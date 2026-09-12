import {id,type PostgresDatabase} from "@/lib/db";

export type TransactionEventType="IMPORTED"|"UPDATED"|"PENDING_POSTED"|"RECURRING_IDENTIFIED"|"SUSPICIOUS"|"REMOVED";
export type TransactionNotificationInput={
 householdId:string;accountId:string;transactionId:string;providerTransactionId?:string|null;
 eventType:TransactionEventType;institution?:string|null;accountName:string;mask?:string|null;
 merchant?:string|null;description:string;amountCents:number;currency?:string;postedAt:string;
 category?:string|null;direction:"inflow"|"outflow";pending:boolean;previousPending?:boolean|null;
 recurring?:boolean;riskScore?:number;riskReasons?:string[];foreign?:boolean;
};

const parse=(value:unknown)=>{if(!value)return{};if(typeof value==="object")return value as Record<string,any>;try{return JSON.parse(String(value)) as Record<string,any>}catch{return{}}};
const money=(cents:number,currency:string)=>new Intl.NumberFormat("en-US",{style:"currency",currency}).format(Math.abs(cents)/100);

export async function enqueueTransactionNotification(db:PostgresDatabase,input:TransactionNotificationInput){
 const fingerprint=[input.providerTransactionId||input.transactionId,input.eventType,input.amountCents,input.pending,input.category||"",input.postedAt].join(":");
 const eventId=id("txn_notice"),severity=input.eventType==="SUSPICIOUS"?(Number(input.riskScore||0)>=70?"CRITICAL":"WARNING"):input.eventType==="PENDING_POSTED"?"WATCH":"INFO";
 const snapshot={institution:input.institution||"Financial institution",accountName:input.accountName,mask:input.mask||null,merchant:input.merchant||input.description,amountCents:input.amountCents,currency:input.currency||"USD",postedAt:input.postedAt,category:input.category||"Uncategorized",direction:input.direction,pending:input.pending,recurring:Boolean(input.recurring),riskScore:input.riskScore||0,riskReasons:input.riskReasons||[],deepLink:`/workspace/accounts/${encodeURIComponent(input.accountId)}/transactions?transactionId=${encodeURIComponent(input.transactionId)}`};
 const inserted=await db.prepare("INSERT INTO transaction_notification_events(id,household_id,account_id,transaction_id,event_type,idempotency_key,severity,snapshot_json) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id").bind(eventId,input.householdId,input.accountId,input.transactionId,input.eventType,fingerprint,severity,JSON.stringify(snapshot)).first<{id:string}>();
 if(!inserted)return{queued:0,duplicate:true};
 const merchant=String(snapshot.merchant),account=`${input.institution||"Account"}${input.mask?` •••• ${input.mask}`:""}`,amount=money(input.amountCents,input.currency||"USD");
 const title=input.eventType==="SUSPICIOUS"?"Possible suspicious transaction detected":`${account} — ${amount} at ${merchant}`;
 const explanation=input.eventType==="SUSPICIOUS"?`${account} · ${amount} · ${snapshot.category}. ${input.riskReasons?.join("; ")||"This activity differs from expected account behavior."}`:`${snapshot.category} · ${input.pending?"Pending":"Posted"}${input.eventType==="PENDING_POSTED"?" · previously pending":""}`;
 const alertId=`alert_${eventId}`;
 await db.prepare("INSERT INTO alerts(id,household_id,severity,type,title,explanation,evidence_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(alertId,input.householdId,severity.toLowerCase(),"transaction",title,explanation,JSON.stringify({...snapshot,eventId,eventType:input.eventType})).run();
 const recipients=await db.prepare(`SELECT hm.user_id,u.email,np.in_app_enabled,np.browser_push_enabled,np.email_enabled,np.transaction_mode,np.minimum_amount_cents,np.transaction_filters_json,ap.enabled account_enabled,ap.transaction_mode account_mode,ap.channels_json,ap.minimum_amount_cents account_minimum,ap.filters_json account_filters FROM household_members hm JOIN users u ON u.id=hm.user_id LEFT JOIN notification_preferences np ON np.household_id=hm.household_id AND np.user_id=hm.user_id LEFT JOIN account_notification_preferences ap ON ap.household_id=hm.household_id AND ap.user_id=hm.user_id AND ap.account_id=? WHERE hm.household_id=? AND hm.status='active'`).bind(input.accountId,input.householdId).all<Record<string,any>>();
 let queued=0;
 for(const recipient of recipients.results){
  if(recipient.account_enabled===false)continue;
  const mode=recipient.account_mode&&recipient.account_mode!=="INHERIT"?recipient.account_mode:(recipient.transaction_mode||"MATERIAL");
  if(mode==="OFF")continue;
  const filters={...parse(recipient.transaction_filters_json),...parse(recipient.account_filters)};
  const minimum=Number(recipient.account_minimum??recipient.minimum_amount_cents??0);
  const suspicious=input.eventType==="SUSPICIOUS";
  const everyTransaction=mode==="EVERY_TRANSACTION";
  if(!everyTransaction&&!suspicious&&Math.abs(input.amountCents)<minimum)continue;
  if(!everyTransaction&&!suspicious&&filters.expensesOnly&&input.direction!=="outflow")continue;
  if(!everyTransaction&&!suspicious&&filters.depositsOnly&&input.direction!=="inflow")continue;
  if(!everyTransaction&&!suspicious&&filters.foreignOnly&&!input.foreign)continue;
  if(!everyTransaction&&!suspicious&&filters.suspiciousOnly)continue;
  const overrides=parse(recipient.channels_json),channels=[recipient.in_app_enabled!==false&&overrides.inApp!==false?"IN_APP":null,(overrides.push??recipient.browser_push_enabled)?"BROWSER_PUSH":null,(overrides.email??recipient.email_enabled)?"EMAIL":null].filter(Boolean) as string[];
  for(const channel of channels){await db.prepare("INSERT INTO alert_deliveries(id,alert_id,user_id,channel,status) VALUES(?,?,?,?, 'QUEUED') ON CONFLICT(alert_id,user_id,channel) DO NOTHING").bind(id("alert_delivery"),alertId,recipient.user_id,channel).run();queued++}
 }
 return{queued,duplicate:false,eventId,alertId};
}
