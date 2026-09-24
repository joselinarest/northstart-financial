/** Retry only acquisition, before any SQL is submitted. Never replay ambiguous writes. */
export async function acquireDatabaseClient<T>(connect:()=>Promise<T>,wait:(ms:number)=>Promise<void>=ms=>new Promise(r=>setTimeout(r,ms)),random= Math.random):Promise<T>{
  for(let attempt=0;;attempt++){
    try{return await connect();}
    catch(error){
      const e=error as {code?:string;message?:string};
      const transient=['53300','57P03','57P05','57P01','08006','ECONNRESET','ETIMEDOUT','ECONNREFUSED'].includes(e?.code||'')||/timeout|Connection terminated|not queryable/i.test(e?.message||'');
      if(!transient||attempt>=1)throw error;
      await wait(150+Math.floor(random()*200));
    }
  }
}

/** Verify an idle pooled socket before caller SQL. Failure can retry safely here only. */
export async function acquireHealthyDatabaseClient<T extends {query(sql:string):Promise<unknown>;release(discard?:boolean):void}>(connect:()=>Promise<T>){
 return acquireDatabaseClient(async()=>{const client=await connect();try{await client.query('SELECT 1');return client}catch(error){client.release(true);throw error}});
}
