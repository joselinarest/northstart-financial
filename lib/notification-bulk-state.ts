import type {PostgresDatabase} from '@/lib/db';
export type BulkNotificationAction='CLEAR_ALL'|'CLEAR_READ'|'MARK_ALL_READ';
export async function bulkNotificationState(db:PostgresDatabase,input:{householdId:string;userId:string;action:BulkNotificationAction;category:string|null;critical:boolean;asOf:string}){
 if(!['CLEAR_ALL','CLEAR_READ','MARK_ALL_READ'].includes(input.action)||!Number.isFinite(Date.parse(input.asOf)))throw Error('INVALID_NOTIFICATION_BULK_ACTION');
 const clearing=input.action!=='MARK_ALL_READ';
 const result=await db.prepare(`INSERT INTO notification_event_states(event_id,user_id,read_at,dismissed_at)
 SELECT e.id,?,CURRENT_TIMESTAMP,CASE WHEN ? THEN CURRENT_TIMESTAMP END FROM notification_events e
 LEFT JOIN notification_event_states s ON s.event_id=e.id AND s.user_id=?
 WHERE e.household_id=? AND e.updated_at<=?::timestamptz
 AND (?::text IS NULL OR e.category=?) AND (NOT ? OR e.severity='CRITICAL')
 AND (s.dismissed_at IS NULL OR s.dismissed_at<e.updated_at)
 AND (?<>'CLEAR_READ' OR s.read_at>=e.updated_at)
 AND (?<>'MARK_ALL_READ' OR s.read_at IS NULL OR s.read_at<e.updated_at)
 ON CONFLICT(event_id,user_id) DO UPDATE SET read_at=EXCLUDED.read_at,dismissed_at=CASE WHEN ? THEN EXCLUDED.dismissed_at ELSE notification_event_states.dismissed_at END
 RETURNING event_id`).bind(input.userId,clearing,input.userId,input.householdId,input.asOf,input.category,input.category,input.critical,input.action,input.action,clearing).all();
 if(clearing&&result.results.length)await db.prepare("UPDATE alert_deliveries SET status='DISMISSED',error_code='USER_DISMISSED' WHERE user_id=? AND status IN ('QUEUED','PENDING','FAILED') AND alert_id IN(SELECT alert_id FROM notification_event_updates WHERE event_id IN(SELECT jsonb_array_elements_text(?::jsonb)))").bind(input.userId,JSON.stringify(result.results.map((r:any)=>r.event_id))).run();
 const count=await db.prepare(`SELECT count(*)::int unread FROM notification_events e LEFT JOIN notification_event_states s ON s.event_id=e.id AND s.user_id=? WHERE e.household_id=? AND (s.dismissed_at IS NULL OR s.dismissed_at<e.updated_at) AND (s.read_at IS NULL OR s.read_at<e.updated_at)`).bind(input.userId,input.householdId).first<{unread:number}>();
 return {clearedCount:clearing?result.results.length:0,updatedCount:result.results.length,remainingUnreadCount:Number(count?.unread||0)};
}
