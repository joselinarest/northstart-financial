import type {EntryPlan,EntryObservation} from "@/lib/entry-plan";
/** Deterministic, versioned policy. Money in dollars; stock sizing in whole shares. */
export const STRATEGY_VERSION = "lifecycle-1.0.0";
export const SELL_REASONS = ["THESIS BROKEN", "TECHNICAL EXIT", "STOP/INVALIDATION", "TARGET REACHED", "OVERVALUED/TRIM", "CONCENTRATION REDUCTION", "CAPITAL ROTATION", "TACTICAL SELL FOR EXPECTED PULLBACK", "GOAL/REBALANCE"] as const;
export type SellReason = typeof SELL_REASONS[number];
export type Strategy = "LONG_TERM" | "SWING" | "OPTIONS";
export type PositionState = {
  entryPlan?:EntryPlan; investmentAccountId: string; ticker: string; strategy: Strategy; shares: number; averageCost: number;
  currentPrice: number; thesisStatus: "VALID" | "BROKEN" | "RESEARCH_REQUIRED";
  positionState: "CANDIDATE" | "ENTRY_READY" | "OPEN" | "ADD" | "HOLD" | "TRIM" | "EXIT" | "REENTRY_WATCH" | "REENTRY_READY" | "REENTER" | "CLOSED";
  recommendationId: string | null; sellReason: SellReason | null; exitPrice: number | null; exitDate: string | null;
  proceeds: number; reservedReentryCash: number; reentryLow: number | null; reentryHigh: number | null;
  reentryTrigger: string | null; reentryInvalidation: number | null; target1: number | null; target2: number | null;
  stop: number | null; lastAnalysisAt: string; strategyVersion: string; modelVersion: string;
};
export type Evidence = {
  entryObservation?:EntryObservation; ask?:number; asOf: string; complete: boolean; thesis: PositionState["thesisStatus"]; price: number; support: number; resistance: number;
  sma20: number; sma50: number; atr: number; volumeRatio: number; relativeStrength: number;
  marketStrong: boolean; sectorStrong: boolean; newsClear: boolean; valuationAttractive: boolean; majorValuationRisk: boolean;
  momentumBroken: boolean; goalChanged: boolean; targetReached: boolean; sellConfirmations: number;
  pullbackProbability?: number; expectedPullback?: number; breakoutRisk?: number;
  options?: { premium: number; entryPremium: number; iv: number; entryIv: number; theta: number; dte: number; underlyingInvalid: boolean; catalystRisk: boolean; bid?:number;ask?:number;delta?:number|null;gamma?:number|null;vega?:number|null };
};
export type AccountRisk = { cash: number; value: number; maxPositionBps: number; maxRiskBps: number; taxRate: number | null; slippageBps: number; commission: number; reservedElsewhere: number };
export type ReentryPlan = {
  low: number; high: number; invalidation: number; breakout: number; breakoutLimit: number; trigger: string;
  expiresAt: string; reservedCash: number; estimatedShares: number; status: "WATCH" | "READY" | "CANCELLED" | "EXPIRED" | "REENTERED";
  reason: string; mode?: "PULLBACK" | "BREAKOUT";
};
export type Action = {
  entryPlan?:EntryPlan;
  action: "BUY NOW" | "BUY IF" | "ADD" | "HOLD" | "TRIM" | "SELL" | "REBUY IF" | "NO ACTION";
  shares: number; price: number; proceeds: number; cost: number; remainingShares: number; realizedGain: number;
  cashBefore: number; cashAfter: number; stop: number | null; targets: number[]; reason: string; sellReason: SellReason | null;
  reentry: ReentryPlan | null; allocation: "HOLD CASH" | "REBUY SAME STOCK LATER" | "ROTATE";
  supporting: string[]; opposing: string[]; pipeline: "COMPLETE" | "INCOMPLETE"; strategyVersion: string;
};
const money = (n: number) => Math.round(n * 100) / 100;
export const fresh = (e: Evidence, now: number, strategy: Strategy) => e.complete && Number.isFinite(Date.parse(e.asOf)) && now >= Date.parse(e.asOf) && now - Date.parse(e.asOf) <= (strategy === "LONG_TERM" ? 86400000 : 20 * 60000);
export function sizeReentry(cash: number, price: number, stop: number, p: PositionState, a: AccountRisk) {
  if (![cash,price,stop,a.value,a.cash,a.maxRiskBps,a.maxPositionBps].every(Number.isFinite) || price <= 0 || stop <= 0 || stop >= price) return 0;
  const budget = Math.max(0, Math.min(cash, a.cash - a.reservedElsewhere) - a.commission);
  const unitCost = price * (1 + a.slippageBps / 10000);
  const room = Math.max(0, a.value * a.maxPositionBps / 10000 - p.shares * price);
  const risk = Math.max(0, a.value * a.maxRiskBps / 10000 - p.shares * Math.max(0, price - stop));
  return Math.max(0, Math.floor(Math.min(budget / unitCost, room / price, risk / (price - stop))));
}
export function makeReentry(p: PositionState, e: Evidence, a: AccountRisk, cash: number, now: number): ReentryPlan | null {
  if (e.thesis !== "VALID" || p.strategy === "OPTIONS" || e.support <= 0 || e.atr <= 0) return null;
  const recovery = e.price <= e.support || e.momentumBroken;
  const high = money(recovery ? Math.max(e.support,e.sma20) + e.atr*.5 : Math.min(e.price - e.atr, Math.max(e.sma20, e.support + e.atr)));
  const low = money(recovery ? Math.max(e.support,e.sma20) : Math.max(e.support, high - e.atr));
  const invalidation = money(Math.min(e.support,e.price) - e.atr * .5);
  if (low > high || invalidation <= 0 || invalidation >= low) return null;
  const plan: ReentryPlan = { low, high, invalidation, breakout: money(e.resistance), breakoutLimit: money(e.resistance + .5 * e.atr), trigger: "Support holds; price above SMA20 and SMA50; relative volume ≥ 1.2; relative strength positive; market, sector, news and valuation confirm.", expiresAt: new Date(now + (p.strategy === "SWING" ? 14 : 90) * 86400000).toISOString(), reservedCash: money(cash), estimatedShares: sizeReentry(cash, high, invalidation, p, a), status: "WATCH", reason: "Cash reserved for a confirmed pullback or bounded breakout entry." };
  return plan;
}
export function evaluatePosition(p: PositionState, e: Evidence, a: AccountRisk, now = Date.now(), tacticalPenaltyBps = 0): Action {
  const result: Action = { action: p.shares > 0 ? "HOLD" : "NO ACTION", shares: 0, price: e.price, proceeds: 0, cost: 0, remainingShares: p.shares, realizedGain: 0, cashBefore: a.cash, cashAfter: a.cash, stop: p.stop, targets: [p.target1,p.target2].filter((v): v is number => v !== null), reason: "Maintain exposure; a rise in price alone is not sell evidence.", sellReason: null, reentry: null, allocation: "HOLD CASH", supporting: [], opposing: [], pipeline: "COMPLETE", strategyVersion: STRATEGY_VERSION };
  if (!fresh(e,now,p.strategy) || e.price <= 0 || ![e.price,e.support,e.resistance,e.sma20,e.sma50,e.atr,e.volumeRatio,p.shares,p.averageCost,a.cash,a.value,a.maxPositionBps,a.maxRiskBps,a.slippageBps,a.commission].every(Number.isFinite) || p.shares<0 || a.cash<0 || (a.taxRate!==null&&(!Number.isFinite(a.taxRate)||a.taxRate<0||a.taxRate>1))) return {...result, reason: "Fresh complete evidence and valid account limits required; cash waits for a verified setup.", pipeline: "INCOMPLETE"};
  const trend = e.price >= e.sma20 && e.price >= e.sma50 && !e.momentumBroken;
  if (trend) result.opposing.push("Trend remains intact: consider HOLD, trailing stop, partial trim or stop adding before a full exit.");
  if (e.thesis === "VALID") result.opposing.push("Company thesis remains valid.");
  let reason: SellReason | null = null, full = false;
  const weight = a.value > 0 ? p.shares * e.price / a.value * 10000 : 0;
  if (e.thesis === "BROKEN") { reason = "THESIS BROKEN"; full = true; }
  else if (e.goalChanged) { reason = "GOAL/REBALANCE"; full = true; }
  else if (p.strategy === "OPTIONS") {
    const o = e.options;
    if (!o || ![o.premium,o.entryPremium,o.iv,o.entryIv,o.theta,o.dte].every(Number.isFinite) || o.entryPremium <= 0) return {...result, pipeline: "INCOMPLETE", reason: "Options need premium, underlying, IV, Theta, DTE and catalyst evidence."};
    if (o.underlyingInvalid || o.dte <= 7 || o.premium <= o.entryPremium * .5 || Math.abs(o.theta) * 3 >= o.premium || o.catalystRisk || o.iv < o.entryIv * .65) {reason = "STOP/INVALIDATION"; full = true;}
    else if (o.premium >= o.entryPremium * 1.5) reason = "TARGET REACHED";
  } else if (weight > a.maxPositionBps * (p.strategy === "LONG_TERM" ? 1.5 : 1.1)) reason = "CONCENTRATION REDUCTION";
  else if (e.majorValuationRisk && e.sellConfirmations >= 3) reason = "OVERVALUED/TRIM";
  else if (p.strategy === "SWING") {
    if (p.stop && e.price <= p.stop) {reason = "STOP/INVALIDATION"; full = true;}
    else if (e.momentumBroken && e.price < e.sma50 && e.sellConfirmations >= 4) {reason = "TECHNICAL EXIT"; full = true;}
    else if (e.targetReached) reason = "TARGET REACHED";
    else if (e.sellConfirmations >= 4 && (e.pullbackProbability ?? 0) >= .65 && (e.expectedPullback ?? 0) >= e.atr) {
      const n = Math.floor(p.shares * .25), gross = n * e.price;
      if (a.taxRate === null) return {...result, reason: "HOLD: tax assumptions are missing for the tactical comparison."};
      const benefit = n * ((e.pullbackProbability ?? 0) * (e.expectedPullback ?? 0) - (1-(e.pullbackProbability ?? 0)) * (e.breakoutRisk ?? e.atr * 2)) - Math.max(0,e.price-p.averageCost) * n * a.taxRate - gross*a.slippageBps/10000*2-a.commission*2;
      result.supporting.push(`Expected improvement versus HOLD after taxes, trading costs and missed breakout risk: $${money(benefit)}.`);
      if (benefit > gross * (75+tacticalPenaltyBps)/10000 && n > 0) reason = "TACTICAL SELL FOR EXPECTED PULLBACK";
      else return {...result, reason: "HOLD: expected tactical benefit does not clear costs and reentry risk."};
    }
  }
  if (reason && p.shares > 0) {
    const shares = full ? p.shares : reason === "CONCENTRATION REDUCTION" ? Math.min(p.shares, Math.ceil(p.shares - a.value*a.maxPositionBps/10000/e.price)) : Math.floor(p.shares*.25);
    if (shares <= 0) return {...result, reason: "HOLD: a partial trim is smaller than one whole share."};
    const proceeds = money(shares*e.price), gain = money(shares*(e.price-p.averageCost));
    const net = money(proceeds - proceeds*a.slippageBps/10000 - a.commission - Math.max(0,gain)*(a.taxRate ?? 0));
    Object.assign(result, {action: full ? "SELL" : "TRIM", shares, proceeds, remainingShares: p.shares-shares, realizedGain: gain, cashAfter: money(a.cash+net), sellReason: reason, reason});
    result.supporting.push(reason);
    if (reason !== "THESIS BROKEN" && reason !== "GOAL/REBALANCE" && p.strategy !== "OPTIONS") {
      result.reentry = makeReentry({...p,shares:p.shares-shares},e,{...a,cash:result.cashAfter},Math.max(0,net),now);
      result.allocation = "REBUY SAME STOCK LATER";
      if (!result.reentry || a.taxRate === null) {result.pipeline="INCOMPLETE"; result.reason += ": reentry geometry, thesis or tax assumptions require review";}
    } else result.reason += reason === "THESIS BROKEN" ? ": no automatic rebuy; research required until fundamentals recover." : ": hold proceeds for account goals or a separately evaluated new contract.";
    return result;
  }
  if (e.thesis === "VALID" && trend && e.valuationAttractive && e.newsClear && e.marketStrong && e.sectorStrong && e.relativeStrength > 0 && e.volumeRatio >= 1.2 && p.strategy !== "OPTIONS") {
    const stop = e.support - e.atr*.5, shares = sizeReentry(a.cash,e.price,stop,p,a);
    if (shares > 0) return {...result,action:p.shares ? "ADD":"BUY NOW",shares,cost:money(shares*e.price*(1+a.slippageBps/10000)+a.commission),cashAfter:money(a.cash-shares*e.price*(1+a.slippageBps/10000)-a.commission),stop,reason:"Thesis, valuation, trend, volume, regime and account risk agree."};
  }
  return result;
}
export function monitorReentry(plan: ReentryPlan, p: PositionState, e: Evidence, a: AccountRisk, now = Date.now()) {
  if (["CANCELLED","EXPIRED","REENTERED"].includes(plan.status)) return {plan,shares:0,price:e.price,alert:null};
  if (e.thesis === "BROKEN" || (fresh(e,now,p.strategy) && e.price < plan.invalidation)) return {plan:{...plan,status:"CANCELLED" as const,reservedCash:0,reason:"Thesis or support invalidated; research required; proceeds held as cash."},shares:0,price:e.price,alert:null};
  if (now >= Date.parse(plan.expiresAt)) return {plan:{...plan,status:"EXPIRED" as const,reservedCash:0,reason:"Maximum wait elapsed; release reservation and reassess cash versus rotation."},shares:0,price:e.price,alert:null};
  const confirmed = fresh(e,now,p.strategy) && e.thesis === "VALID" && e.price >= e.sma20 && e.price >= e.sma50 && e.volumeRatio >= 1.2 && e.relativeStrength > 0 && e.marketStrong && e.sectorStrong && e.newsClear && e.valuationAttractive;
  const pullback = e.price >= plan.low && e.price <= plan.high;
  const breakout = e.price > plan.breakout && e.price <= plan.breakoutLimit && e.volumeRatio >= 1.5;
  const shares = confirmed && (pullback || breakout) ? sizeReentry(plan.reservedCash,e.price,plan.invalidation,p,a) : 0;
  const next = {...plan,status:shares > 0 ? "READY" as const : "WATCH" as const,mode:breakout ? "BREAKOUT" as const : "PULLBACK" as const};
  const cost = money(shares*e.price*(1+a.slippageBps/10000)+a.commission);
  return {plan:next,shares,price:e.price,alert:shares > 0 && plan.status !== "READY" ? `${p.ticker} REENTRY READY — Buy ${shares} shares at or below $${e.price.toFixed(2)} if support holds and volume confirms. Estimated cost $${cost.toFixed(2)}. Cash after $${money(a.cash-cost).toFixed(2)}.` : null};
}
export type RotationCandidate = {horizonDays?:number;modelVersion?:string;strategyVersion?:string;ticker:string; expectedReturn:number; downside:number; costs:number; valuation:boolean; technical:boolean; fundamentals:boolean; accountFit:boolean; concentration:boolean; asOf:string};
export function compareCapital(cashReturn: number, original: RotationCandidate | null, candidates: RotationCandidate[], now=Date.now()) {
  if(!original)return {choice:"HOLD CASH" as const,ticker:null,reason:"Original-position return and risk estimates are missing; rotation cannot be justified against HOLD or rebuy."};
  const eligible = (x: RotationCandidate) => x.valuation && x.technical && x.fundamentals && x.accountFit && x.concentration && x.downside>0 && now-Date.parse(x.asOf)>=0 && now-Date.parse(x.asOf)<86400000;
  const score = (x: RotationCandidate) => (x.expectedReturn-x.costs)/x.downside;
  const baseline = Math.max(cashReturn, original && eligible(original) ? score(original) : cashReturn);
  const replacement = candidates.filter(eligible).filter(x=>x.ticker!==original?.ticker&&x.horizonDays===original.horizonDays&&x.modelVersion===original.modelVersion&&x.strategyVersion===original.strategyVersion).sort((a,b)=>score(b)-score(a))[0];
  if (replacement && score(replacement) > baseline+.25) return {choice:"ROTATE" as const,ticker:replacement.ticker,reason:"Replacement risk-adjusted return exceeds cash and original by >0.25 after taxes and transaction costs."};
  return {choice:original && eligible(original) && score(original)>cashReturn ? "REBUY SAME STOCK LATER" as const : "HOLD CASH" as const,ticker:original?.ticker ?? null,reason:"No replacement clears the material improvement threshold; retain cash or the existing reentry reservation."};
}
export function evaluateOutcome(exit: {price:number;shares:number;netProceeds:number;basis:number}, prices:number[], rebuy?:{price:number;shares:number;cost:number}, rotationValue?:number) {
  const current=prices.at(-1) ?? exit.price, high=Math.max(exit.price,...prices), low=Math.min(exit.price,...prices), holdValue=exit.shares*current;
  const actualValue=rotationValue ?? (rebuy ? rebuy.shares*current+exit.netProceeds-rebuy.cost : exit.netProceeds);
  return {postSaleMaximumUpside:money((high-exit.price)*exit.shares),subsequentDrawdown:money((exit.price-low)*exit.shares),missedUpside:money(Math.max(0,holdValue-actualValue)),avoidedLoss:money(Math.max(0,actualValue-holdValue)),realizedReturn:money(exit.netProceeds-exit.basis),reentrySuccess:rebuy ? actualValue>holdValue:null,reentryImprovement:rebuy ? money(actualValue-holdValue):null,rotationBeatOriginal:rotationValue===undefined?null:rotationValue>holdValue,excessVsHold:money(actualValue-holdValue),holdValue:money(holdValue),actualValue:money(actualValue)};
}
