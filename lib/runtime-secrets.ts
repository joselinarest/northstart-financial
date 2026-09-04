import {GetSecretValueCommand,SecretsManagerClient} from "@aws-sdk/client-secrets-manager";

let loading:Promise<void>|null=null;
const permitted=new Set(["DATABASE_URL","DATABASE_POOL_MAX","DATABASE_SSL","DATABASE_SSL_REJECT_UNAUTHORIZED","TOKEN_ENCRYPTION_KEY","PLAID_CLIENT_ID","PLAID_SECRET","PLAID_ENV","PLAID_PRODUCTS","PLAID_COUNTRY_CODES","PLAID_WEBHOOK_URL","PLAID_REDIRECT_URI","OPENAI_API_KEY","OPENAI_MODEL","ALPACA_API_KEY","ALPACA_API_SECRET","ALPACA_DATA_FEED","ALPACA_CLOCK_BASE_URL","ALPACA_OPTIONS_FEED","FINNHUB_API_KEY","FRED_API_KEY","NEWSAPI_AI_KEY","RESEND_API_KEY","EMAIL_FROM","VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY","CRON_SECRET"]);

export async function loadRuntimeSecrets(){
 const secretId=process.env.NORTHSTAR_SECRET_ID?.trim();
 if(!secretId)return;
 if(!loading)loading=(async()=>{const arnRegion=secretId.startsWith("arn:")?secretId.split(":")[3]:undefined,client=new SecretsManagerClient(arnRegion?{region:arnRegion}:{}),result=await client.send(new GetSecretValueCommand({SecretId:secretId}));if(!result.SecretString)throw new Error("Northstar AWS secret has no SecretString JSON value");let values:Record<string,unknown>;try{values=JSON.parse(result.SecretString)}catch{throw new Error("Northstar AWS secret must contain a JSON object")};for(const[key,value]of Object.entries(values)){if(!permitted.has(key)||value===null||value===undefined)continue;const normalized=typeof value==="string"?value:typeof value==="boolean"||typeof value==="number"?String(value):"";if(normalized)process.env[key]=normalized}})();
 try{await loading}catch(error){loading=null;throw new Error(`Secure server configuration could not be loaded: ${error instanceof Error?error.message:"AWS Secrets Manager error"}`)}
}
