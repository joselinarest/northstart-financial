"use client";

import { useEffect } from "react";

type LiveEvent = { type?: string; title?: string; explanation?: string; severity?: string; id?: string };

export default function RealtimeSync({accessToken,onStatus,onEvent,refreshMinutes=1,marketOpen=false}:{accessToken:string;onStatus:(status:string)=>void;onEvent:()=>void;refreshMinutes?:number;marketOpen?:boolean}) {
  useEffect(() => {
    const websocketUrl=process.env.NEXT_PUBLIC_REALTIME_WS_URL;
    let socket:WebSocket|null=null,retry:ReturnType<typeof setTimeout>|null=null,marketTimer:number|null=null,alertTimer:number|null=null,stopped=false,delay=1_000,seededAlerts=false;
    const seenAlerts=new Set<string>();
    const publish=(detail:LiveEvent)=>{
      window.dispatchEvent(new CustomEvent("northstar:realtime",{detail}));
      if(marketOpen)onEvent();
      if(detail.type!=="alert"||!("Notification" in window)||Notification.permission!=="granted"||localStorage.getItem("northstar-push-enabled")==="false")return;
      new Notification(detail.title||"Northstar action review",{body:detail.explanation||"Material evidence changed. Open Northstar to review; no order was placed.",tag:detail.id||"northstar-alert"});
    };
    const pollAlerts=async()=>{
      if(stopped||document.visibilityState!=="visible")return;
      const householdId=localStorage.getItem("northstar-household-id");
      try{
        const response=await fetch("/api/alerts?unread=true",{headers:{...(accessToken?{Authorization:`Bearer ${accessToken}`}:{}) ,...(householdId?{"X-Household-ID":householdId}:{})},cache:"no-store"});
        if(!response.ok)throw new Error("Alert polling unavailable");
        const data=await response.json() as {alerts?:LiveEvent[]};
        for(const alert of data.alerts||[]){if(!alert.id||seenAlerts.has(alert.id))continue;seenAlerts.add(alert.id);if(seededAlerts)publish({type:"alert",...alert})}
        seededAlerts=true;
        onStatus(marketOpen?`LIVE ALERTS · MARKET ${refreshMinutes}m`:"LIVE ALERTS · MARKET CLOSED");
      }catch{onStatus(marketOpen?`ALERT POLL DEGRADED · MARKET ${refreshMinutes}m`:"ALERT POLL DEGRADED · MARKET CLOSED")}
    };
    if(marketOpen)marketTimer=window.setInterval(()=>publish({type:"poll"}),Math.max(1,refreshMinutes)*60_000);
    if(!websocketUrl){void pollAlerts();alertTimer=window.setInterval(pollAlerts,60_000)}else{
      const connectWs=()=>{if(stopped)return;onStatus("CONNECTING");socket=new WebSocket(websocketUrl);socket.onopen=()=>{delay=1_000;onStatus("LIVE SYNC");socket?.send(JSON.stringify({type:"authenticate",token:accessToken}))};socket.onmessage=event=>{try{publish(JSON.parse(event.data))}catch{publish({type:"update"})}};socket.onerror=()=>onStatus("RECONNECTING");socket.onclose=()=>{if(!stopped){retry=setTimeout(connectWs,delay);delay=Math.min(delay*2,30_000)}}};
      connectWs();
    }
    return()=>{stopped=true;if(retry)clearTimeout(retry);if(marketTimer)window.clearInterval(marketTimer);if(alertTimer)window.clearInterval(alertTimer);socket?.close()};
  },[accessToken,refreshMinutes,marketOpen]);
  return null;
}
