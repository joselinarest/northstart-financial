import {providerSignal} from '@/lib/work-budget';
type J=Record<string,any>;
const cache=new Map<string,{until:number;promise:Promise<J>}>();
// Only server modules import this adapter. Snapshot quotes do not contain daily volume/OI.
export async function optionsChain(symbol:string){
 const feed=process.env.ALPACA_OPTIONS_FEED||'indicative',key=symbol+':'+feed,prior=cache.get(key);
 if(prior&&prior.until>Date.now())return prior.promise;
 const promise=(async()=>{
  const headers={'APCA-API-KEY-ID':process.env.ALPACA_API_KEY||'','APCA-API-SECRET-KEY':process.env.ALPACA_API_SECRET||''};
  const from=new Date(Date.now()+14*86400000).toISOString().slice(0,10),to=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const get=async(url:string)=>{const r=await fetch(url,{headers,signal:providerSignal(8000),cache:'no-store'});if(!r.ok)throw Error(`Options provider HTTP ${r.status}`);return r.json();};
  const snapshots:J={},limitations:string[]=[];let token:string|undefined,pages=0;
  do{const q=new URLSearchParams({feed,limit:'1000',expiration_date_gte:from,expiration_date_lte:to});if(token)q.set('page_token',token);const data=await get(`https://data.alpaca.markets/v1beta1/options/snapshots/${encodeURIComponent(symbol)}?${q}`);Object.assign(snapshots,data.snapshots||{});token=data.next_page_token;pages++;}while(token&&pages<3);
  if(token)limitations.push('Chain exceeds 3,000 contracts; remaining contracts have not been evaluated.');
  const symbols=Object.keys(snapshots).filter(s=>snapshots[s].latestQuote?.bp>0&&snapshots[s].latestQuote?.ap>=snapshots[s].latestQuote?.bp).sort((a,b)=>{const spread=(s:string)=>{const q=snapshots[s].latestQuote;return(q.ap-q.bp)/((q.ap+q.bp)/2)};return spread(a)-spread(b)}).slice(0,100);
  try{const q=new URLSearchParams({underlying_symbols:symbol,expiration_date_gte:from,expiration_date_lte:to,limit:'10000',status:'active'});const data=await get(`${(process.env.ALPACA_CLOCK_BASE_URL||'https://paper-api.alpaca.markets').replace(/\/(?:v2(?:\/clock)?)?\/?$/,'')}/v2/options/contracts?${q}`);for(const c of data.option_contracts||[])if(snapshots[c.symbol]){snapshots[c.symbol].openInterest=c.open_interest==null?null:Number(c.open_interest);snapshots[c.symbol].openInterestDate=c.open_interest_date;}if(data.next_page_token)limitations.push('Open-interest metadata is incomplete.');}catch{limitations.push('Open interest unavailable from the contract metadata provider.');}
  if(symbols.length)try{const q=new URLSearchParams({symbols:symbols.join(','),timeframe:'1Day',start:new Date(Date.now()-7*86400000).toISOString(),limit:'10000',feed});const data=await get(`https://data.alpaca.markets/v1beta1/options/bars?${q}`);for(const [s,bars]of Object.entries(data.bars||{}) as [string,J[]][]){if(bars.length&&snapshots[s])snapshots[s].dailyBar=bars.at(-1);}if(data.next_page_token)limitations.push('Volume history is incomplete.');}catch{limitations.push('Daily option volume unavailable from historical bars.');}
  return {snapshots,feed,limitations,partial:Boolean(token),expirationWindow:{from,to},volumeSymbolsReviewed:symbols.length,retrievedAt:new Date().toISOString()};
 })();cache.set(key,{until:Date.now()+60000,promise});try{return await promise}catch(e){cache.delete(key);throw e}
}
