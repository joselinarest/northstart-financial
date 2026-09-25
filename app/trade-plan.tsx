import type {ReactNode} from 'react';
type J=Record<string,any>;
const display=(v:unknown):string=>v==null?'Not supplied':Array.isArray(v)?v.map(display).join(' · '):typeof v==='object'?Object.entries(v).map(([k,x])=>k+': '+display(x)).join(' · '):String(v);
const money=(v:unknown)=>v==null?'Not supplied':Number.isFinite(Number(v))?`$${Number(v).toFixed(2)}`:'Not supplied';
const cents=(v:unknown)=>v==null?'Not supplied':money(Number(v)/100);
export default function TradePlan({recommendation:r,checks,cash,children}:{recommendation?:J;checks:J;cash:number;children?:ReactNode}){
 const ai=checks.aiEvidence||{},plan=ai.entryPlan||{};
 const rows=[['Action',r?.action],['Shares / contracts',r?.suggested_quantity??r?.quantity],['Trigger / entry range',r?.entry_low_cents!=null?`${cents(r.entry_low_cents)} – ${cents(r.entry_high_cents)}`:null],['Confirmation',checks.confirmation??checks.whatWouldChange],['Order type',r?.order_type??plan.orderType],['Order price',r?.order_price_cents!=null?cents(r.order_price_cents):money(plan.orderPrice)],['Estimated cost / proceeds',money(ai.expectedCostProceeds)],['Cash before',money(cash)],['Cash after',money(ai.cashAfter)],['Stop / invalidation',cents(r?.invalidation_cents)],['Targets',Array.isArray(r?.targets_json)?r.targets_json.map(cents):null],['Risk / reward',checks.riskReward],['Confidence',r?.confidence==null?null:`${r.confidence}%`],['Reason',r?.reason],['Cancel conditions',checks.cancelConditions??checks.whatWouldChange]];
 return <section className="trade-plan"><h3>Authoritative account trade plan</h3><dl className="workspace-metrics">{rows.map(([label,value])=><div key={String(label)}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl>{children}</section>
}
