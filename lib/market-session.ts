import {exchangeDay} from '@/lib/exchange-calendar';
import type{MarketSession}from"@/lib/providers/market-data";
export function marketSessionAt(value:Date|string|number):MarketSession{const day=exchangeDay(value);if(!day.tradingDay)return 'CLOSED';if(day.minute>=240&&day.minute<570)return 'PREMARKET';if(day.minute>=570&&day.minute<day.closeMinute)return 'REGULAR';if(day.minute>=day.closeMinute&&day.minute<day.extendedCloseMinute)return 'AFTER_HOURS';return 'CLOSED'}
export function formatMarketTime(value:string,timeZone:string){try{return new Intl.DateTimeFormat("en-US",{timeZone,weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(value))}catch{return new Intl.DateTimeFormat("en-US",{timeZone:"America/Phoenix",weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(value))}}

