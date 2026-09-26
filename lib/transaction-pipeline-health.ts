import type {PostgresDatabase} from '@/lib/db';
export async function transactionPipelineHealth(db:PostgresDatabase,householdId:string,userId:string){
 const connections=(await db.prepare(`SELECT c.id,c.institution_name,c.last_synced_at,c.status,c.error_code,
 (SELECT w.processing_error FROM plaid_webhook_events w WHERE w.item_id=c.provider_item_id ORDER BY w.received_at DESC LIMIT 1) webhook_error,
 (SELECT j.error_code FROM background_jobs j WHERE j.household_id=c.household_id AND j.payload_json->>'connectionId'=c.id AND j.job_type='PLAID_SYNC' ORDER BY j.updated_at DESC LIMIT 1) sync_error,
 (SELECT max(w.received_at) FROM plaid_webhook_events w WHERE w.item_id=c.provider_item_id) last_webhook,
 (SELECT max(w.processed_at) FROM plaid_webhook_events w WHERE w.item_id=c.provider_item_id) last_webhook_processed,
 (SELECT count(*)::int FROM background_jobs j WHERE j.household_id=c.household_id AND j.payload_json->>'connectionId'=c.id AND j.job_type='PLAID_SYNC' AND j.status IN ('QUEUED','RUNNING','FAILED')) sync_pending
 FROM connections c WHERE c.household_id=? AND c.provider='plaid'`).bind(householdId).all()).results;
 const devices=(await db.prepare('SELECT id,device_name,platform,active,updated_at FROM push_subscriptions WHERE household_id=? AND user_id=?').bind(householdId,userId).all()).results;
 const transactions=(await db.prepare(`SELECT t.id,t.merchant,t.description,t.posted_at,t.updated_at,t.category,t.pending,a.name account_name,
 e.id event_id,e.event_type,e.created_at event_created_at,au.reason rule_reason,au.channels_json,au.available_at,
 (SELECT jsonb_agg(jsonb_build_object('channel',d.channel,'status',d.status,'error',d.error_code,'availableAt',d.available_at,'attemptedAt',d.attempted_at,'deliveredAt',d.delivered_at,'attempts',(SELECT count(*) FROM notification_delivery_attempts n WHERE n.delivery_id=d.id),'nextRetryAt',(SELECT n.next_retry_at FROM notification_delivery_attempts n WHERE n.delivery_id=d.id ORDER BY n.attempt_number DESC LIMIT 1),'providerCode',(SELECT n.provider_code FROM notification_delivery_attempts n WHERE n.delivery_id=d.id ORDER BY n.attempt_number DESC LIMIT 1))) FROM alert_deliveries d WHERE d.alert_id='alert_'||e.id AND d.user_id=?) deliveries,
 EXISTS(SELECT 1 FROM notification_event_updates eu WHERE eu.alert_id='alert_'||e.id) in_app_persisted
 FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN entities en ON en.id=a.entity_id
 LEFT JOIN LATERAL (SELECT * FROM transaction_notification_events n WHERE n.transaction_id=t.id ORDER BY n.created_at DESC LIMIT 1) e ON TRUE
 LEFT JOIN transaction_notification_audit au ON au.event_id=e.id AND au.user_id=?
 WHERE en.household_id=? ORDER BY t.updated_at DESC LIMIT 60`).bind(userId,userId,householdId).all()).results;
 return {connections,devices,transactions,checkedAt:new Date().toISOString(),pushConfigured:Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY)};
}
