import {workspace} from '@/lib/db';
import {GET as getEvents,PATCH as updateEvents} from '@/app/api/notifications/events/route';
export const dynamic='force-dynamic';
// Compatibility endpoint: older header/settings clients share the canonical user event state.
export async function GET(request:Request){
 const response=await getEvents(request);if(!response.ok)return response;
 const data=await response.json();const unread=new URL(request.url).searchParams.get('unread')!=='false';
 const levels:Record<string,string>={CRITICAL:'action_now',HIGH:'important',MEDIUM:'watch',LOW:'informational'};
 return Response.json({alerts:data.events.filter((e:any)=>!unread||e.unread).map((e:any)=>({id:e.id,severity:levels[e.severity]||'informational',type:e.category,title:e.title,explanation:e.summary,read_at:e.unread?null:e.read_at,created_at:e.updated_at,evidence_json:{...e.snapshot_json,symbol:e.snapshot_json.ticker,accountName:e.snapshot_json.account,deepLink:`/workspace/notifications/${encodeURIComponent(e.id)}`}})),unreadCount:data.unreadCount,asOf:data.asOf},{headers:{'Cache-Control':'private, no-store'}});
}
export async function PATCH(request:Request){try{
 const {db,householdId}=await workspace(request),body=await request.json();
 let eventId=body.id;
 if(!body.clearAll){if(typeof eventId!=='string')return Response.json({error:'Alert id is required'},{status:400});
 const found=await db.prepare('SELECT e.id FROM notification_events e WHERE e.household_id=? AND (e.id=? OR EXISTS(SELECT 1 FROM notification_event_updates u WHERE u.event_id=e.id AND u.alert_id=?))').bind(householdId,eventId,eventId).first<{id:string}>();
 if(!found)return Response.json({error:'Event is not available yet; refresh after server indexing.'},{status:404});eventId=found.id;}
 const payload=body.clearAll?{action:'CLEAR_ALL',asOf:new Date().toISOString()}:{eventId,action:body.dismiss?'DISMISSED':body.read===false?'UNREAD':'READ'};
 return updateEvents(new Request(request.url,{method:'PATCH',headers:request.headers,body:JSON.stringify(payload)}));
 }catch(e){if(e instanceof Response)return e;return Response.json({error:'Notification state could not be saved'},{status:503});}}
