/** Provider-neutral evidence. A conviction score is data strength, never a trade instruction. */
export type FlowPrint = {
  id:string; symbol:string; time:string|null; kind:string; optionType:string;
  premium:number|null; contracts:number|null; volume:number|null; openInterest:number|null;
  price:number|null; underlyingPrice:number|null; strike:number|null; expiration:string|null;
  dte:number|null; iv:number|null; moneyness:string|null; execution:string;
  direction:'BULLISH'|'BEARISH'|'UNKNOWN'; conviction:number|null; reasons:string[];
};
export type FlowMarker={id:string;kind:string;price:number;time:string|null;label:string};
export type FlowEvidence={provider:string;symbol:string;status:string;retrievedAt:string|null;
  prints:FlowPrint[];markers:FlowMarker[];conviction:number|null;direction:string;
  datasets:Record<string,{status:string;data:unknown;error?:string;retrievedAt?:string}>;
  limitations:string[];canAuthorizeTrade:false};
export interface OptionsFlowProvider {getEvidence(symbol:string):Promise<FlowEvidence>}
export interface MarketStructureProvider extends OptionsFlowProvider {}
export const finite=(v:unknown):number|null=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
type Row=Record<string,any>;
export function normalizeQuantPrints(rows:Row[],symbol:string,now=Date.now(),maxAgeMs=15*60000):FlowPrint[]{
 const selected=rows.filter(r=>r&&typeof r==='object'&&r.ticker===symbol),counts=new Map<string,number>();
 for(const r of selected){const t=finite(r.tradeTime);if(t===null||t>now+60000||now-t>maxAgeMs)continue;const k=[r.contractType,r.strikePrice,r.expirationDate].join(':');counts.set(k,(counts.get(k)||0)+1)}
 return selected.map(r=>{const execution=String(r.tradeSideCode||'UNKNOWN'),type=String(r.contractType||''),rawTime=finite(r.tradeTime),time=rawTime!==null&&Math.abs(rawTime)<=8640000000000000?rawTime:null,fresh=time!==null&&time<=now+60000&&now-time<=maxAgeMs;
 const ask=['AT_ASK','ABOVE_ASK'].includes(execution),bid=['AT_BID','BELOW_BID'].includes(execution),premium=finite(r.premium),oi=finite(r.openInterest),volume=finite(r.volume),dte=finite(r.dte),iv=finite(r.impliedVolatility),money=r.moneyness?.moneyType||null;
 const direction:FlowPrint['direction']=!fresh||(!ask&&!bid)?'UNKNOWN':type==='CALL'?(ask?'BULLISH':'BEARISH'):type==='PUT'?(ask?'BEARISH':'BULLISH'):'UNKNOWN';
 const reasons=['Execution-side interpretation is provisional; opening/closing and hedges may be unknown.','Underlying trend, sector, market regime and account risk require independent confirmation.'];
 let score=0;const points=(n:number,why:string)=>{score+=n;reasons.push('+'+n+' '+why)};
 if(ask||bid)points(20,'Known bid/ask execution');if(premium!==null&&premium>=100000)points(15,'Premium at least $100,000');if(oi!==null&&oi>0&&volume!==null&&volume/oi>=1.5)points(15,'Volume/OI at least 1.5');
 if((counts.get([type,r.strikePrice,r.expirationDate].join(':'))||0)>1){score+=10;reasons.push('Repeated contract activity in this sample.')}
 if(dte!==null&&dte>0)points(5,'DTE known and positive');if(iv!==null)points(5,'IV supplied');if(money)points(5,'Moneyness supplied');
 if(!fresh)reasons.push('Print timestamp is missing or outside the strategy evidence window; not current directional evidence.');
 if(!oi)reasons.push('Open interest comparison unavailable.');
 return {id:String(r.id),symbol,time:time===null?null:new Date(time).toISOString(),kind:String(r.tradeConsolidationType||'PRINT'),optionType:type,premium,contracts:finite(r.size),volume,openInterest:oi,price:finite(r.optionPrice),underlyingPrice:finite(r.stockPrice),strike:finite(r.strikePrice),expiration:r.expirationDate||null,dte,iv,moneyness:money,execution,direction,conviction:fresh?score:null,reasons};
 });
}

export function flowForStrategy(flow:FlowEvidence,strategy:string,now=Date.now()):FlowEvidence{
 const age=/DAY|INTRADAY/i.test(strategy)?15*60000:7*86400000;
 const payload=flow.datasets.orderFlow?.data as {data?:Record<string,unknown>[]} | null;
 const historical=flow.datasets.observedHistory?.data as {data?:Record<string,unknown>[]} | null;
 const rows=[...(Array.isArray(payload?.data)?payload.data:[]),...(Array.isArray(historical?.data)?historical.data:[])];
 const unique=[...new Map(rows.filter(r=>r&&r.id!=null).map(r=>[String(r.id),r])).values()];
 const prints=normalizeQuantPrints(unique,flow.symbol,now,age);
 const scored=prints.filter(p=>p.conviction!==null),directions=new Set(scored.map(p=>p.direction));
 return {...flow,prints,conviction:scored.length?Math.round(scored.reduce((sum,p)=>sum+p.conviction!,0)/scored.length):null,direction:directions.size===0?'UNKNOWN':directions.size===1?[...directions][0]:'MIXED',limitations:[...flow.limitations,'Conviction is a transparent data-strength heuristic, not a probability of profit.','Strategy window: '+(age===15*60000?'15 minutes':'7 days')+'. Latest sample may not cover the entire window; multi-day confirmation requires observations on multiple days.']};
}
export function validateFlow(flow:FlowEvidence|null,thesis:'BULLISH'|'BEARISH'|'UNKNOWN'){
 if(!flow||!['AVAILABLE','PARTIAL'].includes(flow.status)||flow.conviction===null)return {status:'WARNING',alignment:'UNAVAILABLE',reason:'Flow evidence is unavailable or stale; other evidence must stand independently.'};
 if(thesis==='UNKNOWN'||['UNKNOWN','MIXED'].includes(flow.direction))return {status:'WARNING',alignment:'NEUTRAL',reason:'Flow does not establish a clear alignment with the underlying thesis.'};
 if(flow.direction!==thesis)return {status:flow.conviction>=60?'FAIL':'WARNING',alignment:'CONFLICTS',reason:'Execution-side flow conflicts with the underlying thesis. Investigate hedging and opening/closing context; this is not a sell instruction.'};
 return {status:flow.conviction>=60?'PASS':'WARNING',alignment:'CONFIRMS',reason:'Flow provisionally aligns with the thesis. Independent technicals, fundamentals, regime, news and account risk remain required.'};
}

/** Bounded model context; full source datasets remain in the immutable decision record. */
function metricSample(value:unknown){const out:Record<string,string|number|boolean>={};const walk=(v:unknown,path:string,depth:number)=>{if(Object.keys(out).length>=12||depth>7)return;if(v!==null&&typeof v==='object'){for(const [k,x] of Object.entries(v))walk(x,path?path+'.'+k:k,depth+1)}else if(typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean')out[path]=v as number|boolean;};walk(value,'',0);return out;}
export function flowDecisionSummary(flow:FlowEvidence){return {provider:flow.provider,symbol:flow.symbol,status:flow.status,retrievedAt:flow.retrievedAt,direction:flow.direction,conviction:flow.conviction,prints:flow.prints.slice(0,20),markers:flow.markers.slice(0,20),datasets:Object.fromEntries(Object.entries(flow.datasets).map(([name,d])=>[name,{status:d.status,retrievedAt:d.retrievedAt,error:d.error,metricSample:metricSample(d.data)}])),limitations:flow.limitations,canAuthorizeTrade:false};}
