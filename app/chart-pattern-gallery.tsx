"use client";
import {useEffect,useMemo,useState} from 'react';
import {patternHistory} from '@/lib/pattern-history';
import type {PatternEvidence,PatternBar} from '@/lib/pattern-evidence';

function DetectedPatternImage({pattern,bars}:{pattern:PatternEvidence;bars:PatternBar[]}){
 const sample=bars.filter(b=>b.time>=pattern.startTime&&b.time<=pattern.endTime).slice(-60);
 if(!sample.length)return <p>Pattern image unavailable: matching candles are missing.</p>;
 const low=Math.min(pattern.confirmationLevel,pattern.invalidationLevel,...sample.map(b=>b.low));
 const high=Math.max(pattern.confirmationLevel,pattern.invalidationLevel,...sample.map(b=>b.high));
 const y=(price:number)=>20+(high-price)/Math.max(high-low,.01)*120;
 const step=240/sample.length;
 return <svg viewBox="0 0 360 175" role="img" aria-label={`${pattern.name} on actual candles; confirmation ${pattern.confirmationLevel.toFixed(2)}, invalidation ${pattern.invalidationLevel.toFixed(2)}`}>
  {sample.map((b,i)=>{const x=10+i*step+step/2,color=b.close>=b.open?'#087f5b':'#c2413a';return <g key={b.time}><line x1={x} x2={x} y1={y(b.high)} y2={y(b.low)} stroke={color}/><rect x={x-Math.max(1,step*.6)/2} y={Math.min(y(b.open),y(b.close))} width={Math.max(1,step*.6)} height={Math.max(1,Math.abs(y(b.open)-y(b.close)))} fill={color}/></g>})}
  <line x1="5" x2="250" y1={y(pattern.confirmationLevel)} y2={y(pattern.confirmationLevel)} stroke="#2563eb" strokeDasharray="4 3"/>
  <text x="254" y={y(pattern.confirmationLevel)} fontSize="10" fill="#1e40af">Trigger ${pattern.confirmationLevel.toFixed(2)}</text>
  <line x1="5" x2="250" y1={y(pattern.invalidationLevel)} y2={y(pattern.invalidationLevel)} stroke="#c2413a" strokeDasharray="4 3"/>
  <text x="254" y={y(pattern.invalidationLevel)+10} fontSize="10" fill="#9f1239">Invalid ${pattern.invalidationLevel.toFixed(2)}</text>
  <text x="10" y="166" fontSize="10" fill="#334155">Actual completed candles · no future prices drawn</text>
 </svg>;
}

function HoldingPatternHistory({symbol}:{symbol:string}){
 const [attempt,setAttempt]=useState(0),[requested,setRequested]=useState(false),[bars,setBars]=useState<PatternBar[]>([]),[status,setStatus]=useState(''),[visible,setVisible]=useState(12);
 useEffect(()=>{
  if(!requested)return;
  const controller=new AbortController();setBars([]);setStatus('Loading earliest available weekly history…');
  fetch(`/api/market/bars?symbol=${encodeURIComponent(symbol)}&range=MAX`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'History unavailable');if(!Array.isArray(data.bars))throw new Error('Provider returned no candle history');if(controller.signal.aborted)return;setBars(data.bars.filter((b:PatternBar)=>Date.parse(b.time)+7*86400000<=Date.now()));setStatus('Loaded provider history. The unfinished weekly candle is excluded.');}).catch(error=>{if(!controller.signal.aborted)setStatus(error instanceof Error?error.message:'History unavailable');});
  return()=>controller.abort();
 },[requested,symbol,attempt]);
 const history=useMemo(()=>patternHistory(bars,'1Week'),[bars]);
 return <section className="holding-pattern-history"><h4>{symbol} · Pattern timeline from earliest available history</h4><p>Stock / ETF market history, not your purchase date. Weekly candles give the longest view. Patterns are replayed using only information available at the time; the first 24 candles provide context. Historical signals are not current orders.</p>
  <button type="button" onClick={()=>{setRequested(true);setAttempt(n=>n+1);setVisible(12)}} disabled={requested&&status.startsWith("Loading")}>Load all available history for {symbol}</button>
  {requested&&<><p role="status">{status}</p>{bars.length>0&&<p><strong>Coverage: {bars[0].time.slice(0,10)} through {bars.at(-1)!.time.slice(0,10)}</strong> · {bars.length} completed weekly candles · {history.length} pattern episodes. This may not reach the listing date or today; it is the provider’s available completed history.</p>}{bars.length>0&&!history.length&&<p>No qualifying pattern episodes found in this history.</p>}
  <div className="pattern-gallery-grid">{history.slice(0,visible).map(p=><article className="pattern-gallery-card" key={p.id} style={{padding:14}}><h4>{p.name} · {p.endTime.slice(0,10)}</h4><DetectedPatternImage pattern={p} bars={bars}/><p><strong>Historical {p.direction==='UP'?'buy setup':p.direction==='DOWN'?'sell / trim warning':'neutral setup'}</strong> · {p.validation} at detection.</p><p>Trigger ${p.confirmationLevel.toFixed(2)} · invalidation ${p.invalidationLevel.toFixed(2)} · volume {p.volumeConfirmation}. These are historical levels, not an order to place today.</p><details><summary>Evidence missing at that time</summary><p>{p.missingConfirmation.join('; ')||'Pattern checks passed; independent account review still required.'}</p></details></article>)}</div>
  {history.length>visible&&<button type="button" onClick={()=>setVisible(n=>n+12)}>Show next 12 episodes ({visible} of {history.length})</button>}</>}
 </section>;
}

const examples=[
 {name:'Bull Flag',side:'UP',points:'10,105 40,80 65,25 90,40 110,33 130,52 155,44 180,60 205,40 240,15',level:35,confirm:'Wait for a close above the flag resistance with stronger volume.',cancel:'Cancel if flag support breaks before confirmation.'},
 {name:'Double Bottom',side:'UP',points:'10,25 45,100 75,55 110,30 145,100 175,60 205,30 240,12',level:30,confirm:'Wait for a close above the middle peak (neckline), then a supported retest.',cancel:'Cancel if price breaks below either bottom.'},
 {name:'Support Bounce',side:'UP',points:'10,30 45,95 75,50 110,95 145,65 175,95 200,60 240,35',level:95,confirm:'Support must hold; wait for a bullish reclaim and improving volume.',cancel:'Cancel if support fails. Touching support alone is not an entry.'},
 {name:'Bear Flag',side:'DOWN',points:'10,15 40,40 65,105 90,90 110,97 130,78 155,86 180,70 205,90 240,115',level:95,confirm:'Watch for a close below flag support with selling volume.',cancel:'The bearish setup fails if price reclaims flag resistance.'},
 {name:'Double Top',side:'DOWN',points:'10,105 45,30 75,75 110,100 145,30 175,70 205,100 240,118',level:100,confirm:'Watch for a close below the middle trough (neckline) with volume.',cancel:'The bearish setup fails if price breaks above the tops.'},
 {name:'Resistance Rejection',side:'DOWN',points:'10,100 45,35 75,80 110,35 145,65 175,35 200,70 240,100',level:35,confirm:'Watch for repeated rejection, then a break of nearby support.',cancel:'A sustained reclaim above resistance invalidates the bearish setup.'},
] as const;

export default function ChartPatternGallery({symbol,timeframe,patterns,onSelect,bars=[],action='WAIT'}:{symbol:string;timeframe:string;patterns:PatternEvidence[];onSelect:(id:string)=>void;bars?:PatternBar[];action?:string}){
 const [filter,setFilter]=useState('ALL');
 return <section tabIndex={-1} className="pattern-gallery" aria-label={`${symbol} visual pattern gallery`}>
  <h3>{symbol} · Buy / sell pattern gallery</h3>
  <p><strong>Current recommendation: {action}.</strong> Pattern scenarios are evidence for review, not independent trade instructions or guaranteed predictions.</p>
  <HoldingPatternHistory key={symbol} symbol={symbol}/>
  <h4>Detected setups for {symbol} · {timeframe}</h4>
  {!patterns.length&&<p>No qualifying pattern detected. WAIT for sufficient completed candles and confirmation; the example gallery below is educational.</p>}
  <div className="pattern-gallery-grid">{patterns.filter(p=>filter==='ALL'||p.direction===filter).map(p=><article className="pattern-gallery-card" key={p.id} style={{padding:14}}>
   <h4>{p.name} · {p.validation}</h4><DetectedPatternImage pattern={p} bars={bars}/>
   <p><strong>{p.validation==='FAIL'?'CANCEL PATTERN SETUP':p.direction==='UP'?'BUY SCENARIO — confirmation required':p.direction==='DOWN'?'SELL / TRIM SCENARIO — review required':'WAIT — direction unresolved'}</strong></p>
   <p>{p.validation==='FAIL'?'This pattern is invalidated. Do not use it to justify an entry or exit; wait for a new valid setup.':p.direction==='NEUTRAL'?`Wait for a directional break; do not infer BUY or SELL from this pattern.`:`If a completed ${p.timeframe} candle closes ${p.direction==='UP'?'above':'below'} $${p.confirmationLevel.toFixed(2)} with supporting volume, review ${p.direction==='UP'?'a confirmed entry':'HOLD versus TRIM or SELL'} in the account decision.`} Invalidate the setup at ${p.invalidationLevel.toFixed(2)}.</p>
   <p>Quality {p.quality}/100 (not win probability) · volume {p.volumeConfirmation} · false-breakout risk {p.falseBreakoutRisk}. Evidence ends {p.endTime}.</p>
   <details><summary>What is still needed for a decision?</summary><p>{p.missingConfirmation.join('; ')||'Evidence checks passed; review the central account decision before acting.'}</p><p>Trigger price is not an order price. Exact shares, order type, limit price, stops and targets come from the confirmed account recommendation. News, fundamentals, market/sector and risk checks still apply.</p></details>
   <button type="button" onClick={()=>onSelect(p.id)}>Highlight this setup on the main chart</button>
  </article>)}</div>
  <h4>Pattern reference images</h4>
  <p>Illustrated examples to compare with the {timeframe} chart. These drawings are not price forecasts or actual {symbol} candles. Expand an image for the confirmation checklist.</p>
  <nav aria-label="Pattern gallery filters">{[['ALL','All patterns'],['UP','Buy setups'],['DOWN','Sell / trim warnings']].map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</nav>
  <div className="pattern-gallery-grid">{examples.filter(e=>filter==='ALL'||e.side===filter).map(e=>{
   const detected=patterns.find(p=>p.name===e.name&&p.direction===e.side);
   return <details key={e.name} className="pattern-gallery-card"><summary><b>{e.name}</b><span>{e.side==='UP'?'Potential buy setup':'Potential sell / trim warning'}</span>
    <svg viewBox="0 0 250 135" role="img" aria-label={`${e.name}: illustrative price path with dashed reference level`}>
     <path d="M5 5V125H245" fill="none" stroke="#94a3b8"/>
     <path d={`M5 ${e.level}H245`} stroke="#64748b" strokeDasharray="5 5"/>
     <polyline points={e.points} fill="none" stroke={e.side==='UP'?'#087f5b':'#c2413a'} strokeWidth="3" strokeLinejoin="round"/>
    </svg><span>{detected?`Detected · ${detected.timeframe} · ${detected.validation}`:'Example only · not currently detected'}</span><small>Open pattern details ▾</small></summary>
    <div><p><strong>Confirmation:</strong> {e.confirm}</p><p><strong>Cancel / invalidation:</strong> {e.cancel}</p>
    {detected&&<><p>Actual chart evidence: confirmation ${detected.confirmationLevel.toFixed(2)} · invalidation ${detected.invalidationLevel.toFixed(2)} · quality {detected.quality}/100 · volume {detected.volumeConfirmation} · false-breakout risk {detected.falseBreakoutRisk}.</p><p>{detected.missingConfirmation.join('; ')||'Pattern checks passed; account-specific approval is still required.'}</p><button type="button" onClick={()=>onSelect(detected.id)}>Highlight detected pattern on chart</button></>}
    <p>{e.side==='UP'?'After confirmation, review the central account recommendation for order type, order price and exact shares.':'Review HOLD, partial TRIM and SELL using the central account recommendation; a bearish pattern alone does not justify selling.'} Check trend, market/sector, news, data freshness and account risk. No automatic order.</p></div>
   </details>;
  })}</div>
 </section>;
}
