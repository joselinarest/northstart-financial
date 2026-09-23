/** Trigger levels are observations, never order instructions. Prices are dollars. */
export type EntryClass = "MONITOR ONLY" | "LIMIT ENTRY" | "CONFIRMED PULLBACK" | "BREAKOUT/STOP-LIMIT" | "NO TRADE";
export type EntryPlan = {
  version:"entry-1"; classification:EntryClass; status:"WATCH"|"CONFIRMED"|"CANCELLED";
  trigger:number|null; zoneLow:number|null; zoneHigh:number|null;
  confirmationRequired:string[]; actionAfterConfirmation:string;
  orderType:"NONE"|"LIMIT"|"STOP_LIMIT"; orderPrice:number|null; orderStopPrice:number|null;
  shares:number; stopAfterEntry:number|null; targets:number[]; cancelConditions:string[];
  cancelBelow:number|null; expiresAt:string; confirmedAt:string|null; executionAllowed:false;
};
export type EntryObservation={asOf:string;price:number;lowSinceSetup:number|null;supportHeld:boolean;sellingPressureWeakening:boolean;reclaimed:boolean;volumeConfirmed:boolean;newsClear:boolean;thesisValid:boolean};
export function monitorEntry(plan:EntryPlan,observation:EntryObservation,now=Date.now()):EntryPlan{
  const age=now-Date.parse(observation.asOf),fresh=Number.isFinite(age)&&age>=0&&age<=5*60000;
  const cancelled=plan.status==="CANCELLED"||now>=Date.parse(plan.expiresAt)||!observation.thesisValid||(fresh&&plan.cancelBelow!==null&&Math.min(observation.price,observation.lowSinceSetup??observation.price)<=plan.cancelBelow);
  if(cancelled)return {...plan,classification:"NO TRADE",status:"CANCELLED",orderType:"NONE",orderPrice:null,orderStopPrice:null,shares:0,confirmedAt:null,actionAfterConfirmation:"Cancelled. A new reviewed setup is required; do not enter."};
  const ready=fresh&&observation.lowSinceSetup!==null&&observation.supportHeld&&observation.sellingPressureWeakening&&observation.reclaimed&&observation.volumeConfirmed&&observation.newsClear&&observation.thesisValid;
  if(!ready)return {...plan,status:"WATCH",orderType:"NONE",orderPrice:null,orderStopPrice:null,confirmedAt:null,actionAfterConfirmation:"Monitor only. Recalculate order price and share sizing after every confirmation passes."};
  // This evaluator never manufactures an order price from the trigger.
  return {...plan,status:"CONFIRMED",confirmedAt:observation.asOf,orderType:"NONE",orderPrice:null,orderStopPrice:null};
}
export function entryOrderReady(plan:EntryPlan|undefined,now=Date.now()):boolean{
  if(!plan||plan.version!=="entry-1"||plan.status!=="CONFIRMED"||!["LIMIT ENTRY","CONFIRMED PULLBACK","BREAKOUT/STOP-LIMIT"].includes(plan.classification))return false;
  const age=now-Date.parse(plan.confirmedAt||"");
  return Number.isFinite(age)&&age>=0&&age<=5*60000&&Date.parse(plan.expiresAt)>now&&plan.orderType!=="NONE"&&Number.isFinite(plan.orderPrice)&&Number(plan.orderPrice)>0&&plan.shares>0&&Number.isFinite(plan.stopAfterEntry)&&Number(plan.stopAfterEntry)>0&&Number(plan.stopAfterEntry)<Number(plan.orderPrice)&&plan.confirmationRequired.length>0&&plan.cancelConditions.length>0&&(plan.orderType!=="STOP_LIMIT"||(Number(plan.orderStopPrice)>0&&Number(plan.orderStopPrice)<=Number(plan.orderPrice)));
}
export function watchEntry(input:{trigger:number|null;low?:number|null;high?:number|null;stop:number|null;targets:number[];shares:number;expiresAt?:string}):EntryPlan{
  return {version:"entry-1",classification:"MONITOR ONLY",status:"WATCH",trigger:input.trigger,zoneLow:input.low??input.trigger,zoneHigh:input.high??input.trigger,confirmationRequired:["Support holds throughout monitoring","Selling pressure weakens","Price reclaims the trigger with sufficient volume","No material negative news; thesis remains valid"],actionAfterConfirmation:"Recalculate a separate limit price, risk and shares from fresh evidence; then request user-confirmed execution.",orderType:"NONE",orderPrice:null,orderStopPrice:null,shares:input.shares,stopAfterEntry:input.stop,targets:input.targets,cancelConditions:["Cancel if price breaches pre-entry invalidation before confirmation","Cancel on thesis deterioration or material negative news","Cancel when the setup expires or account cash/risk changes"],cancelBelow:input.stop,expiresAt:input.expiresAt||new Date(Date.now()+20*60000).toISOString(),confirmedAt:null,executionAllowed:false};
}
