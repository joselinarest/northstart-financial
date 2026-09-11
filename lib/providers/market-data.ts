export type MarketFeed="sip"|"iex"|"delayed_sip"|"indicative"|string;
export type DataFreshness="FRESH"|"DELAYED"|"STALE"|"UNAVAILABLE";
export type MarketSession="PREMARKET"|"REGULAR"|"AFTER_HOURS"|"CLOSED";
export type NormalizedQuote={symbol:string;bid:number|null;ask:number|null;last:number|null;bidSize:number|null;askSize:number|null;open:number|null;high:number|null;low:number|null;volume:number|null;timestamp:string|null;source:string;feed:MarketFeed;freshness:DataFreshness;ageSeconds:number|null};
export type NormalizedBar={time:string;open:number;high:number;low:number;close:number;volume:number;vwap:number|null;tradeCount:number|null};
export type MarketClock={timestamp:string;isOpen:boolean;nextOpen:string;nextClose:string;session:MarketSession;source:string};
export interface MarketDataProvider{readonly name:string;getClock():Promise<MarketClock>;getQuotes(symbols:string[]):Promise<{feed:MarketFeed;asOf:string;quotes:Record<string,NormalizedQuote>}>;getBars(symbol:string,input:{timeframe:string;start:string;limit:number}):Promise<{feed:MarketFeed;asOf:string;bars:NormalizedBar[]}>}
export class MarketProviderError extends Error{constructor(message:string,public status=502,public code="MARKET_PROVIDER_ERROR"){super(message)}}
export const normalizeSymbols=(raw:string,max=50)=>[...new Set(raw.toUpperCase().split(",").map(value=>value.trim()).filter(value=>/^[A-Z0-9.-]{1,12}$/.test(value)))].slice(0,max);
export function freshness(timestamp:string|null,session:MarketSession,now=Date.now()):{freshness:DataFreshness;ageSeconds:number|null}{if(!timestamp)return{freshness:"UNAVAILABLE",ageSeconds:null};const age=Math.max(0,Math.floor((now-Date.parse(timestamp))/1000));if(!Number.isFinite(age))return{freshness:"UNAVAILABLE",ageSeconds:null};const freshLimit=session==="REGULAR"?20:session==="PREMARKET"||session==="AFTER_HOURS"?90:86400,delayedLimit=session==="REGULAR"?120:session==="PREMARKET"||session==="AFTER_HOURS"?600:259200;return{freshness:age<=freshLimit?"FRESH":age<=delayedLimit?"DELAYED":"STALE",ageSeconds:age}}

