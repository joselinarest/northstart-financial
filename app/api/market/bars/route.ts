import {loadRuntimeSecrets} from "@/lib/runtime-secrets";
export const dynamic = "force-dynamic";

const ranges: Record<string,{days:number;timeframe:string}> = {"1M":{days:35,timeframe:"1Day"},"3M":{days:100,timeframe:"1Day"},"6M":{days:195,timeframe:"1Day"},"1Y":{days:370,timeframe:"1Day"},"5Y":{days:1835,timeframe:"1Week"}};

export async function GET(request:Request){
  await loadRuntimeSecrets();
  const url=new URL(request.url),symbol=(url.searchParams.get("symbol")||"SPY").toUpperCase(),range=url.searchParams.get("range")||"1Y",config=ranges[range]||ranges["1Y"];
  if(!/^[A-Z.]{1,10}$/.test(symbol))return Response.json({error:"Invalid stock or ETF symbol"},{status:400});
  if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)return Response.json({status:"not_configured",error:"Connect Alpaca market data to load charts for every stock and ETF."},{status:503});
  const start=new Date(Date.now()-config.days*86400000).toISOString(),feed=process.env.ALPACA_DATA_FEED||"iex";
  const response=await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=${config.timeframe}&start=${encodeURIComponent(start)}&limit=1000&adjustment=all&feed=${encodeURIComponent(feed)}`,{headers:{"APCA-API-KEY-ID":process.env.ALPACA_API_KEY,"APCA-API-SECRET-KEY":process.env.ALPACA_API_SECRET},cache:"no-store"});
  if(!response.ok)return Response.json({error:"Historical chart data could not be loaded.",providerStatus:response.status},{status:response.status});
  const data=await response.json() as {bars?:Array<{t:string;o:number;h:number;l:number;c:number;v:number}>};
  return Response.json({symbol,range,feed,bars:(data.bars||[]).map(bar=>({time:bar.t,open:bar.o,high:bar.h,low:bar.l,close:bar.c,volume:bar.v}))},{headers:{"Cache-Control":"private, max-age=60"}});
}
