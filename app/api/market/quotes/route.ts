import{marketDataProvider}from"@/lib/providers/alpaca-market-data";
import{MarketProviderError,normalizeSymbols}from"@/lib/providers/market-data";
import{providerCached}from"@/lib/provider-response-cache";
export const dynamic = "force-dynamic";

export async function GET(request:Request){
  const raw=new URL(request.url).searchParams.get("symbols")||"",symbols=normalizeSymbols(raw);
  if(!symbols.length)return Response.json({error:"Provide at least one valid symbol"},{status:400});
  try{const key=`quotes:${[...symbols].sort().join(",")}`;return Response.json(await providerCached(key,15_000,()=>marketDataProvider().getQuotes(symbols)),{headers:{"Cache-Control":"private, max-age=15, stale-while-revalidate=30"}})}catch(error){const known=error instanceof MarketProviderError;return Response.json({status:known?error.code:"provider_error",error:error instanceof Error?error.message:"Quotes unavailable"},{status:known?error.status:502})}
}
