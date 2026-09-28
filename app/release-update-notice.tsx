"use client";
import {useEffect,useState} from 'react';
export default function ReleaseUpdateNotice(){
 const [available,setAvailable]=useState(false);
 useEffect(()=>{let active=true,inFlight=false;const current=process.env.NEXT_PUBLIC_BUILD_COMMIT;
 const check=async()=>{if(inFlight||!current||current==='unknown'||document.visibilityState!=='visible')return;inFlight=true;try{const r=await fetch('/api/app-version',{cache:'no-store'});if(!r.ok)return;const next=await r.json();if(active&&next.commit&&next.commit!=='unknown')setAvailable(next.commit!==current);}catch{}finally{inFlight=false}};
 void check();const timer=setInterval(check,60000);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)};
 },[]);
 return available?<aside role="status" aria-label="App update available" style={{position:'fixed',bottom:86,left:16,right:16,zIndex:1000,background:'#123e30',color:'white',borderRadius:12,padding:16,display:'flex',gap:16,alignItems:'center',justifyContent:'space-between',boxShadow:'0 4px 24px #0003'}}><span>A newer Northstar release is available. Save any unfinished edits, then update this page.</span><button type="button" style={{background:'white',color:'#123e30',padding:'10px 16px',borderRadius:8,whiteSpace:'nowrap'}} onClick={()=>location.reload()}>Update now</button></aside>:null;
}
