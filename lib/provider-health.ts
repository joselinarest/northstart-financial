import {loadRuntimeSecrets} from "@/lib/runtime-secrets";
export const PROVIDERS=["Plaid Banking","Plaid Investments","Market Data","Fundamentals","News","Options","Options Flow","AI","Push","Email"] as const;
export type Provider=typeof PROVIDERS[number];
export async function providerConfiguration(){await loadRuntimeSecrets();const has=(...keys:string[])=>keys.every(k=>Boolean(process.env[k]));return {"Plaid Banking":has("PLAID_CLIENT_ID","PLAID_SECRET"),"Plaid Investments":has("PLAID_CLIENT_ID","PLAID_SECRET"),"Market Data":has("ALPACA_API_KEY","ALPACA_API_SECRET"),Fundamentals:has("FINNHUB_API_KEY"),News:has("FINNHUB_API_KEY"),Options:has("ALPACA_API_KEY","ALPACA_API_SECRET"),"Options Flow":has("OPTIONS_FLOW_PROVIDER_URL","OPTIONS_FLOW_PROVIDER_TOKEN"),AI:has("OPENAI_API_KEY"),Push:has("VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY"),Email:has("RESEND_API_KEY","EMAIL_FROM")};}
export async function testProvider(provider:Provider){
  const config=await providerConfiguration();if(!config[provider])return {status:"NOT CONFIGURED",error:"Required server configuration is missing"};
  const alpaca={"APCA-API-KEY-ID":process.env.ALPACA_API_KEY!,"APCA-API-SECRET-KEY":process.env.ALPACA_API_SECRET!};
  let response:Response;
  if(provider==="Market Data")response=await fetch((process.env.ALPACA_CLOCK_BASE_URL||"https://paper-api.alpaca.markets").replace(/\/$/,"")+"/v2/clock",{headers:alpaca,signal:AbortSignal.timeout(10000)});
  else if(provider==="Options")response=await fetch("https://data.alpaca.markets/v1beta1/options/snapshots/SPY?limit=1&feed="+encodeURIComponent(process.env.ALPACA_OPTIONS_FEED||"indicative"),{headers:alpaca,signal:AbortSignal.timeout(10000)});
  else if(provider==="Fundamentals"||provider==="News")response=await fetch("https://finnhub.io/api/v1/"+(provider==="News"?"news?category=general":"stock/profile2?symbol=SPY"),{headers:{"X-Finnhub-Token":process.env.FINNHUB_API_KEY!},signal:AbortSignal.timeout(10000)});
  else if(provider==="AI")response=await fetch("https://api.openai.com/v1/models",{headers:{Authorization:"Bearer "+process.env.OPENAI_API_KEY},signal:AbortSignal.timeout(10000)});
  else if(provider.startsWith("Plaid")){const env=process.env.PLAID_ENV;if(!["sandbox","production"].includes(env||""))return {status:"ERROR",error:"Invalid Plaid environment"};response=await fetch(`https://${env}.plaid.com/institutions/get`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:process.env.PLAID_CLIENT_ID,secret:process.env.PLAID_SECRET,count:1,offset:0,country_codes:["US"],options:{products:[provider==="Plaid Investments"?"investments":"transactions"]}}),signal:AbortSignal.timeout(10000)});}
  else return {status:"DEGRADED",error:"Configured; end-to-end delivery/feed verification required. No test message was sent."};
  if(!response.ok)return {status:response.status===429?"DEGRADED":"ERROR",error:`HTTP_${response.status}`};
  return {status:"HEALTHY",error:null};
}
