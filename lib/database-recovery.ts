/** Retry only acquisition, before any SQL is submitted. Never replay ambiguous writes. */
export async function acquireDatabaseClient<T>(connect:()=>Promise<T>,wait:(ms:number)=>Promise<void>=ms=>new Promise(r=>setTimeout(r,ms)),random= Math.random):Promise<T>{
  for(let attempt=0;;attempt++){
    try{return await connect();}
    catch(error){
      const e=error as {code?:string;message?:string};
      const transient=['53300','57P03','ECONNRESET','ETIMEDOUT','ECONNREFUSED'].includes(e?.code||'')||/timeout|Connection terminated/i.test(e?.message||'');
      if(!transient||attempt>=1)throw error;
      await wait(150+Math.floor(random()*200));
    }
  }
}
