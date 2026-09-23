import {workspace} from "@/lib/db";
import {lifecycleAccountView} from "@/lib/trade-lifecycle-service";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{
    const {db,householdId}=await workspace(request),accountId=new URL(request.url).searchParams.get("accountId");
    if(!accountId)return Response.json({error:"Select an investment account"},{status:400});
    const account=await db.prepare("SELECT a.id FROM accounts a JOIN entities e ON e.id=a.entity_id WHERE a.id=? AND e.household_id=?").bind(accountId,householdId).first();
    if(!account)return Response.json({error:"Investment account not found"},{status:404});
    return Response.json(await lifecycleAccountView(db,householdId,accountId),{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Lifecycle unavailable"},{status:500});}
}
