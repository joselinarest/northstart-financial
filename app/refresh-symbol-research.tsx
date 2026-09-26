"use client";
import {useState} from 'react';
export default function RefreshSymbolResearch({accountId,symbol}:{accountId:string;symbol:string}){
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const refresh=async()=>{setBusy(true);setStatus('QUEUED · requesting fresh underlying and contract research');try{const household=localStorage.getItem('northstar-household-id'),response=await fetch('/api/market/options/scan',{method:'POST',headers:{'Content-Type':'application/json',...(household?{'X-Household-ID':household}:{})},body:JSON.stringify({accountId,symbol}),signal:AbortSignal.timeout(20000)}),body=await response.json();if(!response.ok)throw Error(body.error);setStatus('QUEUED · '+body.requestId+' · track stage progress in Options Research');}catch{setStatus('Refresh timed out or failed — Retry. Saved analysis is preserved.');}finally{setBusy(false)}};
 return <div><button type="button" disabled={busy||!accountId} onClick={()=>void refresh()}>{busy?'Refreshing research…':'Refresh underlying + option research'}</button>{status&&<p role="status">{status} <a href={'/workspace/options?accountId='+encodeURIComponent(accountId)}>Open progress →</a></p>}</div>;
}
