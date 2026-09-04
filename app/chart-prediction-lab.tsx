"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MarketBar = { time:string; open:number; high:number; low:number; close:number; volume:number };
type Prediction = "up" | "down" | "sideways";
const symbols = ["SPY","QQQ","AAPL","MSFT","NVDA","AMZN","META"];

function average(values:number[]) { return values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : 0; }
function moving(values:number[], period:number) {
  return values.map((_,index)=>index+1<period?null:average(values.slice(index-period+1,index+1)));
}
function emaSeries(values:number[],period:number){const k=2/(period+1);let value=values[0]||0;return values.map((close,index)=>(value=index?close*k+value*(1-k):close));}

export default function ChartPredictionLab(){
  const canvas=useRef<HTMLCanvasElement>(null);
  const [symbol,setSymbol]=useState("SPY"),[bars,setBars]=useState<MarketBar[]>([]),[status,setStatus]=useState("Loading real market history…");
  const [challenge,setChallenge]=useState(0),[prediction,setPrediction]=useState<Prediction|null>(null),[revealed,setRevealed]=useState(false),[confidence,setConfidence]=useState(60);
  const [studies,setStudies]=useState({ema:true,sma:true,bands:true,fib:true,volume:true}),[cursor,setCursor]=useState<{x:number;y:number}|null>(null);
  useEffect(()=>{let active=true;setStatus("Loading real Alpaca daily candles…");fetch(`/api/market/bars?symbol=${symbol}&range=1Y`).then(async response=>({ok:response.ok,data:await response.json()})).then(({ok,data})=>{if(!active)return;if(!ok){setBars([]);setStatus(data.error||"Historical data unavailable");return}setBars(data.bars||[]);setStatus(`${data.feed.toUpperCase()} · adjusted daily history · provider timestamped`);setChallenge(0);setPrediction(null);setRevealed(false)}).catch(()=>{if(active){setBars([]);setStatus("Historical data unavailable")}});return()=>{active=false}},[symbol]);
  const scenario=useMemo(()=>{
    if(bars.length<70)return {visible:[] as MarketBar[],future:[] as MarketBar[]};
    const hidden=10,back=Math.min(challenge*17,Math.max(0,bars.length-70-hidden)),cut=bars.length-hidden-back;
    return {visible:bars.slice(Math.max(0,cut-70),cut),future:bars.slice(cut,cut+hidden)};
  },[bars,challenge]);
  const allShown=revealed?[...scenario.visible,...scenario.future]:scenario.visible;
  const metrics=useMemo(()=>{
    if(!scenario.visible.length)return null;const closes=scenario.visible.map(x=>x.close),last=scenario.visible.at(-1)!,ema20=moving(closes,20).at(-1),sma50=moving(closes,50).at(-1);
    const recent=scenario.visible.slice(-20),mid=average(recent.map(x=>x.close)),sd=Math.sqrt(average(recent.map(x=>(x.close-mid)**2))),avgVol=average(recent.slice(0,-1).map(x=>x.volume)),relVol=avgVol?last.volume/avgVol:0;
    const high=Math.max(...recent.map(x=>x.high)),low=Math.min(...recent.map(x=>x.low)),trend=last.close>(sma50||last.close)&&Number(ema20)>Number(sma50)?"Bullish structure":last.close<(sma50||last.close)&&Number(ema20)<Number(sma50)?"Bearish structure":"Mixed / range";
    const changes=closes.slice(-15).map((value,index,array)=>index?value-array[index-1]:0).slice(1),gains=average(changes.map(x=>Math.max(0,x))),losses=average(changes.map(x=>Math.max(0,-x))),rsi=losses===0?100:100-(100/(1+gains/losses));
    const macd=(emaSeries(closes,12).at(-1)||0)-(emaSeries(closes,26).at(-1)||0);
    const atr=average(scenario.visible.slice(-14).map((bar,index,array)=>{const previous=index?array[index-1].close:bar.open;return Math.max(bar.high-bar.low,Math.abs(bar.high-previous),Math.abs(bar.low-previous))}));
    const body=Math.abs(last.close-last.open),range=Math.max(.01,last.high-last.low),candle=body/range<.2?"Doji / indecision":last.close>=last.open?(last.open-last.low)>body?"Bullish rejection wick":"Bullish body":"Bearish body";
    return {last,ema20,sma50,upper:mid+2*sd,lower:mid-2*sd,mid,relVol,high,low,trend,rsi,macd,atr,candle};
  },[scenario.visible]);
  const result=useMemo(()=>{
    if(!revealed||!prediction||!scenario.future.length)return null;const start=scenario.visible.at(-1)!.close,end=scenario.future.at(-1)!.close,change=(end-start)/start*100,actual:Prediction=change>1.5?"up":change<-1.5?"down":"sideways";
    return {start,end,change,actual,correct:actual===prediction};
  },[revealed,prediction,scenario]);

  useEffect(()=>{const el=canvas.current;if(!el||!allShown.length)return;const rect=el.getBoundingClientRect(),dpr=devicePixelRatio||1;el.width=rect.width*dpr;el.height=rect.height*dpr;const g=el.getContext("2d")!;g.scale(dpr,dpr);const w=rect.width,h=rect.height,left=52,right=16,top=24,volumeH=studies.volume?70:18,bottom=22+volumeH,priceH=h-top-bottom,lo=Math.min(...allShown.map(x=>x.low)),hi=Math.max(...allShown.map(x=>x.high)),span=Math.max(.01,hi-lo),py=(v:number)=>top+(hi-v)/span*priceH,cw=(w-left-right)/allShown.length;
    g.fillStyle="#07130f";g.fillRect(0,0,w,h);g.strokeStyle="#193028";g.lineWidth=1;for(let i=0;i<6;i++){const y=top+i*priceH/5;g.beginPath();g.moveTo(left,y);g.lineTo(w-right,y);g.stroke();g.fillStyle="#9eb5ab";g.font="11px Arial";g.fillText((hi-i*span/5).toFixed(2),4,y+4)}
    const cutX=left+scenario.visible.length*cw;if(revealed){g.fillStyle="rgba(78,168,128,.09)";g.fillRect(cutX,top,w-right-cutX,priceH+volumeH);g.fillStyle="#8edbb9";g.fillText("REVEALED FUTURE",cutX+7,top+13)}else{g.fillStyle="#d9b75b";g.fillText("PREDICT HERE →",Math.max(left,cutX-92),top+13)}
    const closes=allShown.map(x=>x.close),drawLine=(values:(number|null)[],color:string)=>{g.strokeStyle=color;g.lineWidth=1.7;g.beginPath();let begun=false;values.forEach((v,i)=>{if(v===null)return;const x=left+(i+.5)*cw,y=py(v);begun?g.lineTo(x,y):g.moveTo(x,y);begun=true});g.stroke()};
    if(studies.ema)drawLine(moving(closes,20),"#f0b84b");if(studies.sma)drawLine(moving(closes,50),"#62aee8");if(studies.bands){const mids=moving(closes,20),upper=mids.map((m,i)=>m===null?null:m+2*Math.sqrt(average(closes.slice(i-19,i+1).map(v=>(v-m)**2)))),lower=mids.map((m,i)=>m===null?null:m-2*Math.sqrt(average(closes.slice(i-19,i+1).map(v=>(v-m)**2))));drawLine(upper,"#986ee8");drawLine(lower,"#986ee8")}
    if(studies.fib&&metrics){[0,.236,.382,.5,.618,.786,1].forEach(level=>{const price=metrics.high-(metrics.high-metrics.low)*level,y=py(price);g.strokeStyle="rgba(77,190,145,.42)";g.beginPath();g.moveTo(left,y);g.lineTo(cutX,y);g.stroke();g.fillStyle="#78c9a7";g.fillText(`${(level*100).toFixed(1)}%`,left+3,y-3)})}
    const maxVol=Math.max(...allShown.map(x=>x.volume));allShown.forEach((b,i)=>{const x=left+(i+.5)*cw,up=b.close>=b.open,color=up?"#35c98e":"#f06d65";g.strokeStyle=g.fillStyle=color;g.beginPath();g.moveTo(x,py(b.high));g.lineTo(x,py(b.low));g.stroke();g.fillRect(x-Math.max(1.5,cw*.27),Math.min(py(b.open),py(b.close)),Math.max(3,cw*.54),Math.max(2,Math.abs(py(b.open)-py(b.close))));if(studies.volume){const vh=b.volume/maxVol*(volumeH-12);g.globalAlpha=.55;g.fillRect(x-Math.max(1,cw*.28),h-22-vh,Math.max(2,cw*.56),vh);g.globalAlpha=1}});
    g.strokeStyle="#ddb94f";g.setLineDash([5,4]);g.beginPath();g.moveTo(cutX,top);g.lineTo(cutX,h-18);g.stroke();g.setLineDash([]);
    if(cursor){g.strokeStyle="#dce9e3";g.globalAlpha=.65;g.setLineDash([3,3]);g.beginPath();g.moveTo(cursor.x,top);g.lineTo(cursor.x,h-18);g.moveTo(left,cursor.y);g.lineTo(w-right,cursor.y);g.stroke();g.setLineDash([]);g.globalAlpha=1}
  },[allShown,scenario.visible.length,studies,cursor,metrics,revealed]);

  const toggle=(key:keyof typeof studies)=>setStudies(current=>({...current,[key]:!current[key]}));
  return <section className="prediction-lab"><header><div><span>DEDICATED CHART-INTERPRETATION SESSION</span><h2>Read the evidence. Predict the next 10 candles. Reveal reality.</h2><p>The future is hidden. Form a probability-based hypothesis, commit to it, then reveal the actual historical outcome and study your error.</p></div><strong>REAL MARKET HISTORY<small>{status}</small></strong></header>
    <div className="prediction-toolbar"><label>Stock / ETF<select value={symbol} onChange={e=>setSymbol(e.target.value)}>{symbols.map(x=><option key={x}>{x}</option>)}</select></label><div className="study-switches">{Object.entries(studies).map(([key,on])=><button key={key} className={on?"active":""} onClick={()=>toggle(key as keyof typeof studies)}>{on?"✓ ":"+ "}{key==="bands"?"Bollinger":key.toUpperCase()}</button>)}</div><button className="new-case" disabled={bars.length<90} onClick={()=>{setChallenge(value=>(value+1)%Math.max(1,Math.floor((bars.length-70)/17)));setPrediction(null);setRevealed(false)}}>New hidden case ↻</button></div>
    {!scenario.visible.length?<div className="prediction-empty">{status}. At least 70 daily candles are required for this exercise.</div>:<><div className="prediction-chart"><canvas ref={canvas} onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect();setCursor({x:e.clientX-r.left,y:e.clientY-r.top})}} onMouseLeave={()=>setCursor(null)} aria-label={`Interactive ${symbol} historical candlestick prediction chart`}/><div className="chart-legend"><span className="ema">EMA 20</span><span className="sma">SMA 50</span><span className="band">Bollinger ±2σ</span><span>Volume below</span><span>Fibonacci uses recent swing</span></div></div>
      {metrics&&<div className="reading-dashboard"><article><span>1 · MARKET STRUCTURE</span><b>{metrics.trend}</b><p>Close ${metrics.last.close.toFixed(2)} · EMA20 {metrics.ema20?.toFixed(2)} · SMA50 {metrics.sma50?.toFixed(2)}</p></article><article><span>2 · LOCATION / VOLATILITY</span><b>{metrics.last.close>metrics.upper?"Above upper band":metrics.last.close<metrics.lower?"Below lower band":"Inside Bollinger range"}</b><p>Support ${metrics.low.toFixed(2)} · resistance ${metrics.high.toFixed(2)} · ATR ${metrics.atr.toFixed(2)}</p></article><article><span>3 · VOLUME / CANDLE</span><b>{metrics.candle}</b><p>{metrics.relVol.toFixed(2)}× average volume. Volume confirms context; it never decides alone.</p></article><article><span>4 · MOMENTUM</span><b>RSI {metrics.rsi.toFixed(1)} · MACD {metrics.macd>=0?"+":""}{metrics.macd.toFixed(2)}</b><p>Momentum supports or challenges structure; overbought and oversold are not automatic signals.</p></article></div>}
      <div className="prediction-decision"><div><span>YOUR FORECAST · NEXT 10 DAILY CANDLES</span><h3>What behavior is most probable?</h3><div className="prediction-options"><button className={prediction==="up"?"selected up":""} disabled={revealed} onClick={()=>setPrediction("up")}>↗ Rise more than 1.5%</button><button className={prediction==="sideways"?"selected flat":""} disabled={revealed} onClick={()=>setPrediction("sideways")}>↔ Stay within ±1.5%</button><button className={prediction==="down"?"selected down":""} disabled={revealed} onClick={()=>setPrediction("down")}>↘ Fall more than 1.5%</button></div><label>Confidence: <b>{confidence}%</b><input type="range" min="50" max="90" step="5" value={confidence} disabled={revealed} onChange={e=>setConfidence(+e.target.value)}/></label></div><aside><b>Before revealing, read in order</b><ol><li>Trend and higher highs/lows</li><li>Price vs EMA20 and SMA50</li><li>Support, resistance and Fibonacci location</li><li>Candle body/wick rejection</li><li>Bollinger compression or expansion</li><li>Volume relative to the move</li></ol><button disabled={!prediction||revealed} onClick={()=>setRevealed(true)}>Lock prediction & reveal →</button></aside></div>
      {result&&<div className={`prediction-result ${result.correct?"correct":"incorrect"}`}><div><span>{result.correct?"✓ CORRECT DIRECTIONAL CLASSIFICATION":"✕ DIFFERENT OUTCOME"}</span><h3>{symbol} actually moved {result.change>=0?"+":""}{result.change.toFixed(2)}%</h3><p>From ${result.start.toFixed(2)} to ${result.end.toFixed(2)} across the hidden 10-session window. Actual classification: <b>{result.actual}</b>.</p></div><section><b>Professional review</b><p>A correct answer does not prove the reasoning was good, and a wrong answer does not prove it was bad. Compare your forecast with the revealed candles: Did price respect support? Did volume expand? Was there follow-through or a failed breakout? Which evidence should change your next probability estimate?</p><small>Your stated confidence was {confidence}%. Markets remain uncertain; this exercise grades the historical outcome, not a guaranteed forecasting rule.</small></section></div>}
    </>}
  </section>;
}
