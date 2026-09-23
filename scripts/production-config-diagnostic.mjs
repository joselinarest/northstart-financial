// Read-only diagnostics. Credentials stay in process memory and are never printed.
import {execFileSync} from 'node:child_process';
import pg from 'pg';
const aws=process.env.NORTHSTAR_AWS_CLI||'C:/Users/josel/AppData/Local/Programs/Amazon/AWSCLIV2/aws.exe';
const raw=execFileSync(aws,['secretsmanager','get-secret-value','--secret-id','northstar/production','--region','us-west-2','--output','json','--no-cli-pager'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const config=JSON.parse(JSON.parse(raw).SecretString);
console.log(JSON.stringify({configured:Object.fromEntries(['DATABASE_URL','PLAID_CLIENT_ID','PLAID_SECRET','ALPACA_API_KEY','ALPACA_API_SECRET','FINNHUB_API_KEY','OPENAI_API_KEY','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','RESEND_API_KEY','EMAIL_FROM','CRON_SECRET','TOKEN_ENCRYPTION_KEY'].map(k=>[k,Boolean(config[k])]))}));
if(!config.DATABASE_URL)process.exit(2);
const url=new URL(config.DATABASE_URL);for(const k of ['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(k);
const ca=await fetch('https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem',{signal:AbortSignal.timeout(15000)}).then(r=>r.text());
const client=new pg.Client({connectionString:url.toString(),ssl:{ca,rejectUnauthorized:true},connectionTimeoutMillis:15000,statement_timeout:10000});
try{
 await client.connect();
 console.log('DATABASE_CONNECTION_PASS');
 for(const [name,sql] of Object.entries({connections:"SELECT state,count(*)::int count FROM pg_stat_activity GROUP BY state",capacity:"SHOW max_connections",migrations:"SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('schema_migrations','ai_strategy_versions','ai_model_versions','post_trade_reviews','notification_events')",workers:"SELECT worker_name,status,heartbeat_at FROM worker_heartbeats ORDER BY heartbeat_at DESC LIMIT 5"})){
  try{console.log(JSON.stringify({check:name,result:(await client.query(sql)).rows}));}catch(e){console.log(JSON.stringify({check:name,errorCode:e.code||'QUERY_FAILED'}));}
 }
}catch(e){console.log(JSON.stringify({check:'database',errorCode:e.code||'CONNECTION_FAILED',timeout:/timeout/.test(e.message)}));process.exitCode=1;}finally{await client.end().catch(()=>{});}
