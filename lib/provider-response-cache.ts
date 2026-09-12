type Entry<T>={expiresAt:number;value:T};

const values=new Map<string,Entry<unknown>>();
const pending=new Map<string,Promise<unknown>>();

/** Warm-runtime provider cache with request coalescing. Errors are never cached. */
export async function providerCached<T>(key:string,ttlMs:number,load:()=>Promise<T>):Promise<T>{
  const hit=values.get(key);
  if(hit&&hit.expiresAt>Date.now())return hit.value as T;
  const active=pending.get(key);
  if(active)return active as Promise<T>;
  const request=load().then(value=>{
    values.set(key,{expiresAt:Date.now()+ttlMs,value});
    return value;
  }).finally(()=>pending.delete(key));
  pending.set(key,request);
  return request;
}
