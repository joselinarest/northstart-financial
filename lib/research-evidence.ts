import type {PostgresDatabase} from '@/lib/db';
import {marketDataProvider} from '@/lib/providers/alpaca-market-data';
import {sessionWindow} from '@/lib/research-market-freshness';
import {exchangeDay} from '@/lib/exchange-calendar';
type Row=Record<string,any>;
export const RESEARCH_EVIDENCE_VERSION=3;
export function validateDailyHistory(input:Row[],now=Date.now()){
 if(!Array.isArray(input))throw Error('DAILY_HISTORY_INVALID');
 const byDay=new Map<string,Row>();
 for(const b of input){
  if(!Number.isFinite(Date.parse(b.time))||Date.parse(b.time)>now)throw Error('DAILY_HISTORY_TIMESTAMP_INVALID');
  if(!['open','high','low','close','volume'].every(k=>typeof b[k]==='number'&&Number.isFinite(b[k]))||b.low<=0||b.high<b.low||b.open<b.low||b.open>b.high||b.close<b.low||b.close>b.high||b.volume<0)throw Error('DAILY_HISTORY_OHLCV_INVALID');
  byDay.set(exchangeDay(b.time).date,b);
 }
 const bars=[...byDay.values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 if(bars.length<50)throw Error('DAILY_HISTORY_INSUFFICIENT');
 const window=sessionWindow(now),last=exchangeDay(bars.at(-1)!.time).date;
 if(!window.supported||!window.close||last<exchangeDay(window.close).date)throw Error('DAILY_HISTORY_STALE');
 return bars;
}
const inflight=new Map<string,Promise<Row>>();
/** Reuse a validated, observed history across accounts; retrieval time never repairs stale bars. */
export async function benchmarkHistory(db:PostgresDatabase,symbol:string,start:string,requestedAt?:string):Promise<Row>{
 const key='research-benchmark-v3:'+symbol;
 const cached=await db.prepare('SELECT payload_json,fetched_at FROM discovery_provider_cache WHERE cache_key=? AND expires_at>CURRENT_TIMESTAMP').bind(key).first<Row>();
 if(cached&&(!requestedAt||Date.parse(cached.fetched_at)>=Date.parse(requestedAt))){try{return {...cached.payload_json,bars:validateDailyHistory(cached.payload_json.bars)};}catch{/* Repair invalid or session-stale cache. */}}
 const active=inflight.get(key);if(active)return active;
 const request=(async()=>{
  const response=await marketDataProvider().getBars(symbol,{timeframe:'1Day',start,limit:200});
  const bars=validateDailyHistory(response.bars),result={bars,asOf:bars.at(-1)!.time,retrievedAt:new Date().toISOString(),symbol,source:'Alpaca daily bars'};
  await db.prepare("INSERT INTO discovery_provider_cache(cache_key,payload_json,fetched_at,expires_at) VALUES(?,?::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+INTERVAL '5 minutes') ON CONFLICT(cache_key) DO UPDATE SET payload_json=EXCLUDED.payload_json,fetched_at=EXCLUDED.fetched_at,expires_at=EXCLUDED.expires_at").bind(key,JSON.stringify(result)).run();return result;
 })();inflight.set(key,request);try{return await request;}finally{inflight.delete(key);}
}
