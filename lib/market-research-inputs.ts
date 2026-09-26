import type {PostgresDatabase} from '@/lib/db';
import {marketDataProvider} from '@/lib/providers/alpaca-market-data';
import {invalidateProviderResponse} from '@/lib/provider-response-cache';
import {discoveryFinnhub} from '@/lib/discovery-queue';
import {loadCatalystContext,evaluateCatalystEntryGate} from '@/lib/catalyst-entry-gate';
import {sectorBenchmarkForIndustry} from '@/lib/sector-benchmark';
import {volatilityContext} from '@/lib/options-volatility';
import {technicalExpectation} from '@/lib/market-expectation';
import {researchMarketFresh} from '@/lib/research-market-freshness';
type Row=Record<string,any>;
export type ResearchStage=(stage:string,status:string,details?:Row,error?:string|null)=>Promise<unknown>;
export async function marketResearchInputs(db:PostgresDatabase,symbol:string,force=false,stage:ResearchStage=async()=>{}){
 const key='research-v2:'+symbol,saved=force?null:await db.prepare("SELECT payload_json FROM discovery_provider_cache WHERE cache_key=? AND expires_at>CURRENT_TIMESTAMP").bind(key).first<Row>();
 if(saved){for(const name of ['UNDERLYING_RESEARCH','TECHNICAL_ANALYSIS','FUNDAMENTAL_ANALYSIS','NEWS_CATALYST','MARKET_SECTOR_REGIME'])await stage(name,saved.payload_json.stageErrors?.[name]?'PARTIAL':'COMPLETE',{asOf:saved.payload_json.asOf,sharedSymbolResearch:true},saved.payload_json.stageErrors?.[name]||null);return saved.payload_json;}
 const provider=marketDataProvider(),start=new Date(Date.now()-180*86400000).toISOString(),errors:Row={};
 if(force)invalidateProviderResponse('alpaca-quotes:'+symbol);
 const attempt=async(name:string,fn:()=>Promise<any>,fallback:any)=>{await stage(name,'REFRESHING');try{const data=await fn();await stage(name,'COMPLETE',{asOf:data.asOf||new Date().toISOString()});return data;}catch(e){errors[name]=e instanceof Error?e.message:'PROVIDER_UNAVAILABLE';await stage(name,/timeout|abort|budget/i.test(errors[name])?'TIMED_OUT':'PARTIAL',{},errors[name]);return fallback;}};
 const [underlying,fund,catalysts]=await Promise.all([
  attempt('UNDERLYING_RESEARCH',async()=>{const [quotes,bars]=await Promise.all([provider.getQuotes([symbol]),provider.getBars(symbol,{timeframe:'1Day',start,limit:200})]);let index:any={bars:[]};try{index=await provider.getBars('SPY',{timeframe:'1Day',start,limit:200});}catch{errors.MARKET_SECTOR_REGIME='MARKET_BENCHMARK_UNAVAILABLE';}if(!quotes.quotes[symbol]?.last||bars.bars.length<20)throw Error('UNDERLYING_PRICE_OR_HISTORY_MISSING');return {quote:quotes.quotes[symbol],bars:bars.bars,index:index.bars,asOf:quotes.quotes[symbol].timestamp};},{quote:{},bars:[],index:[],asOf:null}),
  attempt('FUNDAMENTAL_ANALYSIS',async()=>{const [profile,metric]=await Promise.all([discoveryFinnhub(db,'/stock/profile2?symbol='+symbol,force?0:86400),discoveryFinnhub(db,'/stock/metric?symbol='+symbol+'&metric=all',force?0:21600)]);if(Object.keys(metric.data?.metric||{}).length<4)throw Error('FUNDAMENTALS_OR_VALUATION_UNAVAILABLE');return {profile:profile.data,metrics:metric.data.metric,asOf:metric.asOf};},{profile:{},metrics:{},asOf:null}),
  attempt('NEWS_CATALYST',async()=>{const result=await loadCatalystContext(symbol,db,force);if(!result.available)throw Error(result.provider);return result;},{available:false,events:[],provider:'UNAVAILABLE',asOf:null})
 ]);
 const benchmark=sectorBenchmarkForIndustry(fund.profile?.finnhubIndustry);
 const sector=await attempt('MARKET_SECTOR_REGIME',async()=>{if(!benchmark)throw Error('SECTOR_BENCHMARK_UNAVAILABLE');return provider.getBars(benchmark,{timeframe:'1Day',start,limit:200});},{bars:[]});
 if(!underlying.index.length)errors.MARKET_SECTOR_REGIME='MARKET_BENCHMARK_UNAVAILABLE';
 await stage('TECHNICAL_ANALYSIS','REFRESHING');const technical=technicalExpectation(underlying.bars,underlying.index,Number(underlying.quote?.last||0),sector.bars);
 if(!technical.complete)errors.TECHNICAL_ANALYSIS='TECHNICAL_HISTORY_OR_INVALIDATION_UNAVAILABLE';await stage('TECHNICAL_ANALYSIS',technical.complete?'COMPLETE':'PARTIAL',{...technical,asOf:underlying.asOf},errors.TECHNICAL_ANALYSIS||null);
 const breadth=await db.prepare("SELECT count(*) FILTER(WHERE (seed_json->'seed'->'metrics'->>'price')::numeric>(seed_json->'seed'->'metrics'->>'sma20')::numeric)::int above,count(*)::int sampled,max(last_screened_at) as_of FROM discovery_queue WHERE active AND seed_json->'seed'->'metrics'->>'sma20' IS NOT NULL").first();
 const flow=await db.prepare('SELECT flow_trend,institutional_conviction,data_as_of,provider_status FROM options_flow_summaries WHERE symbol=?').bind(symbol).first().catch(()=>null);
 const result={symbol,asOf:underlying.asOf,retrievedAt:new Date().toISOString(),quote:underlying.quote,technical,volatility:volatilityContext(underlying.bars,underlying.index),fundamentals:fund,catalysts,catalystGate:evaluateCatalystEntryGate(catalysts,{mode:'OPTIONS',contractDte:21,allowEventTrade:false}),breadth,flow,sectorBenchmark:benchmark,stageErrors:errors,marketFresh:researchMarketFresh(underlying.asOf||'',120000),limitations:['VIX and IV rank are unavailable unless independently supplied.','Daily-bar VWAP is not intraday confirmation.','Breadth is the timestamped screened-universe sample, not a live exchange-wide breadth feed.']};
 await db.prepare("INSERT INTO discovery_provider_cache(cache_key,payload_json,fetched_at,expires_at) VALUES(?,?::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+(?::int*INTERVAL '1 second')) ON CONFLICT(cache_key) DO UPDATE SET payload_json=EXCLUDED.payload_json,fetched_at=EXCLUDED.fetched_at,expires_at=EXCLUDED.expires_at").bind(key,JSON.stringify(result),Object.keys(errors).length?60:300).run();return result;
}
