// Server-only module: imported exclusively by authenticated routes and server research services.
import {createHash} from 'node:crypto';
import type {PostgresDatabase} from '@/lib/db';
import {loadRuntimeSecrets} from '@/lib/runtime-secrets';
import {normalizeQuantPrints,finite,type FlowEvidence,type OptionsFlowProvider,type MarketStructureProvider} from '@/lib/flow-evidence';
type J=Record<string,any>;
type Result={status:string;data:unknown;error?:string;retrievedAt?:string};
const origin='https://api.quantdata.us/v1/';
export class QuantDataProvider implements OptionsFlowProvider,MarketStructureProvider {
 constructor(private db:PostgresDatabase){}
 private async request(path:string,body:J,ttl=300000):Promise<Result>{
  const key=process.env.QUANT_DATA_API_KEY;if(!key)return {status:'NOT_CONFIGURED',data:null};
  // Shared database cache and leases coalesce requests across SSR instances, not just pages.
  const fingerprint=createHash('sha256').update(key).digest('hex').slice(0,12),cacheKey=createHash('sha256').update(fingerprint+path+JSON.stringify(body)).digest('hex');
  const cached=await this.db.prepare('SELECT payload FROM quant_data_cache WHERE cache_key=? AND expires_at>CURRENT_TIMESTAMP').bind(cacheKey).first<{payload:Result}>();if(cached?.payload)return cached.payload;
  const lease=await this.db.prepare("INSERT INTO quant_data_cache(cache_key,lease_until) VALUES(?,CURRENT_TIMESTAMP+INTERVAL '20 seconds') ON CONFLICT(cache_key) DO UPDATE SET lease_until=EXCLUDED.lease_until WHERE quant_data_cache.lease_until IS NULL OR quant_data_cache.lease_until<CURRENT_TIMESTAMP RETURNING cache_key").bind(cacheKey).first();
  if(!lease)return {status:'REFRESHING',data:null};
  let result:Result;const started=Date.now();
  try{
   const health=await this.db.prepare("SELECT payload FROM quant_data_cache WHERE cache_key='health'").first<{payload:J}>();
   if(Number(health?.payload?.retryAt)>Date.now())return await this.save(cacheKey,{status:'RATE_LIMITED',data:null,error:'Provider cooldown active'},30000);
   for(const [windowMs,limit] of [[1000,20],[60000,240]]){
    const quotaKey='quota:'+fingerprint+':'+windowMs+':'+Math.floor(Date.now()/windowMs);
    const reserved=await this.db.prepare("INSERT INTO quant_data_cache(cache_key,payload,expires_at) VALUES(?, '{\"count\":1}'::jsonb,CURRENT_TIMESTAMP+INTERVAL '2 minutes') ON CONFLICT(cache_key) DO UPDATE SET payload=jsonb_build_object('count',(quant_data_cache.payload->>'count')::int+1) WHERE (quant_data_cache.payload->>'count')::int<? RETURNING cache_key").bind(quotaKey,limit).first();
    if(!reserved)return await this.save(cacheKey,{status:'RATE_LIMITED',data:null,error:'Central request quota reached; retry after the current window'},30000);
   }
   const response=await fetch(origin+path,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(10000)});
   const remaining=finite(response.headers.get('X-RateLimit-Remaining')),reset=finite(response.headers.get('X-RateLimit-Reset'));
   const retry=response.headers.get('Retry-After'),retryMs=retry?(finite(retry)!==null?Number(retry)*1000:Math.max(0,Date.parse(retry)-Date.now())):60000;
   const error=response.ok?null:`Quant Data HTTP ${response.status}`;
   await this.db.prepare("INSERT INTO quant_data_cache(cache_key,payload) VALUES('health',?::jsonb) ON CONFLICT(cache_key) DO UPDATE SET payload=EXCLUDED.payload,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify({configured:true,lastRequest:new Date().toISOString(),lastSuccess:response.ok?new Date().toISOString():health?.payload?.lastSuccess||null,latencyMs:Date.now()-started,remaining,resetSeconds:reset,retryAt:response.status===429||remaining===0?Date.now()+Math.max(1000,Number.isFinite(retryMs)?retryMs:60000,Number(reset||0)*1000):null,lastError:error})).run();
   if(!response.ok)result={status:response.status===429?'RATE_LIMITED':'UNAVAILABLE',data:null,error:error!};
   else {const payload=await response.json();result=payload&&typeof payload==='object'&&'data' in payload?{status:'AVAILABLE',data:payload,retrievedAt:new Date().toISOString()}:{status:'UNAVAILABLE',data:null,error:'Unexpected provider response schema'};}
  }catch{result={status:'UNAVAILABLE',data:null,error:'Quant Data request timed out or failed'};
   await this.db.prepare("INSERT INTO quant_data_cache(cache_key,payload) VALUES('health',?::jsonb) ON CONFLICT(cache_key) DO UPDATE SET payload=quant_data_cache.payload || EXCLUDED.payload,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify({configured:true,lastRequest:new Date().toISOString(),latencyMs:Date.now()-started,lastError:result.error})).run();
  }
  return this.save(cacheKey,result,result.status==='AVAILABLE'?ttl:30000);
 }
 private async save(key:string,result:Result,ttl:number){await this.db.prepare('UPDATE quant_data_cache SET payload=?::jsonb,expires_at=CURRENT_TIMESTAMP+(? * INTERVAL \'1 millisecond\'),lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE cache_key=?').bind(JSON.stringify(result),ttl,key).run();return result}
 async getEvidence(symbol:string):Promise<FlowEvidence>{
  await loadRuntimeSecrets();symbol=symbol.toUpperCase();if(!/^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol))throw new Error('Invalid ticker');
  const base:FlowEvidence={provider:'Quant Data',symbol,status:'NOT_CONFIGURED',retrievedAt:null,prints:[],markers:[],conviction:null,direction:'UNKNOWN',datasets:{},canAuthorizeTrade:false,limitations:['Flow is supporting evidence only. No trade can be authorized by flow alone.','Latest 100 consolidated prints are a sample, not the complete tape.','Retrieval time is not a guarantee of current market data.']};
  if(!process.env.QUANT_DATA_API_KEY)return base;
  await this.db.prepare("DELETE FROM quant_data_cache WHERE cache_key LIKE 'quota:%' AND expires_at<CURRENT_TIMESTAMP").run();
  const budgetEnd=Date.now()+18000; const filter={ticker:symbol},now=new Date(),date=(d:Date)=>d.toLocaleDateString('en-CA',{timeZone:'America/New_York'});
  const specs:Array<[string,string,J,number?]>=[
   ['orderFlow','options/tool/order-flow/consolidated',{filter,size:100,includeStatistics:true}],
   ['netFlow','options/tool/net-flow',{filter}],['premiumFlow','options/tool/net-drift',{filter}],
   ...(['GAMMA','DELTA','VANNA','CHARM'] as const).map(greek=>[greek,'options/tool/exposure-by-strike',{filter,greekMode:greek,representationMode:'PER_ONE_PERCENT_MOVE'},300000] as [string,string,J,number]),
   ['ivRank','options/tool/iv-rank',{filter,lookBackPeriod:30,maturity:30},900000],
   ['skew','options/tool/volatility-skew',{filter},900000],['termStructure','options/tool/term-structure',{filter},900000],
   ['openInterest','options/tool/open-interest-by-strike',{filter},900000],
   ['darkPool','equities/tool/dark-pool-levels',{filter,sessionDateRange:{startDate:date(new Date(now.getTime()-7*86400000)),endDate:date(now)}},900000],
   ['darkFlow','equities/tool/dark-flow',{filter}],['marketWide','options/tool/gainers-losers',{},300000],
   ['news','news/tool/news-articles',{filter:{tickers:[symbol]},size:50},300000],
  ];
  // Sequential, bounded calls avoid the provider burst limit and stop spending quota on a 429.
  for(const [name,path,body,ttl] of specs)base.datasets[name]=Date.now()<budgetEnd?await this.request(path,body,ttl):{status:"DEFERRED",data:null,error:"Request budget reached; remaining datasets refresh on the next request"};
  const raw=(base.datasets.orderFlow.data as J)?.data;base.prints=normalizeQuantPrints(Array.isArray(raw)?raw:[],symbol);
  if(Array.isArray(raw))for(const row of raw){const t=finite(row?.tradeTime);if(row?.ticker===symbol&&row.id!=null&&t!==null&&t>Date.now()-7*86400000&&t<=Date.now()+60000)await this.db.prepare('INSERT INTO quant_data_prints(provider_id,symbol,event_at,payload) VALUES(?,?,?,?::jsonb) ON CONFLICT(provider_id) DO NOTHING').bind(symbol+':'+String(row.id),symbol,new Date(t).toISOString(),JSON.stringify(row)).run();}
  const history=await this.db.prepare("SELECT payload FROM quant_data_prints WHERE symbol=? AND event_at>CURRENT_TIMESTAMP-INTERVAL '7 days' ORDER BY event_at DESC LIMIT 500").bind(symbol).all<{payload:J}>();
  base.datasets.observedHistory={status:history.results.length?'AVAILABLE':'UNAVAILABLE',data:{data:history.results.map(r=>r.payload)},error:history.results.length?undefined:'No stored flow observations yet; not a complete historical tape'};
  const expiry=base.prints.map(p=>p.expiration).filter((v):v is string=>!!v&&v>=date(now)).sort()[0];
  base.datasets.maxPain=expiry&&Date.now()<budgetEnd?await this.request('options/tool/max-pain',{filter:{...filter,expirationDate:expiry}},900000):{status:'UNAVAILABLE',data:null,error:'No verified current expiration in the flow sample'};
  const current=base.prints.filter(p=>p.conviction!==null);base.conviction=current.length?Math.round(current.reduce((s,p)=>s+p.conviction!,0)/current.length):null;
  const directions=new Set(current.map(p=>p.direction));base.direction=directions.size===0?'UNKNOWN':directions.size===1?[...directions][0]:'MIXED';
  base.markers=base.prints.filter(p=>p.time&&p.underlyingPrice!==null&&p.premium!==null&&p.premium>=100000).map(p=>({id:p.id,kind:p.kind,time:p.time,price:p.underlyingPrice!,label:`${p.kind} · $${p.premium?.toLocaleString()} premium · ${p.execution}`}));
  const dp=(base.datasets.darkPool.data as J)?.data||{};for(const [price,cell] of Object.entries(dp) as [string,J][]){if(finite(price)!==null&&finite(cell.notionalValue)!==null)base.markers.push({id:`dp:${price}`,kind:'DARK_POOL_LEVEL',time:null,price:Number(price),label:`Dark pool $${Number(price).toFixed(2)} · 7-day aggregate`})}
  const exposure=(base.datasets.GAMMA.data as J)?.data?.[symbol]?.exposureMap||{},walls=new Map<number,number>();for(const strikes of Object.values(exposure) as J[])for(const [price,cell] of Object.entries(strikes) as [string,J][]){if(finite(price)!==null)walls.set(Number(price),(walls.get(Number(price))||0)+Math.abs(finite(cell.callExposure)||0)+Math.abs(finite(cell.putExposure)||0))}
  for(const [price] of [...walls].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,3))base.markers.push({id:`gex:${price}`,kind:'GEX_WALL',time:null,price,label:`Gross gamma concentration $${price.toFixed(2)} · dealer sign unverified`});
  const oiData=(base.datasets.openInterest.data as J)?.data||{};
  for(const [type,field] of [['CALL','callOpenInterest'],['PUT','putOpenInterest']]){
   const top=Object.entries(oiData).filter(([price,cell])=>Number(price)>0&&Number((cell as J)[field])>0).sort((a,b)=>Number((b[1] as J)[field])-Number((a[1] as J)[field]))[0];
   if(top)base.markers.push({id:type+':oi:'+top[0],kind:type+'_WALL',time:null,price:Number(top[0]),label:type+' OI concentration $'+Number(top[0]).toFixed(2)+' · not proven support/resistance'});
  }
  const ranks=(base.datasets.ivRank.data as J)?.data||{};
  base.datasets.ivRankSummary={status:base.datasets.ivRank.status,data:Object.entries(ranks).map(([session,cell])=>({session,legs:Object.entries((cell as J).contractTypeToIVData||{}).map(([leg,raw])=>{const v=raw as J,lo=finite(v.windowMinIv),hi=finite(v.windowMaxIv),last=finite(v.lastIv);return {leg,iv:last,rankPercent:lo!==null&&hi!==null&&last!==null&&hi>lo?100*(last-lo)/(hi-lo):null}})}))};
  const values=Object.values(base.datasets);base.status=values.every(v=>v.status==='AVAILABLE')?'AVAILABLE':values.some(v=>v.status==='AVAILABLE')?'PARTIAL':'UNAVAILABLE';base.retrievedAt=values.map(v=>v.retrievedAt).filter(Boolean).sort().at(-1)||null;return base;
 }
}
export async function quantDataHealth(db:PostgresDatabase){await loadRuntimeSecrets();const row=await db.prepare("SELECT payload FROM quant_data_cache WHERE cache_key='health'").first<{payload:J}>();return {...row?.payload,configured:Boolean(process.env.QUANT_DATA_API_KEY),provider:'Quant Data'};}
