import {createHash} from 'node:crypto';
import {discoveryFinnhub} from './discovery-queue';
import {barsFor} from './market-discovery-engine';
import {providerSignal} from './work-budget';
import {marketDataProvider} from './providers/alpaca-market-data';
import type {PostgresDatabase} from './db';
type Row=Record<string,any>;
export const macroSeries=[['DGS10','10-year Treasury yield','percentage points'],['DGS2','2-year Treasury yield','percentage points'],['T10YIE','10-year inflation expectation','percentage points'],['DCOILWTICO','WTI spot oil','USD/barrel'],['VIXCLS','VIX close','index'],['DTWEXBGS','Broad US dollar','index'],['GOLDAMGBD228NLBM','London gold','USD/oz']] as const;
const themes=[
 {id:'AI_CLOUD',pattern:/\b(ai|artificial intelligence|cloud|data cent[er]+|hyperscaler)\b.*\b(deal|contract|invest|demand|capacity|partnership)/i,industries:/semiconductor|network|electrical|power|software|computer|infrastructure/i,reason:'Reported AI/cloud demand may affect suppliers and infrastructure. Exposure and economics require independent verification.'},
 {id:'OIL',pattern:/\b(oil|crude|opec)\b/i,industries:/oil|gas|energy|airline|transport|chemical/i,reason:'Oil changes can affect producer revenue and fuel/feedstock costs in opposite directions; confirm company exposure.'},
 {id:'RATES',pattern:/\b(treasury|yields?|interest rates?|federal reserve)\b/i,industries:/bank|financial|real estate|reit|utilit|software|technology/i,reason:'Rate changes can affect discount rates, refinancing costs and interest margins; direction depends on company exposure.'},
 {id:'ANALYST',pattern:/\b(upgrade|downgrade|price target|analyst)\b/i,industries:null,reason:'Analyst action is company-specific unless independent industry evidence supports a broader effect.'},
];
export function eventHypotheses(events:Row[],universe:Row[]){
 const edges:Row[]=[];
 for(const event of events){const theme=themes.find(t=>t.pattern.test(event.headline||''));if(!theme)continue;
  for(const asset of universe){const direct=(event.related||[]).includes(asset.symbol),sector=String(asset.sector||asset.industry||'');
   if(!direct&&!(theme.industries&&sector&&theme.industries.test(sector)))continue;
   edges.push({eventId:event.id,symbol:asset.symbol,theme:theme.id,relationship:direct?'DIRECT':'INDUSTRY_HYPOTHESIS',source:event.url,headline:event.headline,publishedAt:event.publishedAt,reason:theme.reason,rankingAdjustment:direct?8:3,requiresIndependentResearch:true});
  }
 }return edges;
}
export function materialContextChange(previous:Row,next:Row){
 const changes:string[]=[];
 for(const row of next.series||[]){const old=previous.series?.find((v:Row)=>v.id===row.id);if(!old||row.value==null||old.value==null||Date.parse(row.date)<=Date.parse(old.date))continue;
 const delta=row.value-old.value,threshold=/DGS|T10YIE/.test(row.id)?.08:row.id==='VIXCLS'?2:Math.abs(old.value)*.02;if(Math.abs(delta)>=threshold)changes.push(`${row.label}: ${old.value} → ${row.value} (${row.date})`);}
 for(const row of next.markets||[]){const old=previous.markets?.find((v:Row)=>v.symbol===row.symbol);if(old?.price>0&&row.price>0&&Date.parse(row.asOf)>Date.parse(old.asOf)&&Math.abs(row.price/old.price-1)>=.01)changes.push(`${row.symbol} changed at least 1% since the previous research snapshot`);}
 const prior=new Set((previous.events||[]).map((e:Row)=>e.id));for(const event of next.events||[])if(!prior.has(event.id)&&/earnings|guidance|deal|contract|downgrade|upgrade|inflation|tariff|war|oil|yield/i.test(event.headline))changes.push(event.headline);
 return changes.slice(0,20);
}
export async function nextSessionContext(db:PostgresDatabase,closeAt:string){
 const errors:Row={},series:Row[]=await Promise.all(macroSeries.map(async([id,label,unit])=>{
  try{if(!process.env.FRED_API_KEY)throw Error('FRED_NOT_CONFIGURED');const params=new URLSearchParams({series_id:id,file_type:'json',sort_order:'desc',limit:'10',api_key:process.env.FRED_API_KEY});
   const response=await fetch('https://api.stlouisfed.org/fred/series/observations?'+params,{signal:providerSignal(8000)});if(!response.ok)throw Error('FRED_'+response.status);
   const data=await response.json(),values=(data.observations||[]).filter((r:Row)=>r.value!=='.'&&Number.isFinite(Number(r.value)));if(!values.length)throw Error('NO_OBSERVATIONS');
   const latest=values[0],previous=values[1],ageDays=(Date.now()-Date.parse(latest.date))/86400000;return {id,label,unit,value:Number(latest.value),previous:previous?Number(previous.value):null,change:previous?Number(latest.value)-Number(previous.value):null,date:latest.date,status:ageDays>7?'STALE':'AVAILABLE',source:'https://fred.stlouisfed.org/series/'+id};
  }catch(e){errors[id]=String(e instanceof Error?e.message:e);return {id,label,unit,value:null,date:null,status:'UNAVAILABLE'};}
 }));
 const symbols=['SPY','QQQ','IWM','DIA','XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLU','XLB','XLRE','XLC'];let markets:Row[]=[];
 try{const bars=await barsFor(symbols,{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY||'','APCA-API-SECRET-KEY':process.env.ALPACA_API_SECRET||''});markets=symbols.map(symbol=>{const history=(bars[symbol]||[]).filter(b=>b.t.slice(0,10)<=closeAt.slice(0,10)),last=history.at(-1),prior=history.at(-2);return {symbol,price:last?.c??null,changePct:last&&prior?100*(last.c/prior.c-1):null,asOf:last?.t??null,source:'Alpaca daily bars',status:last?'AVAILABLE':'UNAVAILABLE'};});}catch(e){errors.INDEX_SECTOR=String(e instanceof Error?e.message:e);}
 try{const quotes=await marketDataProvider().getQuotes(symbols);markets=markets.map(row=>{const q=quotes.quotes[row.symbol];return {...row,lastRegularClose:row.price,closeAsOf:row.asOf,...(q?.last&&q.timestamp?{price:q.last,asOf:q.timestamp,priceBasis:q.priceBasis,feed:quotes.feed}:{})};});}catch{errors.EXTENDED_QUOTES='Supported extended-session quotes unavailable; completed close retained';}
 let events:Row[]=[];try{const response=await discoveryFinnhub(db,'/news?category=general',300);events=(Array.isArray(response.data)?response.data:[]).filter((e:Row)=>Date.now()-Number(e.datetime)*1000<3*86400000).slice(0,100).map((e:Row)=>({id:createHash('sha256').update(String(e.id||e.url||e.headline)).digest('hex').slice(0,24),headline:e.headline,url:e.url,publishedAt:new Date(Number(e.datetime)*1000).toISOString(),related:String(e.related||'').split(',').map((s:string)=>s.trim()).filter(Boolean)}));}catch(e){errors.NEWS=String(e instanceof Error?e.message:e);}
 for(const row of series)if(row.status==='AVAILABLE'&&row.change!=null&&((row.id==='DCOILWTICO'&&row.previous&&Math.abs(row.change/row.previous)>=.02)||(/^DGS/.test(row.id)&&Math.abs(row.change)>=.08)))events.push({id:row.id+':'+row.date,headline:`${row.label} ${row.change>0?'rose':'fell'} ${Math.abs(row.change).toFixed(2)} ${row.unit}`,url:row.source,publishedAt:row.date,related:[]});
 return {asOf:new Date().toISOString(),closeAt,series,markets,events,errors,limitations:['FRED values follow their own publication schedules; they are not live futures or FX quotes.','Sector ETF returns are rotation evidence, not proof of company exposure.','Event links are hypotheses, not measured changes in win probability.','Futures, live international indices, IV history and scheduled macro calendars require separately verified feeds.']};
}
