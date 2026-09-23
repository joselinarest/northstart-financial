export function workerFailure(error:unknown){
  const e=error as {code?:string;message?:string};
  const transient=['53300','57P03','08001','08006','ECONNRESET','ETIMEDOUT'].includes(e?.code||'')||/timeout|Connection terminated/i.test(e?.message||'');
  return {status:transient?503:500,code:transient?'DATABASE_TEMPORARILY_UNAVAILABLE':'WORKER_FAILED',retryAfter:transient?60:undefined};
}
