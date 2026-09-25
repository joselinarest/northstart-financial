import {exchangeDay} from '@/lib/exchange-calendar';
/** Completed regular-session observations remain usable for research until the next open. This never confirms an entry/order. */
export function researchMarketFresh(asOf:string,liveLimitMs:number,now=Date.now()){
 const observed=Date.parse(asOf),age=now-observed;if(!Number.isFinite(age)||age<0)return false;
 if(age<=liveLimitMs)return true;
 const current=exchangeDay(now);if(!current.supported||(current.tradingDay&&current.minute>=570&&current.minute<current.closeMinute))return false;
 let close=0;
 for(let days=0;days<8;days++){const date=new Date(now-days*86400000);for(const hour of [17,18,20,21]){const time=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),hour),day=exchangeDay(time);if(time<=now&&day.tradingDay&&day.minute===day.closeMinute)close=Math.max(close,time);}}
 return close>0&&observed>=close-20*60000&&observed<=now;
}
