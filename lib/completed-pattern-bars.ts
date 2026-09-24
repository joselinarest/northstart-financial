import type {PatternBar} from './pattern-evidence';
export function completedPatternBars(bars:PatternBar[],timeframe:string,now=Date.now()){
 const parts=(time:number)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time)).map(p=>[p.type,p.value]));
 const current=parts(now),day=(p:Record<string,string>)=>`${p.year}-${p.month}-${p.day}`;
 const duration=({'1m':60000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1Week':604800000} as Record<string,number>)[timeframe]||86400000;
 return bars.filter(b=>{
  const time=Date.parse(b.time);if(!Number.isFinite(time)||time>now)return false;
  if(timeframe!=='1Day')return time+duration<=now;
  const candleDay=day(parts(time)),today=day(current);
  // Conservatively wait until 16:00 NY even on early-close sessions.
  return candleDay<today||(candleDay===today&&Number(current.hour)>=16);
 });
}
