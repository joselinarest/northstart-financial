"use client";
import{useEffect}from"react";

type LiveEvent={type?:string;title?:string;explanation?:string;severity?:string;id?:string};
export default function RealtimeSync({accessToken,onStatus,onEvent,refreshMinutes=15}:{accessToken:string;onStatus:(status:string)=>void;onEvent:()=>void;refreshMinutes?:number}){
 useEffect(()=>{
  const websocketUrl=process.env.NEXT_PUBLIC_REALTIME_WS_URL;let socket:WebSocket|null=null,retry:ReturnType<typeof setTimeout>|null=null,poll:number|null=null,stopped=false,abort:AbortController|null=null,delay=1000;
  const publish=(detail:LiveEvent)=>{window.dispatchEvent(new CustomEvent("northstar:realtime",{detail}));onEvent();if(detail.type!=="alert"||!("Notification"in window)||Notification.permission!=="granted"||localStorage.getItem("northstar-push-enabled")==="false")return;new Notification(detail.title||"Northstar action review",{body:detail.explanation||"Material evidence changed. Open Northstar to review; no order was placed.",tag:detail.id||"northstar-alert"})};
  const startPoll=()=>{if(poll)return;poll=window.setInterval(()=>publish({type:"poll"}),Math.max(1,refreshMinutes)*60000)};
  const connectSse=async()=>{if(stopped)return;abort=new AbortController();try{onStatus("CONNECTING ALERTS");const householdId=localStorage.getItem("northstar-household-id"),response=await fetch("/api/alerts/stream",{headers:{Accept:"text/event-stream",...(accessToken?{Authorization:`Bearer ${accessToken}`}:{}) ,...(householdId?{"X-Household-ID":householdId}:{})},signal:abort.signal,cache:"no-store"});if(!response.ok||!response.body)throw new Error("Alert stream unavailable");onStatus(`LIVE ALERTS · MARKET ${refreshMinutes}m`);delay=1000;const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="";while(!stopped){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const packets=buffer.split("\n\n");buffer=packets.pop()||"";for(const packet of packets){const event=packet.match(/^event: (.+)$/m)?.[1],data=packet.match(/^data: (.+)$/m)?.[1];if(event==="alert"&&data){try{publish({type:"alert",...JSON.parse(data)})}catch{}}}}}catch(error){if(stopped||error instanceof DOMException&&error.name==="AbortError")return;onStatus(`ALERT RETRY · MARKET ${refreshMinutes}m`)}finally{if(!stopped){retry=setTimeout(connectSse,delay);delay=Math.min(delay*2,30000)}}};
  startPoll();
  if(!websocketUrl){void connectSse()}else{const connectWs=()=>{if(stopped)return;onStatus("CONNECTING");socket=new WebSocket(websocketUrl);socket.onopen=()=>{delay=1000;onStatus("LIVE SYNC");socket?.send(JSON.stringify({type:"authenticate",token:accessToken}))};socket.onmessage=event=>{try{publish(JSON.parse(event.data))}catch{publish({type:"update"})}};socket.onerror=()=>onStatus("RECONNECTING");socket.onclose=()=>{if(!stopped){retry=setTimeout(connectWs,delay);delay=Math.min(delay*2,30000)}}};connectWs()}
  return()=>{stopped=true;if(retry)clearTimeout(retry);if(poll)clearInterval(poll);abort?.abort();socket?.close()};
 },[accessToken,refreshMinutes]);
 return null;
}
