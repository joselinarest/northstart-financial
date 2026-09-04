import {loadRuntimeSecrets} from "@/lib/runtime-secrets";
export const dynamic = "force-dynamic";

export async function GET(request:Request){
  await loadRuntimeSecrets();
  const raw=new URL(request.url).searchParams.get("symbols")||"",symbols=[...new Set(raw.toUpperCase().split(",").map(value=>value.trim()).filter(value=>/^[A-Z.]{1,10}$/.test(value)))].slice(0,50);
  if(!symbols.length)return Response.json({error:"Provide at least one valid symbol"},{status:400});
  if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)return Response.json({status:"not_configured",error:"Connect Alpaca to show live bid and ask prices."},{status:503});
  const feed=process.env.ALPACA_DATA_FEED||"iex",response=await fetch(`https://data.alpaca.markets/v2/stocks/snapshots?symbols=${encodeURIComponent(symbols.join(","))}&feed=${encodeURIComponent(feed)}`,{headers:{"APCA-API-KEY-ID":process.env.ALPACA_API_KEY,"APCA-API-SECRET-KEY":process.env.ALPACA_API_SECRET},cache:"no-store"});
  if(!response.ok)return Response.json({error:"Live stock quotes could not be loaded.",providerStatus:response.status},{status:response.status});
  const data=await response.json() as Record<string,{latestQuote?:{bp?:number;ap?:number;t?:string};latestTrade?:{p?:number};dailyBar?:{o?:number;h?:number;l?:number;c?:number;v?:number}}>;
  return Response.json({feed,asOf:new Date().toISOString(),quotes:Object.fromEntries(Object.entries(data).map(([symbol,snapshot])=>[symbol,{bid:snapshot.latestQuote?.bp||null,ask:snapshot.latestQuote?.ap||null,last:snapshot.latestTrade?.p||snapshot.dailyBar?.c||null,open:snapshot.dailyBar?.o||null,high:snapshot.dailyBar?.h||null,low:snapshot.dailyBar?.l||null,volume:snapshot.dailyBar?.v||null,timestamp:snapshot.latestQuote?.t||null}]))},{headers:{"Cache-Control":"private, max-age=15"}});
}
