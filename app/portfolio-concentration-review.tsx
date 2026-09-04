"use client";

export default function PortfolioConcentrationReview({items,onAnalyze}:{items:Array<Record<string,any>>;onAnalyze:()=>void}){
 if(!items.length)return null;
 return <section className="concentration-review evaluated">
  <header><div><b>✓ Concentration evaluation</b><span>Fund structure is checked before treating a position as single-company risk.</span></div><button onClick={onAnalyze}>Run evidence confirmation ↑</button></header>
  <div className="concentration-findings">{items.map(item=><article className={item.severity} key={`${item.ticker}_${item.name}`}>
   <div><b>{item.ticker||item.name}</b><em>{item.weight.toFixed(1)}% of portfolio</em></div>
   <strong>{item.verdict}</strong>
   <p>{item.finding}</p>
   <footer><b>Suggested next step:</b> {item.action}</footer>
  </article>)}</div>
  <small>“Confirmation” means the available fund classification and portfolio math support this evaluation. Market forecasts remain probabilistic; Northstar cannot guarantee a future price or return.</small>
 </section>
}
