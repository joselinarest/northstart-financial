import {workspace} from '@/lib/db';
import {analyzeAndStoreOptions} from '@/lib/options-analysis';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const {db,householdId}=await workspace(request);return await analyzeAndStoreOptions(db,householdId,await request.json());}catch(e){if(e instanceof Response)return e;return Response.json({error:'Options analysis unavailable'},{status:503});}}
