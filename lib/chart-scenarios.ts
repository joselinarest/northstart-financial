export type ScenarioBar={time:string;close:number;high:number;low:number};
/** Descriptive volatility scenarios, not a calibrated predictive model. */
export function chartScenarios(bars:ScenarioBar[]){
 if(bars.length<21)return null;
 const recent=bars.slice(-21);
 if(recent.some(b=>![b.close,b.high,b.low].every(Number.isFinite)||b.close<=0||b.high<b.low))return null;
 const last=recent.at(-1)!;
 const atr=recent.slice(-14).reduce((s,b,i)=>{const prior=recent[recent.length-15+i].close;return s+Math.max(b.high-b.low,Math.abs(b.high-prior),Math.abs(b.low-prior));},0)/14;
 if(!(atr>0))return null;
 return {asOf:last.time,anchor:last.close,atr,points:Array.from({length:5},(_,i)=>{const distance=atr*Math.sqrt(i+1);return {step:i+1,upper:last.close+distance,base:last.close,lower:Math.max(.01,last.close-distance)};}),method:'ATR(14) × square root of bars ahead; conditional volatility range, not predicted candles or calibrated probabilities.'};
}
