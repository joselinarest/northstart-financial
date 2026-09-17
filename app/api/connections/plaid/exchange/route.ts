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
  if(!response.ok){let message=`Plaid token exchange failed (${response.status})`,code="TOKEN_EXCHANGE_FAILED",type="API_ERROR",providerRequestId="";try{const details=JSON.parse(text) as {error_message?:string;error_code?:string;error_type?:string;request_id?:string};message=details.error_message||details.error_code||message;code=details.error_code||code;type=details.error_type||type;providerRequestId=details.request_id||""}catch{}const referenceId=`plaid_issue_${crypto.randomUUID()}`,institution=b.institutionName||"Investment institution",metadata={referenceId,stage:"TOKEN_EXCHANGE",institution,code,type,message:String(message).slice(0,300),providerRequestId:providerRequestId||null,occurredAt:new Date().toISOString()};await db.prepare("INSERT INTO audit_log(id,household_id,user_id,action,target_type,target_id,metadata_json) VALUES(?,?,?,?,?,?,?::jsonb)").bind(`audit_${crypto.randomUUID()}`,householdId,userId,"plaid_connection_issue","plaid_connection",referenceId,JSON.stringify(metadata)).run();console.error("PLAID_TOKEN_EXCHANGE_FAILED",metadata);return Response.json({error:`Plaid could not secure the ${institution} connection. Retry with a new Link session.`,code,type,referenceId,institution},{status:response.status})}
  const data=JSON.parse(text) as {access_token:string;item_id:string},connectionId=id("conn");
  await db.prepare("INSERT INTO connections(id,household_id,provider,institution_name,status,encrypted_access_token,connected_by_user_id,provider_item_id) VALUES(?,?,?,?,?,?,?,?)").bind(connectionId,householdId,"plaid",b.institutionName||"Connected institution","active",await encryptSecret(data.access_token),userId,data.item_id).run();
  return Response.json({id:connectionId,status:"connected"},{status:201});
 }catch(e){if(e instanceof Response)return e;const referenceId=`plaid_exchange_${crypto.randomUUID()}`;console.error("PLAID_EXCHANGE_FAILED",{referenceId,error:e,occurredAt:new Date().toISOString()});return Response.json({error:`The Plaid connection could not be secured. Reference ${referenceId}.`,referenceId},{status:500})}
}
