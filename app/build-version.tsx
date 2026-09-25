"use client";
import {useEffect,useState} from 'react';
export default function BuildVersion(){
 const [api,setApi]=useState<{commit:string;builtAt:string}|null>(null),[error,setError]=useState(false);
 const commit=process.env.NEXT_PUBLIC_BUILD_COMMIT||'unknown';
 useEffect(()=>{fetch('/api/app-version',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(setApi).catch(()=>setError(true))},[]);
 return <section aria-label="Production build" className="space-y-2 rounded-lg border border-line bg-soft p-3 text-sm text-ink [overflow-wrap:anywhere]"><strong>Northstar build {commit.slice(0,12)}</strong><p>Built: {process.env.NEXT_PUBLIC_BUILD_TIME||'Unknown'}</p><p>API build: {api?.commit?.slice(0,12)||(error?'Verification unavailable':'Checking…')} · {api?(api.commit===commit?'Frontend/API match':'Update available — reload this page'):''}</p><small>Commit: {commit}</small></section>
}
