import {workspace} from '@/lib/db';
import {rotationView} from '@/lib/capital-rotation-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const{db,householdId}=await workspace(request),accountId=new URL(request.url).searchParams.get('accountId')||'';if(!accountId)return Response.json({error:'Account required'},{status:400});return Response.json({reviews:await rotationView(db,householdId,accountId)},{headers:{'Cache-Control':'private, no-store'}})}catch(error){if(error instanceof Response)return error;return Response.json({error:'Rotation review unavailable'},{status:503})}}
