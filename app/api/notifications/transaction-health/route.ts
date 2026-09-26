import {workspace} from '@/lib/db';
import {transactionPipelineHealth} from '@/lib/transaction-pipeline-health';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const {db,householdId,userId}=await workspace(request);return Response.json(await transactionPipelineHealth(db,householdId,userId),{headers:{'Cache-Control':'private, no-store'}});}catch(e){if(e instanceof Response)return e;return Response.json({error:'Transaction notification diagnostics unavailable'},{status:503});}}
