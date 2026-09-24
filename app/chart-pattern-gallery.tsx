"use client";
import {useState} from 'react';
import type {PatternEvidence} from '@/lib/pattern-evidence';

const examples=[
 {name:'Bull Flag',side:'UP',points:'10,105 40,80 65,25 90,40 110,33 130,52 155,44 180,60 205,40 240,15',level:35,confirm:'Wait for a close above the flag resistance with stronger volume.',cancel:'Cancel if flag support breaks before confirmation.'},
 {name:'Double Bottom',side:'UP',points:'10,25 45,100 75,55 110,30 145,100 175,60 205,30 240,12',level:30,confirm:'Wait for a close above the middle peak (neckline), then a supported retest.',cancel:'Cancel if price breaks below either bottom.'},
 {name:'Support Bounce',side:'UP',points:'10,30 45,95 75,50 110,95 145,65 175,95 200,60 240,35',level:95,confirm:'Support must hold; wait for a bullish reclaim and improving volume.',cancel:'Cancel if support fails. Touching support alone is not an entry.'},
 {name:'Bear Flag',side:'DOWN',points:'10,15 40,40 65,105 90,90 110,97 130,78 155,86 180,70 205,90 240,115',level:95,confirm:'Watch for a close below flag support with selling volume.',cancel:'The bearish setup fails if price reclaims flag resistance.'},
 {name:'Double Top',side:'DOWN',points:'10,105 45,30 75,75 110,100 145,30 175,70 205,100 240,118',level:100,confirm:'Watch for a close below the middle trough (neckline) with volume.',cancel:'The bearish setup fails if price breaks above the tops.'},
 {name:'Resistance Rejection',side:'DOWN',points:'10,100 45,35 75,80 110,35 145,65 175,35 200,70 240,100',level:35,confirm:'Watch for repeated rejection, then a break of nearby support.',cancel:'A sustained reclaim above resistance invalidates the bearish setup.'},
] as const;

export default function ChartPatternGallery({symbol,timeframe,patterns,onSelect}:{symbol:string;timeframe:string;patterns:PatternEvidence[];onSelect:(id:string)=>void}){
 const [filter,setFilter]=useState('ALL');
 return <section className="pattern-gallery" aria-label={`${symbol} visual pattern gallery`}>
  <h3>{symbol} · Buy / sell pattern gallery</h3>
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
