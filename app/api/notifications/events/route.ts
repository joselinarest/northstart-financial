import {workspace} from "@/lib/db";
import {NOTIFICATION_CATEGORIES} from "@/lib/notification-events";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{
  const {db,householdId,userId}=await workspace(request),url=new URL(request.url),eventId=url.searchParams.get("id");
  const events=await db.prepare("SELECT e.*,s.read_at,s.dismissed_at,(s.read_at IS NULL OR s.read_at<e.updated_at) unread FROM notification_events e LEFT JOIN notification_event_states s ON s.event_id=e.id AND s.user_id=? WHERE e.household_id=? AND (?::text IS NULL OR e.id=?) ORDER BY e.updated_at DESC LIMIT 100").bind(userId,householdId,eventId,eventId).all();
  if(eventId&&!events.results.length)return Response.json({error:"Event not found"},{status:404});
  const timeline=eventId?(await db.prepare("SELECT u.snapshot_json,u.created_at FROM notification_event_updates u JOIN notification_events e ON e.id=u.event_id WHERE u.event_id=? AND e.household_id=? ORDER BY u.created_at").bind(eventId,householdId).all()).results:[];
  const preferences=(await db.prepare("SELECT category,in_app,push,email FROM notification_category_preferences WHERE household_id=? AND user_id=?").bind(householdId,userId).all()).results;
  const deliveries=eventId?(await db.prepare("SELECT d.channel,d.status,d.error_code,d.attempted_at,d.delivered_at FROM alert_deliveries d JOIN notification_event_updates u ON u.alert_id=d.alert_id WHERE u.event_id=? AND d.user_id=?").bind(eventId,userId).all()).results:[];
  return Response.json({events:events.results,timeline,deliveries,preferences,categories:NOTIFICATION_CATEGORIES},{headers:{"Cache-Control":"private, no-store"}});
}catch(e){if(e instanceof Response)return e;return Response.json({error:"Notification events unavailable",referenceId:crypto.randomUUID()},{status:503});}}
export async function PATCH(request:Request){try{
  const {db,householdId,userId}=await workspace(request),body=await request.json() as Record<string,unknown>;
  if(body.category){
    if(!NOTIFICATION_CATEGORIES.includes(body.category as typeof NOTIFICATION_CATEGORIES[number])||![body.inApp,body.push,body.email].every(v=>typeof v==="boolean"))return Response.json({error:"Valid category and channel booleans required"},{status:400});
    await db.prepare("INSERT INTO notification_category_preferences(household_id,user_id,category,in_app,push,email) VALUES(?,?,?,?,?,?) ON CONFLICT(household_id,user_id,category) DO UPDATE SET in_app=EXCLUDED.in_app,push=EXCLUDED.push,email=EXCLUDED.email").bind(householdId,userId,body.category,body.inApp,body.push,body.email).run();return Response.json({ok:true});
  }
  if(typeof body.eventId!=="string"||!["READ","DISMISSED"].includes(String(body.action)))return Response.json({error:"eventId and READ/DISMISSED required"},{status:400});
  const owned=await db.prepare("SELECT id FROM notification_events WHERE id=? AND household_id=?").bind(body.eventId,householdId).first();if(!owned)return Response.json({error:"Event not found"},{status:404});
  await db.transaction(async tx=>{
    await tx.prepare("INSERT INTO notification_event_states(event_id,user_id,read_at,dismissed_at) VALUES(?,?,CURRENT_TIMESTAMP,CASE WHEN ? THEN CURRENT_TIMESTAMP END) ON CONFLICT(event_id,user_id) DO UPDATE SET read_at=CURRENT_TIMESTAMP,dismissed_at=COALESCE(EXCLUDED.dismissed_at,notification_event_states.dismissed_at)").bind(body.eventId,userId,body.action==="DISMISSED").run();
    await tx.prepare("UPDATE alert_deliveries SET status=? WHERE user_id=? AND alert_id IN(SELECT alert_id FROM notification_event_updates WHERE event_id=?)").bind(body.action,userId,body.eventId).run();
  });return Response.json({ok:true});
}catch(e){if(e instanceof Response)return e;return Response.json({error:"Notification state could not be saved"},{status:503});}}
