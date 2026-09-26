import {exchangeDay} from '@/lib/exchange-calendar';
// Every contract in a chain shares the exchange session; compute the calendar once per minute.
const windows=new Map<number,{regular:boolean;supported:boolean;close:number}>();
function sessionWindow(now:number){const key=Math.floor(now/60000),cached=windows.get(key);if(cached)return cached;const current=exchangeDay(now);let close=0;
 if(current.supported)for(let days=0;days<8;days++){const date=new Date(now-days*86400000);for(const hour of [17,18,20,21]){const time=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),hour),day=exchangeDay(time);if(time<=now&&day.tradingDay&&day.minute===day.closeMinute)close=Math.max(close,time);}}
 const result={regular:current.tradingDay&&current.minute>=570&&current.minute<current.closeMinute,supported:current.supported,close};if(windows.size>=4)windows.delete(windows.keys().next().value!);windows.set(key,result);return result;
}
/** Completed-session observations are research evidence, never execution authorization. */
export function researchMarketFresh(asOf:string,liveLimitMs:number,now=Date.now()){
 const observed=Date.parse(asOf),age=now-observed;if(!Number.isFinite(age)||age<0)return false;if(age<=liveLimitMs)return true;
 const window=sessionWindow(now);return window.supported&&!window.regular&&window.close>0&&observed>=window.close-20*60000&&observed<=now;
}
