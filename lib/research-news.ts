import type {PostgresDatabase} from './db';
import {discoveryFinnhub} from './discovery-queue';
import {providerSignal} from './work-budget';

/** Refresh news after hours too; never turn provider failure into an empty news result. */
export async function researchNews(db:PostgresDatabase,symbol:string,from:string,to:string,force=false){
 try{const result=await discoveryFinnhub(db,`/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`,force?0:300);if(!Array.isArray(result.data))throw Error('FINNHUB_NEWS_INVALID_RESPONSE');return {...result,provider:'FINNHUB'};}
 catch(original){
  const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret)throw original;
  const cacheKey='alpaca-news:'+symbol;
  const saved=await db.prepare('SELECT payload_json,fetched_at FROM discovery_provider_cache WHERE cache_key=? AND expires_at>CURRENT_TIMESTAMP').bind(cacheKey).first<any>();
  if(saved&&!force)return {data:saved.payload_json,asOf:new Date(saved.fetched_at).toISOString(),provider:'ALPACA'};
  const response=await fetch(`https://data.alpaca.markets/v1beta1/news?symbols=${encodeURIComponent(symbol)}&start=${from}&sort=desc&limit=50`,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret},signal:providerSignal(10000),cache:'no-store'});
  if(!response.ok)throw Error('ALPACA_NEWS_'+response.status);
  const body=await response.json();if(!Array.isArray(body.news))throw Error('ALPACA_NEWS_INVALID_RESPONSE');
  const data=body.news.map((n:any)=>({headline:n.headline,summary:n.summary,source:n.source,url:n.url,datetime:Date.parse(n.created_at)/1000}));
  const asOf=new Date().toISOString();
  await db.prepare("INSERT INTO discovery_provider_cache(cache_key,payload_json,fetched_at,expires_at) VALUES(?,?::jsonb,?::timestamptz,?::timestamptz+INTERVAL '5 minutes') ON CONFLICT(cache_key) DO UPDATE SET payload_json=EXCLUDED.payload_json,fetched_at=EXCLUDED.fetched_at,expires_at=EXCLUDED.expires_at").bind(cacheKey,JSON.stringify(data),asOf,asOf).run();
  return {data,asOf,provider:'ALPACA'};
 }
}
