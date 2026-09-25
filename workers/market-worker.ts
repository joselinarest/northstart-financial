import {loadRuntimeSecrets} from '@/lib/runtime-secrets';
import {runNotificationWorker} from '@/lib/notification-worker';
/** EventBridge invokes this directly; heavy analysis never crosses Amplify's HTTP deadline. */
export async function handler(){
  console.log('WORKER_BUILD',{commit:process.env.NORTHSTAR_WORKER_COMMIT});
  await loadRuntimeSecrets();
  if(!process.env.CRON_SECRET||!process.env.APP_URL)throw Error('WORKER_CONFIGURATION_MISSING');
  const request=new Request(new URL('/api/notifications/process',process.env.APP_URL),{method:'POST',headers:{authorization:`Bearer ${process.env.CRON_SECRET}`}});
  const result=await runNotificationWorker(request,{totalMs:80_000,jobMs:55_000});
  const body=await result.json();
  if(!result.ok)throw Error(`WORKER_${result.status}:${body.error||'FAILED'}:${body.correlationId||'NO_REFERENCE'}`);
  console.log('WORKER_RESULT',{status:result.status,...body});
  return body;
}

