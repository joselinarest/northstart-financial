import {workspace} from '@/lib/db';
import {academyDashboard,startAcademy,answerAcademy} from '@/lib/academy-service';
export const dynamic='force-dynamic';
export async function GET(r:Request){try{const {db,householdId,userId,role}=await workspace(r);return Response.json(await academyDashboard(db,householdId,userId,!["student","account_connector"].includes(role)));}catch(e){if(e instanceof Response)return e;console.error('Academy dashboard unavailable');return Response.json({error:'No se pudo cargar el progreso. Reintenta.'},{status:503});}}
export async function POST(r:Request){try{const {db,householdId,userId,role}=await workspace(r),b=await r.json();
 if(b.source==='trade'&&['student','account_connector'].includes(role))return Response.json({error:'Tu rol permite práctica educativa, no acceso a operaciones del hogar.'},{status:403});
 if(b.action==='answer')return Response.json(await answerAcademy(db,householdId,userId,String(b.sessionId),b.value));
 if(b.action==='settings'){const threshold=Number(b.threshold);if(!Number.isInteger(threshold)||threshold<60||threshold>100)throw Error('El umbral debe estar entre 60 y 100.');await db.prepare('INSERT INTO academy_preferences(household_id,user_id,mastery_threshold) VALUES(?,?,?) ON CONFLICT(household_id,user_id) DO UPDATE SET mastery_threshold=EXCLUDED.mastery_threshold').bind(householdId,userId,threshold).run();return Response.json({saved:true});}
 return Response.json(await startAcademy(db,householdId,userId,b));
 }catch(e){if(e instanceof Response)return e;return Response.json({error:e instanceof Error&&!/sql|relation|connect|password|timeout/i.test(e.message)?e.message:'No se pudo guardar. Reintenta; tu respuesta no se pierde.'},{status:400});}}
