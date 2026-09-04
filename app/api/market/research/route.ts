export const dynamic = "force-dynamic";

const validSymbol = /^[A-Z][A-Z0-9.-]{0,9}$/;

export async function GET(request:Request) {
  const key=process.env.FINNHUB_API_KEY;
  if(!key)return Response.json({status:"not_configured",error:"Configure FINNHUB_API_KEY to enable company research."},{status:503});
  const url=new URL(request.url),symbol=(url.searchParams.get("symbol")||"").trim().toUpperCase();
  if(!validSymbol.test(symbol))return Response.json({error:"Enter a valid stock symbol."},{status:400});
  const today=new Date(),from=new Date(today.getTime()-30*86400000),date=(value:Date)=>value.toISOString().slice(0,10),base="https://finnhub.io/api/v1";
  const get=async(path:string)=>{const response=await fetch(`${base}${path}`,{headers:{"X-Finnhub-Token":key},cache:"no-store"});if(!response.ok)throw new Error(`Finnhub request failed (${response.status})`);return response.json()};
  const requests={quote:`/quote?symbol=${encodeURIComponent(symbol)}`,profile:`/stock/profile2?symbol=${encodeURIComponent(symbol)}`,metrics:`/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`,news:`/company-news?symbol=${encodeURIComponent(symbol)}&from=${date(from)}&to=${date(today)}`,filings:`/stock/filings?symbol=${encodeURIComponent(symbol)}&from=${date(from)}&to=${date(today)}`};
  const entries=await Promise.all(Object.entries(requests).map(async([name,path])=>{try{return[name,await get(path)] as const}catch(error){return[name,{status:"unavailable",error:error instanceof Error?error.message:"Provider request failed"}] as const}}));
  const data=Object.fromEntries(entries) as Record<string,any>,filings=Array.isArray(data.filings)?data.filings:data.filings?.data;
  return Response.json({status:"connected",provider:"Finnhub",symbol,asOf:new Date().toISOString(),quote:data.quote,profile:data.profile,metrics:data.metrics?.metric||data.metrics,news:Array.isArray(data.news)?data.news.slice(0,25):data.news,filings:Array.isArray(filings)?filings.slice(0,25):data.filings},{headers:{"Cache-Control":"private, max-age=300"}});
}
