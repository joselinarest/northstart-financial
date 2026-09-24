"use client";
import {useEffect,useState} from 'react';
import {readChartSetup,type ChartSetup} from '@/lib/chart-setup-link';
import {setupValidationClock} from '@/lib/setup-validation-clock';
export default function LinkedChartSetup({symbol}:{symbol:string}){
 const [setup,setSetup]=useState<ChartSetup|null>(null);
 const [now,setNow]=useState(Date.now()),[data,setData]=useState<any>(null),[error,setError]=useState(''),[checked,setChecked]=useState<number|null>(null);
 useEffect(()=>{setSetup(readChartSetup(location.search))},[symbol]);
 useEffect(()=>{if(!setup||setup.symbol!==symbol)return;let active=true;const controller=new AbortController();setData(null);setChecked(null);setError('');const load=async()=>{try{const r=await fetch(`/api/market/bars?symbol=${encodeURIComponent(symbol)}&range=5m`,{signal:controller.signal,cache:'no-store'}),body=await r.json();if(!r.ok||!Array.isArray(body.bars))throw new Error(body.error||'Candles unavailable');if(active){setData(body);setChecked(Date.now());setError('')}}catch(e){if(active)setError(e instanceof Error?e.message:'Validation unavailable')}};void load();const poll=setInterval(load,60000),clock=setInterval(()=>setNow(Date.now()),1000);return()=>{active=false;controller.abort();clearInterval(poll);clearInterval(clock)}},[setup,symbol]);
 if(!setup||setup.symbol!==symbol)return null;
 const price=(v:number)=>v>0?`$${v.toFixed(2)}`:'Requires fresh analysis';
 const validation=setupValidationClock(data?.bars||[],setup.trigger,setup.stop,data?.feed||'',now);
 return <aside style={{padding:16,border:'1px solid #b9cec4',borderRadius:12,overflowWrap:'anywhere'}}>
  <h3>{symbol} · 5-minute setup validation</h3>
  <p><b>{error?'VALIDATION UNAVAILABLE':validation.state}</b><br/>{error||`Next 5-minute candle close: ${validation.secondsToClose==null?'Waiting for fresh candles':`${Math.floor(validation.secondsToClose/60)}m ${validation.secondsToClose%60}s`}`}<br/>Last checked: {checked?`${Math.max(0,Math.floor((now-checked)/1000))} seconds ago`:'Waiting'} · Last completed candle: {validation.closeAt?new Date(validation.closeAt).toLocaleTimeString():'Unavailable'} · Relative volume: {validation.rvol==null?'Unavailable':`${validation.rvol.toFixed(2)}×`}</p>
  <small>Candles refresh every 60 seconds while this view is open. The timer is not a server monitoring guarantee or order approval. “Invalidation observed” refers to the latest completed candle; this view does not establish the full setup history.</small>
  <p>Levels copied from the setup card for comparison. Revalidate against fresh candles and the selected account; these are not order instructions.</p>
  <p><b>Breakout watch:</b> {price(setup.trigger)}–{price(setup.high)}. Wait for a completed 5-minute close above {price(setup.trigger)} with relative volume ≥ 1.5, trend support and no adverse material news.</p>
  <p><b>Lower-price alternative:</b> Watch near {price(setup.pullback)} for support to hold and a bullish reclaim. A lower price alone does not mean lower risk; there is no guaranteed minimum buying price.</p>
  <p><b>Invalidation:</b> {price(setup.stop)} · <b>Targets to review:</b> {price(setup.target1)} / {price(setup.target2)}.</p>
  <p><b>Before an order:</b> Confirm spread, fresh news, available cash, position limits and exact shares in the analysis below. Keep the trigger separate from the final limit price. If support breaks before confirmation, do not enter.</p>
 </aside>;
}
