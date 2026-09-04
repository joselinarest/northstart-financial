"use client";

export default function PortfolioConcentrationReview({items,onAnalyze}:{items:Array<Record<string,any>>;onAnalyze:()=>void}){
 if(!items.length)return null;
 return <section className="concentration-review evaluated">
  <header><div><b>✓ Every holding evaluated</b><span>Fund structure, portfolio weight, and concentration type are checked for every current position.</span></div><button onClick={onAnalyze}>Analyze all live evidence ↑</button></header>
  <div className="concentration-findings">{items.map(item=><article className={item.severity} key={`${item.ticker}_${item.name}`}>
   <div><b>{item.ticker||item.name}</b><em>{item.weight.toFixed(1)}% of portfolio</em></div>
   <strong>{item.verdict}</strong>
   <p>{item.finding}</p>
   <footer><b>Suggested next step:</b> {item.action}</footer>
  </article>)}</div>
  <small>Position-size confirmation is separate from the live technical, fundamental, valuation, and news analysis above. Forecasts remain probabilistic; Northstar cannot guarantee a future price or return.</small>
 </section>
}
