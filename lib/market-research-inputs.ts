import type {PostgresDatabase} from '@/lib/db';
import {marketDataProvider} from '@/lib/providers/alpaca-market-data';
import {invalidateProviderResponse} from '@/lib/provider-response-cache';
import {discoveryFinnhub} from '@/lib/discovery-queue';
import {loadCatalystContext,evaluateCatalystEntryGate} from '@/lib/catalyst-entry-gate';
import {researchBenchmark} from '@/lib/sector-benchmark';
import {benchmarkHistory,validateDailyHistory,RESEARCH_EVIDENCE_VERSION} from '@/lib/research-evidence';
import {volatilityContext} from '@/lib/options-volatility';
import {technicalExpectation} from '@/lib/market-expectation';
import {researchMarketFresh} from '@/lib/research-market-freshness';
type Row=Record<string,any>;
export type ResearchStage=(stage:string,status:string,details?:Row,error?:string|null)=>Promise<unknown>;
export async function marketResearchInputs(db:PostgresDatabase,symbol:string,force=false,stage:ResearchStage=async()=>{},requestedAt?:string){
 const key='research-v2:'+symbol,cached=await db.prepare('SELECT payload_json,fetched_at,expires_at FROM discovery_provider_cache WHERE cache_key=?').bind(key).first<Row>();
 const prior=cached?.payload_json?.evidenceVersion===RESEARCH_EVIDENCE_VERSION?cached.payload_json:null;
 const reusable=prior&&Date.parse(cached!.expires_at)>Date.now()&&!Object.keys(prior.stageErrors||{}).length&&researchMarketFresh(prior.asOf||'',120000)&&(!force||(requestedAt&&Date.parse(cached!.fetched_at)>=Date.parse(requestedAt)));
 if(reusable){for(const [name,evidence] of Object.entries(prior.evidence||{}))await stage(name,'COMPLETE',evidence as Row);return prior;}
 const provider=marketDataProvider(),start=new Date(Date.now()-180*86400000).toISOString(),errors:Row={},evidence:Row={};
 if(force)invalidateProviderResponse('alpaca-quotes:'+symbol);
 const attempt=async(name:string,fn:()=>Promise<any>,fallback:any,source:string)=>{
  await stage(name,'REFRESHING');
  try{const data=await fn();evidence[name]={status:'VERIFIED',source,asOf:data.asOf||null,checkedAt:new Date().toISOString()};await stage(name,'COMPLETE',evidence[name]);return data;}
  catch(e){errors[name]=e instanceof Error?e.message:'PROVIDER_FAILED';evidence[name]={status:'RETRY_REQUIRED',source,error:errors[name],checkedAt:new Date().toISOString(),retainedPrevious:!!fallback?.asOf};await stage(name,/timeout|abort|budget/i.test(errors[name])?'TIMED_OUT':'PARTIAL',evidence[name],errors[name]);return fallback;}
 };
 // Price, history, profile and benchmarks are independent: one failed source must not erase another.
 const [quoteResult,history,profile,metrics,catalysts,index,asset]=await Promise.all([
  attempt('UNDERLYING_RESEARCH',async()=>{const r=await provider.getQuotes([symbol]);let q=r.quotes[symbol];
   if(q&&!researchMarketFresh(q.timestamp||'',120000)&&researchMarketFresh(q.quoteTimestamp||'',120000)&&Number(q.bid)>0&&Number(q.ask)>=Number(q.bid)&&(Number(q.ask)-Number(q.bid))/Number(q.bid)<=.01)q={...q,last:(Number(q.bid)+Number(q.ask))/2,timestamp:q.quoteTimestamp||null,priceBasis:'QUOTE_MID',marketLabel:'Fresh bid/ask midpoint; not a traded price'};
   if(!q||!Number.isFinite(q.last)||Number(q.last)<=0||!Number.isFinite(Date.parse(q.timestamp||''))||Date.parse(q.timestamp||'')>Date.now())throw Error('UNDERLYING_QUOTE_INVALID');return {quote:q,asOf:q.timestamp};},prior?{quote:prior.quote,asOf:prior.asOf}:{quote:{},asOf:null},'Alpaca quote'),
  attempt('PRICE_HISTORY',async()=>{const r=await provider.getBars(symbol,{timeframe:'1Day',start,limit:200}),bars=validateDailyHistory(r.bars);return {bars,asOf:bars.at(-1)!.time};},prior?{bars:prior.bars,asOf:prior.bars?.at(-1)?.time}:{bars:[],asOf:null},'Alpaca validated daily OHLCV'),
  attempt('COMPANY_PROFILE',async()=>{const r=await discoveryFinnhub(db,'/stock/profile2?symbol='+symbol,force?60:86400);return {profile:r.data,asOf:r.asOf};},prior?{profile:prior.fundamentals.profile,asOf:prior.fundamentals.profileAsOf}:{profile:{},asOf:null},'Finnhub company profile'),
  attempt('FUNDAMENTAL_ANALYSIS',async()=>{const r=await discoveryFinnhub(db,'/stock/metric?symbol='+symbol+'&metric=all',force?60:21600),metrics=r.data?.metric||{};if(Object.values(metrics).filter(v=>typeof v==='number'&&Number.isFinite(v)).length<4)throw Error('FUNDAMENTALS_NUMERIC_EVIDENCE_INSUFFICIENT');return {metrics,asOf:r.asOf};},prior?{metrics:prior.fundamentals.metrics,asOf:prior.fundamentals.asOf}:{metrics:{},asOf:null},'Finnhub financial metrics'),
  attempt('NEWS_CATALYST',async()=>{const r=await loadCatalystContext(symbol,db,force);if(!r.available)throw Error(r.provider);return r;},prior?.catalysts||{available:false,events:[],provider:'PENDING',asOf:null},'Company news and earnings calendar'),
  attempt('MARKET_BENCHMARK',()=>benchmarkHistory(db,'SPY',start,force?requestedAt:undefined),{bars:[],asOf:null},'SPY daily market benchmark'),
  db.prepare('SELECT asset_json FROM discovery_queue WHERE symbol=?').bind(symbol).first<Row>()
 ]);
 if(quoteResult.asOf&&!researchMarketFresh(quoteResult.asOf,120000)){errors.UNDERLYING_RESEARCH='LATEST_PRICE_REQUIRES_EXECUTION_REFRESH';evidence.UNDERLYING_RESEARCH={...evidence.UNDERLYING_RESEARCH,status:'RETRY_REQUIRED',error:errors.UNDERLYING_RESEARCH};await stage('UNDERLYING_RESEARCH','PARTIAL',evidence.UNDERLYING_RESEARCH,errors.UNDERLYING_RESEARCH);}
 const fund={profile:profile.profile,metrics:metrics.metrics,asOf:metrics.asOf,profileAsOf:profile.asOf};
 const benchmark=researchBenchmark(symbol,profile.profile?.finnhubIndustry,asset?.asset_json?.name||profile.profile?.name||'');
 const sector=await attempt('MARKET_SECTOR_REGIME',async()=>{
  if(!benchmark)throw Error('ASSET_CLASSIFICATION_NEEDS_RESEARCH');
  const result=await benchmarkHistory(db,benchmark.symbol,start,force?requestedAt:undefined);
  if(errors.MARKET_BENCHMARK)throw Error('MARKET_BENCHMARK_VALIDATION_FAILED: '+errors.MARKET_BENCHMARK);
  return result;
 },{bars:[],asOf:null},benchmark?benchmark.symbol+' '+benchmark.kind:'Asset classification');
 evidence.MARKET_SECTOR_REGIME={...evidence.MARKET_SECTOR_REGIME,benchmark,marketAsOf:index.asOf,benchmarkAsOf:sector.asOf,marketBars:index.bars.length,benchmarkBars:sector.bars.length};
 await stage('MARKET_SECTOR_REGIME',errors.MARKET_SECTOR_REGIME?'PARTIAL':'COMPLETE',evidence.MARKET_SECTOR_REGIME,errors.MARKET_SECTOR_REGIME||null);
 const technical=technicalExpectation(history.bars,index.bars,Number(quoteResult.quote?.last||0),sector.bars);
 if(!technical.complete||errors.PRICE_HISTORY)errors.TECHNICAL_ANALYSIS=errors.PRICE_HISTORY||'TECHNICAL_HISTORY_OR_INVALIDATION_INVALID';
 evidence.TECHNICAL_ANALYSIS={status:errors.TECHNICAL_ANALYSIS?'RETRY_REQUIRED':'VERIFIED',source:'Validated daily OHLCV; deterministic indicators',asOf:history.asOf,bars:history.bars.length};
 await stage('TECHNICAL_ANALYSIS',errors.TECHNICAL_ANALYSIS?'PARTIAL':'COMPLETE',{...technical,...evidence.TECHNICAL_ANALYSIS},errors.TECHNICAL_ANALYSIS||null);
 const breadth=await db.prepare("SELECT count(*) FILTER(WHERE (seed_json->'seed'->'metrics'->>'price')::numeric>(seed_json->'seed'->'metrics'->>'sma20')::numeric)::int above,count(*)::int sampled,max(last_screened_at) as_of FROM discovery_queue WHERE active AND seed_json->'seed'->'metrics'->>'sma20' IS NOT NULL").first().catch(()=>null);
 const flow=await db.prepare('SELECT flow_trend,institutional_conviction,data_as_of,provider_status FROM options_flow_summaries WHERE symbol=?').bind(symbol).first().catch(()=>null);
 const result={symbol,evidenceVersion:RESEARCH_EVIDENCE_VERSION,evidence,asOf:quoteResult.asOf,retrievedAt:new Date().toISOString(),quote:quoteResult.quote,bars:history.bars,technical,volatility:volatilityContext(history.bars,index.bars),fundamentals:fund,catalysts,catalystGate:evaluateCatalystEntryGate(catalysts,{mode:'OPTIONS',contractDte:21,allowEventTrade:false}),breadth,flow,sectorBenchmark:benchmark?.symbol||null,benchmarkClassification:benchmark,stageErrors:errors,marketFresh:!errors.UNDERLYING_RESEARCH&&researchMarketFresh(quoteResult.asOf||'',120000),limitations:['VIX and IV rank require independently supplied observations.','Daily-bar VWAP is not intraday confirmation.','Breadth is the timestamped screened-universe sample.']};
 await db.prepare("INSERT INTO discovery_provider_cache(cache_key,payload_json,fetched_at,expires_at) VALUES(?,?::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+(?::int*INTERVAL '1 second')) ON CONFLICT(cache_key) DO UPDATE SET payload_json=EXCLUDED.payload_json,fetched_at=EXCLUDED.fetched_at,expires_at=EXCLUDED.expires_at").bind(key,JSON.stringify(result),Object.keys(errors).length?60:300).run();return result;
}
