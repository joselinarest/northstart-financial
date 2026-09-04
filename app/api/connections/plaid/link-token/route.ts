import {roleCanConnectAccounts,workspace} from "@/lib/db";
const validProducts=new Set(["auth","transactions","identity","investments","liabilities","assets","income_verification","payment_initiation","identity_verification","signal"]);
export async function POST(r:Request){
 try{
  const {userId,role}=await workspace(r);
  if(!roleCanConnectAccounts(role))return Response.json({error:"Your household role does not allow linking financial institutions"},{status:403});
  if(!process.env.PLAID_CLIENT_ID||!process.env.PLAID_SECRET)return Response.json({error:"Plaid credentials are not configured"},{status:503});
  const host=process.env.PLAID_ENV==="production"?"https://production.plaid.com":process.env.PLAID_ENV==="development"?"https://development.plaid.com":"https://sandbox.plaid.com",configured=(process.env.PLAID_PRODUCTS||"transactions").split(",").map(value=>value.trim()).filter(Boolean),products=[...new Set(configured.map(value=>value==="recurring_transactions"?"transactions":value).filter(value=>validProducts.has(value)))];
  if(!products.length)products.push("transactions");
  const redirectUri=process.env.PLAID_REDIRECT_URI?.trim();
  if(process.env.PLAID_ENV==="production"&&redirectUri&&!redirectUri.startsWith("https://"))return Response.json({error:"PLAID_REDIRECT_URI must use HTTPS in Production."},{status:503});
  const response=await fetch(`${host}/link/token/create`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:process.env.PLAID_CLIENT_ID,secret:process.env.PLAID_SECRET,client_name:"Northstar",language:"en",country_codes:(process.env.PLAID_COUNTRY_CODES||"US").split(",").map(value=>value.trim()),products,user:{client_user_id:userId},webhook:process.env.PLAID_WEBHOOK_URL||undefined,redirect_uri:redirectUri||undefined})}),text=await response.text();
  if(response.ok)return new Response(text,{status:response.status,headers:{"Content-Type":"application/json"}});
  let plaidError:Record<string,unknown>;try{plaidError=JSON.parse(text)}catch{plaidError={error_message:"Plaid returned an unreadable error response"}};
  return Response.json({...plaidError,northstar_configuration:{environment:process.env.PLAID_ENV||"sandbox",redirect_uri:redirectUri||null}},{status:response.status});
 }catch(e){if(e instanceof Response)return e;const message=e instanceof Error?e.message:"Plaid Link configuration failed",configuration=/DATABASE_URL|required|not configured|missing|encryption/i.test(message);return Response.json({error:configuration?message:"Plaid Link could not be created. Review the server log and Plaid environment configuration.",code:configuration?"SERVER_CONFIGURATION":"PLAID_LINK_ERROR"},{status:configuration?503:500})}
}
