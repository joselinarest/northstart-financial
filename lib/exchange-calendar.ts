// Published NYSE cash-equity calendar. Exceptional closures still require the live provider clock.
// https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/
const holidays=new Set([
 '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
 '2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24',
 '2028-01-17','2028-02-21','2028-04-14','2028-05-29','2028-06-19','2028-07-04','2028-09-04','2028-11-23','2028-12-25',
]);
const earlyCloses=new Set(['2026-11-27','2026-12-24','2027-11-26','2028-07-03','2028-11-24']);
export function exchangeDay(value:Date|string|number){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
 const date=`${parts.year}-${parts.month}-${parts.day}`,supported=Number(parts.year)>=2026&&Number(parts.year)<=2028;
 return {date,supported,tradingDay:supported&&!['Sat','Sun'].includes(parts.weekday)&&!holidays.has(date),minute:Number(parts.hour)*60+Number(parts.minute),closeMinute:earlyCloses.has(date)?780:960,extendedCloseMinute:earlyCloses.has(date)?1020:1200};
}
