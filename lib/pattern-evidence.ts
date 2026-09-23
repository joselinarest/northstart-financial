/** Deterministic, versioned geometry evidence. Quality is a heuristic score, not a probability. */
export type PatternBar = {time:string;open:number;high:number;low:number;close:number;volume:number};
export type PatternContext = {timeframe:string;market?:'UP'|'DOWN'|'NEUTRAL';sector?:'UP'|'DOWN'|'NEUTRAL';newsClear?:boolean;fundamentalsValid?:boolean;fundamentalsRequired?:boolean;riskApproved?:boolean;dataFresh?:boolean};
export type PatternEvidence = {id:string;version:string;name:string;timeframe:string;direction:'UP'|'DOWN'|'NEUTRAL';quality:number;confirmationLevel:number;invalidationLevel:number;volumeConfirmation:'CONFIRMED'|'MISSING';relativeVolume:number;trendAlignment:string;marketAlignment:string;sectorAlignment:string;falseBreakoutRisk:'HIGH'|'MEDIUM'|'LOW';validation:'PASS'|'WARNING'|'FAIL';missingConfirmation:string[];startTime:string;endTime:string;anchors:{time:string;price:number}[];executionAllowed:false};
const mean=(v:number[])=>v.reduce((s,x)=>s+x,0)/(v.length||1);
export function detectPatternEvidence(input:PatternBar[],context:PatternContext):PatternEvidence[]{
  // Reject malformed, unordered or duplicate candles instead of fabricating a pattern.
  if(input.length<25||!context.timeframe||input.some((b,i)=>![b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.low<=0||b.volume<0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close)||!Number.isFinite(Date.parse(b.time))||(i>0&&Date.parse(b.time)<=Date.parse(input[i-1].time))))return [];
  const bars=input.slice(-160),n=bars.length,last=bars[n-1],prev=bars[n-2],third=bars[n-3];
  const atr=mean(bars.slice(-14).map((b,i)=>{const prior=bars[n-14+i-1]?.close??b.open;return Math.max(b.high-b.low,Math.abs(b.high-prior),Math.abs(b.low-prior));}));
  if(!(atr>0))return [];
  const tol=atr*.6,vol=mean(bars.slice(-21,-1).map(b=>b.volume)),rv=vol>0?last.volume/vol:0;
  const slope=mean(bars.slice(-10).map(b=>b.close))-mean(bars.slice(-25,-15).map(b=>b.close));
  const trend=slope>atr?'UP':slope< -atr?'DOWN':'NEUTRAL',out:PatternEvidence[]=[];
  const add=(name:string,direction:PatternEvidence['direction'],confirmation:number,invalidation:number,start:number,quality=65,anchors?:PatternEvidence['anchors'])=>{
    if(!Number.isFinite(confirmation)||!Number.isFinite(invalidation)||confirmation<=0||invalidation<=0||confirmation===invalidation)return;
    if(direction==='UP'&&confirmation<=invalidation||direction==='DOWN'&&confirmation>=invalidation)return;
    const broken=direction==='UP'?last.close<invalidation:direction==='DOWN'?last.close>invalidation:false;
    const confirmed=direction==='UP'?last.close>confirmation:direction==='DOWN'?last.close<confirmation:false;
    const aligned=(value:string|undefined)=>!value?'UNKNOWN':value===direction?'ALIGNED':'OPPOSED';
    const missing:string[]=[];
    if(!confirmed)missing.push(direction==='NEUTRAL'?'Wait for a directional break':`Wait for a completed candle ${direction==='UP'?'above':'below'} ${confirmation.toFixed(2)}`);
    if(rv<1.2)missing.push('Volume must reach 1.2× the prior 20-bar average');
    if(aligned(trend)!=='ALIGNED')missing.push('Independent trend confirmation');
    if(aligned(context.market)!=='ALIGNED')missing.push('Market regime confirmation');
    if(aligned(context.sector)!=='ALIGNED')missing.push('Sector confirmation');
    if(context.newsClear!==true)missing.push('News and catalyst review');
    if(context.fundamentalsRequired!==false&&context.fundamentalsValid!==true)missing.push('Fundamental thesis validation');
    if(context.riskApproved!==true)missing.push('Account risk and position sizing approval');
    if(context.dataFresh!==true)missing.push('Fresh, completed provider candles');
    if(broken)missing.unshift('Pattern invalidated by price');
    out.push({id:`${context.timeframe}:${name}:${last.time}`,version:'patterns-1',name,timeframe:context.timeframe,direction,quality:Math.max(0,Math.min(100,quality)),confirmationLevel:confirmation,invalidationLevel:invalidation,relativeVolume:Math.round(rv*100)/100,volumeConfirmation:rv>=1.2?'CONFIRMED':'MISSING',trendAlignment:aligned(trend),marketAlignment:aligned(context.market),sectorAlignment:aligned(context.sector),falseBreakoutRisk:broken||rv<1.2||!confirmed?'HIGH':missing.length?'MEDIUM':'LOW',validation:broken?'FAIL':missing.length?'WARNING':'PASS',missingConfirmation:missing,startTime:bars[Math.max(0,start)].time,endTime:last.time,anchors:anchors||[{time:bars[Math.max(0,start)].time,price:confirmation},{time:last.time,price:confirmation}],executionAllowed:false});
  };
  const body=(b:PatternBar)=>Math.abs(b.close-b.open),range=(b:PatternBar)=>b.high-b.low;
  const up=last.close>last.open,down=last.close<last.open,lower=Math.min(last.open,last.close)-last.low,upper=last.high-Math.max(last.open,last.close);
  const candle=(name:string,d:PatternEvidence['direction'],start=n-1)=>add(name,d,d==='DOWN'?last.low:last.high,d==='DOWN'?last.high:last.low,start);
  if(body(last)<=range(last)*.1)candle('Doji','NEUTRAL');
  if(body(last)>range(last)*.1&&lower>=body(last)*2&&upper<=range(last)*.2)candle('Hammer','UP');
  if(body(last)>range(last)*.1&&upper>=body(last)*2&&lower<=range(last)*.2)candle('Shooting Star','DOWN');
  if(up&&prev.close<prev.open&&last.open<=prev.close&&last.close>=prev.open)candle('Bullish Engulfing','UP',n-2);
  if(down&&prev.close>prev.open&&last.open>=prev.close&&last.close<=prev.open)candle('Bearish Engulfing','DOWN',n-2);
  if(last.high<prev.high&&last.low>prev.low)add('Inside Bar','NEUTRAL',prev.high,prev.low,n-2);
  if(third.close<third.open&&body(third)>atr*.5&&body(prev)<body(third)*.4&&up&&last.close>(third.open+third.close)/2)candle('Morning Star','UP',n-3);
  if(third.close>third.open&&body(third)>atr*.5&&body(prev)<body(third)*.4&&down&&last.close<(third.open+third.close)/2)candle('Evening Star','DOWN',n-3);
  if(last.low>prev.high+atr*.2)add('Gap Up','UP',prev.high,prev.low,n-2,70);
  if(last.high<prev.low-atr*.2)add('Gap Down','DOWN',prev.low,prev.high,n-2,70);
  const window=bars.slice(-21,-1),resistance=Math.max(...window.map(b=>b.high)),support=Math.min(...window.map(b=>b.low));
  if(last.close>resistance)add('Range Breakout','UP',resistance,support,n-21,75);
  if(last.close<support)add('Range Breakout','DOWN',support,resistance,n-21,75);
  if(last.low<=support+tol&&last.low>=support-tol&&up&&last.close>support+tol)add('Support Bounce','UP',last.high,support-tol,n-21);
  if(last.high>=resistance-tol&&last.high<=resistance+tol&&down&&last.close<resistance-tol)add('Resistance Rejection','DOWN',last.low,resistance+tol,n-21);
  const old=bars.slice(-26,-6),oldHigh=Math.max(...old.map(b=>b.high)),oldLow=Math.min(...old.map(b=>b.low));
  if(bars.slice(-6,-1).some(b=>b.close>oldHigh+tol)&&last.low>=oldHigh-tol&&last.low<=oldHigh+tol&&last.close>oldHigh)add('Breakout-Retest','UP',Math.max(oldHigh,prev.high),oldHigh-tol,n-26,75);
  if(bars.slice(-6,-1).some(b=>b.close<oldLow-tol)&&last.high<=oldLow+tol&&last.high>=oldLow-tol&&last.close<oldLow)add('Breakout-Retest','DOWN',Math.min(oldLow,prev.low),oldLow+tol,n-26,75);
  // Confirm pivots with two subsequent bars: no repainting from unconfirmed last-bar extrema.
  const highs:number[]=[],lows:number[]=[];
  for(let i=2;i<n-2;i++){if([i-2,i-1,i+1,i+2].every(j=>bars[i].high>bars[j].high))highs.push(i);if([i-2,i-1,i+1,i+2].every(j=>bars[i].low<bars[j].low))lows.push(i);}
  for(const isTop of [true,false]){
    const pivots=(isTop?highs:lows).filter(i=>i>=n-65),value=(i:number)=>isTop?bars[i].high:bars[i].low;
    const a=pivots.at(-2),b=pivots.at(-1);
    if(a!==undefined&&b!==undefined&&b-a>=5&&n-b<=15){
      const neck=isTop?Math.min(...bars.slice(a,b+1).map(x=>x.low)):Math.max(...bars.slice(a,b+1).map(x=>x.high));
      if(Math.abs(value(a)-value(b))<=tol&&Math.abs(value(a)-neck)>=atr*2)add(isTop?'Double Top':'Double Bottom',isTop?'DOWN':'UP',neck,isTop?Math.max(value(a),value(b))+tol:Math.min(value(a),value(b))-tol,a,75,[a,b].map(i=>({time:bars[i].time,price:value(i)})));
      const c=pivots.at(-3);
      if(c!==undefined&&a-c>=4&&Math.abs(value(c)-value(b))<=tol*1.5&&(isTop?value(a)-Math.max(value(c),value(b)):Math.min(value(c),value(b))-value(a))>=atr){
        const left=isTop?Math.min(...bars.slice(c,a+1).map(x=>x.low)):Math.max(...bars.slice(c,a+1).map(x=>x.high));
        add(isTop?'Head and Shoulders':'Inverse Head and Shoulders',isTop?'DOWN':'UP',(neck+left)/2,isTop?value(a)+tol:value(a)-tol,c,75,[c,a,b].map(i=>({time:bars[i].time,price:value(i)})));
      }
    }
  }
  const h=highs.filter(i=>i>=n-45).slice(-3),l=lows.filter(i=>i>=n-45).slice(-3);
  if(h.length===3&&l.length===3&&Math.max(h[0],l[0])<Math.min(h[2],l[2])){
    const hd=bars[h[2]].high-bars[h[0]].high,ld=bars[l[2]].low-bars[l[0]].low;
    const top=bars[h[2]].high,bottom=bars[l[2]].low,start=Math.min(h[0],l[0]);
    if(top>bottom){
      if(Math.abs(hd)<=tol&&ld>atr)add('Ascending Triangle','UP',Math.max(...h.map(i=>bars[i].high)),bottom-tol,start,70);
      if(hd< -atr&&Math.abs(ld)<=tol)add('Descending Triangle','DOWN',Math.min(...l.map(i=>bars[i].low)),top+tol,start,70);
      if(hd< -atr&&ld>atr)add('Symmetrical Triangle','NEUTRAL',top,bottom,start,70);
      if(hd>atr&&ld>atr)add('Higher Highs / Higher Lows','UP',top,bottom-tol,start,70);
      if(hd< -atr&&ld< -atr)add('Lower Highs / Lower Lows','DOWN',bottom,top+tol,start,70);
    }
  }
  if(n>=40){
    const poleStart=bars[n-18].close,poleEnd=bars[n-8].close,pole=poleEnd-poleStart,flag=bars.slice(-7,-1),fh=Math.max(...flag.map(b=>b.high)),fl=Math.min(...flag.map(b=>b.low)),drift=flag.at(-1)!.close-flag[0].close;
    if(Math.abs(pole)>atr*4&&fh-fl<Math.abs(pole)*.5&&mean(flag.map(b=>b.volume))<mean(bars.slice(-18,-8).map(b=>b.volume))){
      if(pole>0&&drift<=tol&&fl>poleStart+pole*.5)add('Bull Flag','UP',fh,fl-tol,n-18,75);
      if(pole<0&&drift>=-tol&&fh<poleStart+pole*.5)add('Bear Flag','DOWN',fl,fh+tol,n-18,75);
    }
  }
  if(n>=65){
    const cup=bars.slice(-60,-8),left=mean(cup.slice(0,5).map(b=>b.close)),right=mean(cup.slice(-5).map(b=>b.close)),bottom=Math.min(...cup.map(b=>b.low)),depth=Math.min(left,right)-bottom,bottomIndex=cup.findIndex(b=>b.low===bottom),handle=bars.slice(-8,-1),handleLow=Math.min(...handle.map(b=>b.low));
    if(Math.abs(left-right)<=atr&&depth>=atr*3&&bottomIndex>15&&bottomIndex<37&&handleLow>right-depth*.4&&handleLow<right&&mean(cup.slice(18,34).map(b=>b.close))<Math.min(left,right)-depth*.5)add('Cup and Handle','UP',Math.max(left,right,...handle.map(b=>b.high)),handleLow-tol,n-60,70);
  }
  return out.sort((a,b)=>b.quality-a.quality||a.name.localeCompare(b.name));
}
