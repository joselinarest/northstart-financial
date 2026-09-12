import {roleCanConnectAccounts,workspace} from "@/lib/db";
const validProducts=new Set(["auth","transactions","identity","investments","liabilities","assets","income_verification","payment_initiation","identity_verification","signal"]);
export async function POST(r:Request){
 try{
  const {userId,role}=await workspace(r);
  if(!roleCanConnectAccounts(role))return Response.json({error:"Your household role does not allow linking financial institutions"},{status:403});
  if(!process.env.PLAID_CLIENT_ID||!process.env.PLAID_SECRET)return Response.json({error:"Plaid credentials are not configured"},{status:503});
  const host=process.env.PLAID_ENV==="production"?"https://production.plaid.com":process.env.PLAID_ENV==="development"?"https://development.plaid.com":"https://sandbox.plaid.com",configured=[...new Set((process.env.PLAID_PRODUCTS||"transactions").split(",").map(value=>value.trim()).filter(value=>validProducts.has(value)))],primaryProduct=configured.includes("transactions")?"transactions":configured[0]||"transactions",products=[primaryProduct],optionalProducts=configured.filter(value=>value!==primaryProduct&&["auth","identity","liabilities","signal"].includes(value));
  const redirectUri=process.env.PLAID_REDIRECT_URI?.trim();
  if(process.env.PLAID_ENV==="production"&&!redirectUri)return Response.json({error:"PLAID_REDIRECT_URI is required for OAuth institutions such as Chase."},{status:503});
  if(process.env.PLAID_ENV==="production"&&redirectUri&&!redirectUri.startsWith("https://"))return Response.json({error:"PLAID_REDIRECT_URI must use HTTPS in Production."},{status:503});
  const response=await fetch(`${host}/link/token/create`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:process.env.PLAID_CLIENT_ID,secret:process.env.PLAID_SECRET,client_name:"Northstar",language:"en",country_codes:(process.env.PLAID_COUNTRY_CODES||"US").split(",").map(value=>value.trim()),products,optional_products:optionalProducts.length?optionalProducts:undefined,user:{client_user_id:userId},webhook:process.env.PLAID_WEBHOOK_URL||undefined,redirect_uri:redirectUri||undefined}),signal:AbortSignal.timeout(12_000)}),text=await response.text();
  if(response.ok)return new Response(text,{status:response.status,headers:{"Content-Type":"application/json"}});
  let plaidError:Record<string,unknown>;try{plaidError=JSON.parse(text)}catch{plaidError={error_message:"Plaid returned an unreadable error response"}};
  return Response.json({...plaidError,northstar_configuration:{environment:process.env.PLAID_ENV||"sandbox",redirect_uri:redirectUri||null}},{status:response.status});
 }catch(e){
  if(e instanceof Response)return e;
  const message=e instanceof Error?e.message:"Plaid Link configuration failed",capacity=/remaining connection slots|too many clients|53300/i.test(message),timeout=e instanceof DOMException&&e.name==="TimeoutError",configuration=/DATABASE_URL|required|not configured|missing|encryption|secret/i.test(message);
  const code=capacity?"DATABASE_CAPACITY":timeout?"PLAID_TIMEOUT":configuration?"SERVER_CONFIGURATION":"PLAID_LINK_ERROR",status=capacity||timeout||configuration?503:502;
  console.error("Plaid link-token creation failed",{code,message});
  return Response.json({error:capacity?"The household database is at capacity. Retry in a moment.":timeout?"Plaid did not respond before the secure request timed out. Retry the connection.":configuration?message:"The secure Plaid request could not reach the provider. Retry shortly; if it continues, review the Amplify server log.",code,retryable:capacity||timeout||!configuration},{status,headers:{"Cache-Control":"no-store"}})
 }
}
