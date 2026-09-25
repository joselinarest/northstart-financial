export type ApiState='LOADING'|'SUCCESS'|'EMPTY'|'STALE'|'ERROR';
export type ApiFailure={error:string;referenceId?:string;status:number};
/** Never display proxy HTML, stack traces or an empty failed response as success. */
export async function readApiPayload<T=Record<string,any>>(response:Response):Promise<T&Partial<ApiFailure>>{
 const referenceId=response.headers.get('x-request-id')||undefined;
 let value:unknown;try{value=await response.json()}catch{value=null}
 if(value===null||typeof value!=='object')return {error:response.ok?'The server returned an invalid response.':'The request could not be completed.',referenceId,status:response.status} as T&ApiFailure;
 if(!response.ok){const object=value as Record<string,unknown>;return {...object,error:(typeof object.error==='string'?object.error:'The request could not be completed.')+(referenceId?' (Reference: '+referenceId+')':''),referenceId,status:response.status} as T&ApiFailure}
 return value as T&Partial<ApiFailure>;
}
export async function apiRequest<T>(path:string,init:RequestInit={},timeoutMs=15000):Promise<T>{
 if(!path.startsWith('/api/')||path.includes('/api/api/'))throw Error('API path must use one same-origin /api prefix');
 const response=await fetch(path,{...init,credentials:'same-origin',signal:init.signal||AbortSignal.timeout(timeoutMs)}),value=await readApiPayload<T>(response);
 if(!response.ok||value.error)throw Object.assign(new Error(value.error||'Request failed'),{referenceId:value.referenceId,status:response.status});
 return value;
}
