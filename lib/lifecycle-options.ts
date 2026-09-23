export type LifecycleOptionQuote = {premium:number;bid:number;ask:number;iv:number;theta:number;delta:number|null;gamma:number|null;vega:number|null;dte:number;asOf:string};
export function underlyingForContract(ticker:string){return /^([A-Z.]+)\d{6}[CP]\d{8}$/.exec(ticker)?.[1]||null;}
export async function loadLifecycleOption(ticker:string):Promise<LifecycleOptionQuote|null>{
  const match=/^([A-Z.]+)(\d{6})[CP]\d{8}$/.exec(ticker);
  if(!match)return null;
  const response=await fetch(`https://data.alpaca.markets/v1beta1/options/snapshots?symbols=${encodeURIComponent(ticker)}&feed=${encodeURIComponent(process.env.ALPACA_OPTIONS_FEED||"indicative")}`,{headers:{"APCA-API-KEY-ID":process.env.ALPACA_API_KEY||"","APCA-API-SECRET-KEY":process.env.ALPACA_API_SECRET||""},cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!response.ok)return null;
  const data=await response.json(),snapshot=data.snapshots?.[ticker],bid=Number(snapshot?.latestQuote?.bp),ask=Number(snapshot?.latestQuote?.ap),iv=Number(snapshot?.impliedVolatility),theta=Number(snapshot?.greeks?.theta),asOf=snapshot?.latestQuote?.t;
  if(!asOf||![bid,ask,iv,theta].every(Number.isFinite)||bid<=0||ask<bid)return null;
  const date=match[2],expiration=Date.parse(`20${date.slice(0,2)}-${date.slice(2,4)}-${date.slice(4,6)}T20:00:00Z`);
  return {premium:bid,bid,ask,iv,theta,delta:snapshot.greeks?.delta??null,gamma:snapshot.greeks?.gamma??null,vega:snapshot.greeks?.vega??null,dte:Math.max(0,(expiration-Date.now())/86400000),asOf};
}
