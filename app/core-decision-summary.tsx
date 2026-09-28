type Row=Record<string,any>;
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
export default function CoreDecisionSummary({decision,review}:{decision?:Row;review?:Row|null}){
  if(decision?.decisionSource!=='RULES')return null;
  const payoff=decision.payoff;
  return <section className="core-decision-summary rounded-xl border border-line bg-soft p-4" aria-label="Core decision and price scenarios">
    <p className="text-xs font-bold uppercase tracking-wide">Rules-based decision · AI approval is not required</p>
    <h3>{String(decision.planState==='PREPARE'?'PREPARE':decision.action).replaceAll('_',' ')} · {decision.ticker}</h3><p>{decision.interpretation}</p>
    <p>Evidence checked {new Date(decision.dataTimestamp).toLocaleString()} · {decision.confidence}/100 rule conformance. This is not a win probability.</p>
    {payoff&&<div className="core-decision-metrics">
      {payoff.plannedLoss!=null&&<p><b>Loss at invalidation</b><br/>{money(payoff.plannedLoss)} · gaps can exceed this estimate</p>}
      {payoff.targetGains?.map((value:number,index:number)=><p key={index}><b>Potential gain at target {index+1}</b><br/>{money(value)}</p>)}
      {payoff.maxPremiumLoss!=null&&<p><b>Maximum paid-premium loss</b><br/>{money(payoff.maxPremiumLoss)}</p>}
    </div>}
    {payoff?.targetGains?.length>0&&<small>{payoff.basis}</small>}
    {decision.scenarioBasis&&<><div className="core-decision-metrics">{(['bull','base','bear'] as const).map(key=><p key={key}><b>{key.toUpperCase()} scenario</b><br/>{money(Number(decision[key].priceZone))} · {decision[key].probability}% assumed weight</p>)}</div><small>{decision.scenarioBasis} · {decision.returnEstimate?.horizonDays}-day horizon.</small></>}
    <details><summary>Evidence for and against</summary><ul>{decision.reasoningFactors?.map((text:string,i:number)=><li key={'for'+i}>{text}</li>)}{decision.contradictingEvidence?.map((text:string,i:number)=><li key={'against'+i}>{text}</li>)}</ul></details>
    <details><summary>Decision checks and what would change the plan</summary><ul>{decision.whatWouldChange?.map((text:string,i:number)=><li key={i}>{text}</li>)}</ul></details>
    {review?.status==='COMPLETE'&&<details><summary>Optional AI interpretation · supporting commentary</summary><p><b>{review.analysis_json?.position==='CHALLENGE'?'AI challenged the evidence · core recheck requested':'Supporting review'}</b></p><p>{review.analysis_json?.interpretation}</p><ul>{review.analysis_json?.reasonsAgainst?.map((text:string,i:number)=><li key={i}>{text}</li>)}</ul><p>The rules engine owns the action, prices, quantity and risk limits.</p></details>}
  </section>;
}
