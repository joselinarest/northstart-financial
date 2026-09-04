"use client";
import {useEffect} from "react";

export default function RealtimeSync({accessToken,onStatus,onEvent,refreshMinutes=15}:{accessToken:string;onStatus:(status:string)=>void;onEvent:()=>void;refreshMinutes?:number}){
 useEffect(()=>{
  const url=process.env.NEXT_PUBLIC_REALTIME_WS_URL;
  let socket:WebSocket|null=null,retry:ReturnType<typeof setTimeout>|null=null,stopped=false;
  const publish=(detail:unknown)=>{window.dispatchEvent(new CustomEvent("northstar:realtime",{detail}));onEvent()};
  if(!url){onStatus(`MARKET ${refreshMinutes}m · PLAID ON SYNC`);const poll=window.setInterval(()=>publish({type:"poll"}),Math.max(1,refreshMinutes)*60000);return()=>window.clearInterval(poll)}
  let delay=1000;
  const connect=()=>{if(stopped)return;onStatus("CONNECTING");socket=new WebSocket(url);socket.onopen=()=>{delay=1000;onStatus("LIVE SYNC");socket?.send(JSON.stringify({type:"authenticate",token:accessToken}))};socket.onmessage=event=>{try{publish(JSON.parse(event.data))}catch{publish({type:"update"})}};socket.onerror=()=>onStatus("RECONNECTING");socket.onclose=()=>{if(stopped)return;onStatus("RECONNECTING");retry=setTimeout(connect,delay);delay=Math.min(delay*2,30000)}};
  connect();
  return()=>{stopped=true;if(retry)clearTimeout(retry);socket?.close()};
 },[accessToken,refreshMinutes]);
 return null;
}
