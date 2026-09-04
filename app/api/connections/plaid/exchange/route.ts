import {workspace,id,roleCanConnectAccounts} from "@/lib/db";
import {encryptSecret} from "@/lib/crypto";

export async function POST(r:Request){
 try{
  const {db,householdId,userId,role}=await workspace(r),b=await r.json() as {publicToken?:string;institutionName?:string};
  if(!roleCanConnectAccounts(role))return Response.json({error:"Your household role does not allow linking financial institutions"},{status:403});
  if(!b.publicToken)return Response.json({error:"publicToken required"},{status:400});
  if(!process.env.PLAID_CLIENT_ID||!process.env.PLAID_SECRET)return Response.json({error:"Plaid credentials are not configured"},{status:503});
  const host=process.env.PLAID_ENV==="production"?"https://production.plaid.com":process.env.PLAID_ENV==="development"?"https://development.plaid.com":"https://sandbox.plaid.com";
  const response=await fetch(`${host}/item/public_token/exchange`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:process.env.PLAID_CLIENT_ID,secret:process.env.PLAID_SECRET,public_token:b.publicToken})}),text=await response.text();
  if(!response.ok){let message=`Plaid token exchange failed (${response.status})`;try{const details=JSON.parse(text) as {error_message?:string;error_code?:string};message=details.error_message||details.error_code||message}catch{}return Response.json({error:message},{status:response.status})}
  const data=JSON.parse(text) as {access_token:string;item_id:string},connectionId=id("conn");
  await db.prepare("INSERT INTO connections(id,household_id,provider,institution_name,status,encrypted_access_token,connected_by_user_id) VALUES(?,?,?,?,?,?,?)").bind(connectionId,householdId,"plaid",b.institutionName||"Connected institution","active",await encryptSecret(data.access_token),userId).run();
  return Response.json({id:connectionId,status:"connected"},{status:201});
 }catch(e){if(e instanceof Response)return e;console.error("Plaid exchange failed",e);return Response.json({error:e instanceof Error?e.message:"Unable to secure the Plaid connection"},{status:500})}
}
