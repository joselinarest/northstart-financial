import{marketDataProvider}from"@/lib/providers/alpaca-market-data";
import{MarketProviderError}from"@/lib/providers/market-data";
export const dynamic = "force-dynamic";

const ranges: Record<string,{days:number;timeframe:string}> = {"1M":{days:35,timeframe:"1Day"},"3M":{days:100,timeframe:"1Day"},"6M":{days:195,timeframe:"1Day"},"1Y":{days:370,timeframe:"1Day"},"5Y":{days:1835,timeframe:"1Week"}};

export async function GET(request:Request){
  const url=new URL(request.url),symbol=(url.searchParams.get("symbol")||"").toUpperCase(),range=url.searchParams.get("range")||"1Y",config=ranges[range]||ranges["1Y"];
  if(!/^[A-Z.]{1,10}$/.test(symbol))return Response.json({error:"Invalid stock or ETF symbol"},{status:400});
  const start=new Date(Date.now()-config.days*86400000).toISOString();try{const data=await marketDataProvider().getBars(symbol,{timeframe:config.timeframe,start,limit:1000});return Response.json({symbol,range,...data},{headers:{"Cache-Control":"private, max-age=30"}})}catch(error){const known=error instanceof MarketProviderError;return Response.json({status:known?error.code:"provider_error",error:error instanceof Error?error.message:"Historical data unavailable"},{status:known?error.status:502})}
}
