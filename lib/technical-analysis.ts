export type Bar = [open:number, high:number, low:number, close:number, volume:number];

export const patternLibrary = {
  single:["Doji","Long-legged doji","Dragonfly doji","Gravestone doji","Spinning top","Hammer","Inverted hammer","Hanging man","Shooting star","Marubozu"],
  two:["Bullish engulfing","Bearish engulfing","Piercing line","Dark cloud cover","Tweezer bottom","Tweezer top","Bullish harami","Bearish harami","Inside bar","Outside bar"],
  three:["Morning star","Evening star","Morning doji star","Evening doji star","Three white soldiers","Three black crows","Three inside up","Three inside down","Abandoned baby"],
  continuation:["Rising three methods","Falling three methods","Mat hold","Upside Tasuki gap","Downside Tasuki gap"],
  traps:["Bull trap","Bear trap","Liquidity sweep high","Liquidity sweep low","Failed breakout","Failed breakdown"],
};

const body=(b:Bar)=>Math.abs(b[3]-b[0]);
const range=(b:Bar)=>Math.max(.0001,b[1]-b[2]);
const bull=(b:Bar)=>b[3]>b[0];
const avg=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
const sma=(bars:Bar[],n:number)=>avg(bars.slice(-n).map(b=>b[3]));

export function recognizePatterns(bars:Bar[]){
  if(bars.length<3)return [] as Array<{name:string;bias:"bullish"|"bearish"|"neutral";quality:number;evidence:string}>;
  const a=bars.at(-3)!,b=bars.at(-2)!,c=bars.at(-1)!, prior=bars.slice(-13,-3), priorHigh=Math.max(...prior.map(x=>x[1])),priorLow=Math.min(...prior.map(x=>x[2]));
  const volumeRatio=c[4]/Math.max(1,avg(bars.slice(-21,-1).map(x=>x[4]))), trend=c[3]>sma(bars,Math.min(20,bars.length))?"up":"down";
  const found:Array<{name:string;bias:"bullish"|"bearish"|"neutral";quality:number;evidence:string}>=[];
  const add=(name:string,bias:"bullish"|"bearish"|"neutral",raw:number,evidence:string)=>found.push({name,bias,quality:Math.max(1,Math.min(99,Math.round(raw))),evidence});
  const contextual=(base:number,bias:"bullish"|"bearish")=>base+(volumeRatio>=1.2?10:0)+((bias==="bullish"&&trend==="down")||(bias==="bearish"&&trend==="up")?7:0);
  const tiny=body(c)/range(c)<=.1, upper=c[1]-Math.max(c[0],c[3]), lower=Math.min(c[0],c[3])-c[2];
  if(tiny)add(lower>range(c)*.55?"Dragonfly doji":upper>range(c)*.55?"Gravestone doji":upper+lower>range(c)*.75?"Long-legged doji":"Doji","neutral",58+(volumeRatio>1.2?8:0),`Body is ${(body(c)/range(c)*100).toFixed(0)}% of range; ${volumeRatio.toFixed(2)}× relative volume.`);
  else if(body(c)/range(c)<.3)add("Spinning top","neutral",52,`Small real body shows indecision; context is ${trend}trend.`);
  if(lower>body(c)*2&&upper<body(c))add(trend==="down"?"Hammer":"Hanging man",trend==="down"?"bullish":"bearish",contextual(65,trend==="down"?"bullish":"bearish"),"Long lower rejection wick; next-candle confirmation is required.");
  if(upper>body(c)*2&&lower<body(c))add(trend==="down"?"Inverted hammer":"Shooting star",trend==="down"?"bullish":"bearish",contextual(65,trend==="down"?"bullish":"bearish"),"Long upper rejection wick; location and follow-through determine validity.");
  if(body(c)/range(c)>.88)add("Marubozu",bull(c)?"bullish":"bearish",contextual(67,bull(c)?"bullish":"bearish"),"Body occupies most of the candle range, showing directional control.");
  if(!bull(b)&&bull(c)&&c[0]<=b[3]&&c[3]>=b[0])add("Bullish engulfing","bullish",contextual(72,"bullish"),"Current real body fully engulfs the prior bearish body.");
  if(bull(b)&&!bull(c)&&c[0]>=b[3]&&c[3]<=b[0])add("Bearish engulfing","bearish",contextual(72,"bearish"),"Current real body fully engulfs the prior bullish body.");
  if(c[1]>b[1]&&c[2]<b[2])add("Outside bar",bull(c)?"bullish":"bearish",66,"Range expands beyond both sides of the prior candle.");
  if(c[1]<b[1]&&c[2]>b[2])add("Inside bar","neutral",58,"Range contracts inside the prior candle; wait for a confirmed break.");
  if(Math.abs(c[2]-b[2])/range(c)<.08)add("Tweezer bottom","bullish",contextual(60,"bullish"),"Two candles rejected a similar low.");
  if(Math.abs(c[1]-b[1])/range(c)<.08)add("Tweezer top","bearish",contextual(60,"bearish"),"Two candles rejected a similar high.");
  if(!bull(a)&&body(b)<body(a)*.45&&bull(c)&&c[3]>(a[0]+a[3])/2)add(tiny?"Morning doji star":"Morning star","bullish",contextual(78,"bullish"),"Three-candle reversal sequence closed back through the first candle midpoint.");
  if(bull(a)&&body(b)<body(a)*.45&&!bull(c)&&c[3]<(a[0]+a[3])/2)add(tiny?"Evening doji star":"Evening star","bearish",contextual(78,"bearish"),"Three-candle reversal sequence closed back through the first candle midpoint.");
  if([a,b,c].every(bull)&&b[3]>a[3]&&c[3]>b[3])add("Three white soldiers","bullish",contextual(76,"bullish"),"Three advancing bullish closes show sustained demand.");
  if([a,b,c].every(x=>!bull(x))&&b[3]<a[3]&&c[3]<b[3])add("Three black crows","bearish",contextual(76,"bearish"),"Three declining bearish closes show sustained supply.");
  if(c[1]>priorHigh&&c[3]<priorHigh)add("Liquidity sweep high","bearish",contextual(81,"bearish"),"Price traded above the prior range but closed back below it.");
  if(c[2]<priorLow&&c[3]>priorLow)add("Liquidity sweep low","bullish",contextual(81,"bullish"),"Price traded below the prior range but closed back above it.");
  if(b[3]>priorHigh&&c[3]<priorHigh)add("Bull trap","bearish",contextual(86,"bearish"),"Prior breakout failed acceptance and returned inside the range.");
  if(b[3]<priorLow&&c[3]>priorLow)add("Bear trap","bullish",contextual(86,"bullish"),"Prior breakdown failed acceptance and reclaimed the range.");
  return found.sort((x,y)=>y.quality-x.quality).slice(0,5);
}

export function probabilityEngine(bars:Bar[],strategy:"swing"|"position"="swing"){
  const frames=["Monthly","Weekly","Daily","4H","2H","1H","30m","15m","10m","5m","3m","2m","1m"];
  const weights=strategy==="swing"?[2,5,16,18,12,14,8,8,5,4,3,3,2]:[16,20,22,12,8,7,4,3,2,2,1,1,1];
  const latest=bars.at(-1)!, relVol=latest[4]/Math.max(1,avg(bars.slice(-21,-1).map(x=>x[4]))), atr=avg(bars.slice(-14).map(range));
  const rows=frames.map((frame,i)=>{const lookback=Math.max(3,Math.min(bars.length-1,Math.round(3+i*1.5))),reference=bars.at(-lookback)!,change=(latest[3]-reference[3])/reference[3],ma= sma(bars,Math.min(bars.length,Math.max(3,lookback)));const score=Math.round(50+Math.max(-24,Math.min(24,change*220))+(latest[3]>ma?9:-9)+(relVol>1.15?Math.sign(change||1)*5:0));return{frame,weight:weights[i],score:Math.max(5,Math.min(95,score)),bias:score>=56?"Bullish":score<=44?"Bearish":"Neutral",available:bars.length>=lookback+2};});
  const available=rows.filter(r=>r.available), weighted=available.reduce((s,r)=>s+r.score*r.weight,0)/Math.max(1,available.reduce((s,r)=>s+r.weight,0));
  const disagreement=available.some(r=>r.bias==="Bullish")&&available.some(r=>r.bias==="Bearish"), patterns=recognizePatterns(bars), best=patterns[0];
  return {rows,probability:Math.round(weighted),disagreement,relVol,atr,patterns,best,confirmation:`Close above ${latest[1].toFixed(2)} with relative volume above 1.20×`,invalidation:`Close below ${(latest[2]-atr*.25).toFixed(2)} or failed range acceptance`,timestamp:new Date().toISOString()};
}
