import type {EntryPlan} from "@/lib/entry-plan";
const price=(value:number|null|undefined)=>value==null?"Not authorized":`$${value.toFixed(2)}`;
export default function EntryPlanDetails({plan}:{plan?:EntryPlan}){
  return <section aria-label="Entry trigger and order instructions"><h4>{plan?.classification||"MONITOR ONLY"}</h4><dl>
    <dt>Trigger</dt><dd>{price(plan?.trigger)}{plan?.zoneLow!=null&&plan?.zoneHigh!=null?` · Zone ${price(plan.zoneLow)}–${price(plan.zoneHigh)}`:""}</dd>
    <dt>Confirmation Required</dt><dd>{plan?.confirmationRequired.join("; ")||"A fresh server-confirmed entry plan is required. Touching a price does not confirm entry."}</dd>
    <dt>Action After Confirmation</dt><dd>{plan?.actionAfterConfirmation||"Recalculate price and sizing; no order is recommended yet."}</dd>
    <dt>Order Type</dt><dd>{plan?.orderType||"NONE"}</dd><dt>Order Price</dt><dd>{price(plan?.orderPrice)}{plan?.orderStopPrice?` · Activation ${price(plan.orderStopPrice)}`:""}</dd>
    <dt>Shares</dt><dd>{plan?.shares??0}{plan?.status!=="CONFIRMED"?" proposed; not an order":""}</dd>
    <dt>Stop/Invalidation</dt><dd>After entry: {price(plan?.stopAfterEntry)}. Before entry: cancel at/below {price(plan?.cancelBelow)}.</dd>
    <dt>Targets</dt><dd>{plan?.targets.map(price).join(" / ")||"Not supplied"}</dd><dt>Cancel Conditions</dt><dd>{plan?.cancelConditions.join("; ")||"Missing/stale evidence, thesis changes, or breached support."}</dd>
  </dl><p>Monitoring never places an order. Execution requires separate authorization.</p></section>;
}
