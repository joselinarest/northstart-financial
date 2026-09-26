import {workspace} from '@/lib/db';
import {queueOptionResearch} from '@/lib/options-research-queue';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const {db,householdId}=await workspace(request),body=await request.json();const symbol=String(body.symbol||'').toUpperCase();if(!/^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol))return Response.json({error:'Valid ticker required'},{status:400});return Response.json(await queueOptionResearch(db,householdId,String(body.accountId||''),symbol,true),{status:202});}catch(e){if(e instanceof Response)return e;return Response.json({error:'Could not queue option research'},{status:503});}}
