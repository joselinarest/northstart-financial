import {id,type PostgresDatabase} from "@/lib/db";
import {decideInvestment,type DecisionCandidate,type EvidenceItem,type DecisionOutput} from "@/lib/ai-investment-decision-engine";
import type {AIProvider} from "@/lib/ai-provider";
import type {Action,PositionState,Evidence,AccountRisk} from "@/lib/trade-lifecycle";
import {watchEntry,monitorEntry,entryOrderReady} from "@/lib/entry-plan";
import {sizeReentry} from "@/lib/trade-lifecycle";
import {fridaySwingGate,recommendedTradingPolicy,type TradingPolicy} from "@/lib/trading-policy";

export function lifecycleCandidates(position:PositionState,action:Action):DecisionCandidate[]{
  const names:Record<Action['action'],DecisionCandidate['action']>={"BUY NOW":"BUY_NOW","BUY IF":"BUY_IF",ADD:"ADD",HOLD:"HOLD",TRIM:"TRIM",SELL:"SELL_NOW","REBUY IF":"REBUY_IF","NO ACTION":"NO_ACTION"};
  const passive:DecisionCandidate={id:"maintain",action:position.shares?"HOLD":"NO_ACTION",shares:0,entry:null,trigger:null,stop:position.stop,targets:[position.target1,position.target2].filter((v):v is number=>v!==null),cost:0,proceeds:0,cashBefore:action.cashBefore,cashAfter:action.cashBefore,thesisStatus:position.thesisStatus,sellReason:null,reentryPlan:null,instrument:"NO_TRADE",eligible:true,reason:"Maintain exposure or hold cash; no trading costs or reentry risk."};
  const proposal:DecisionCandidate={id:"lifecycle",action:names[action.action],shares:action.shares,entry:action.price||null,trigger:action.entryPlan?.trigger??action.price??null,stop:action.reentry?.invalidation||action.stop,targets:action.targets,cost:action.cost,proceeds:action.proceeds,cashBefore:action.cashBefore,cashAfter:action.cashAfter,thesisStatus:position.thesisStatus,sellReason:action.sellReason,reentryPlan:action.reentry,instrument:position.strategy==="OPTIONS"?(/\d{6}C/.test(position.ticker)?"CALL":"PUT"):"SHARES",contractSymbol:position.strategy==="OPTIONS"?position.ticker:undefined,eligible:action.pipeline==="COMPLETE"&&action.shares>0,reason:action.reason};
  // A broken thesis is never turned into a fresh BUY candidate.
  proposal.entryPlan=action.entryPlan;
  if(["SELL_NOW","SELL_IF","TRIM"].includes(proposal.action)&&position.basisKnown===false){proposal.eligible=false;proposal.reason="Cost basis unavailable; estimated realized gain/loss cannot be verified.";}
  return [passive,proposal];
}
type Facts={checks:Record<string,unknown>;fundamentals:unknown;fundamentalAsOf?:string;news:unknown;valuation:unknown;technical:unknown;marketRegime:unknown;accountPolicy:unknown;researchComplete:boolean};
export async function reasonLifecycle(db:PostgresDatabase,householdId:string,securityId:string,p:PositionState,a:Action,e:Evidence,risk:AccountRisk,facts:Facts,aiProvider?:AIProvider):Promise<DecisionOutput>{
  if(p.entryPlan&&e.entryObservation)p.entryPlan=monitorEntry(p.entryPlan,e.entryObservation);
  if(["BUY NOW","BUY IF","ADD","REBUY IF"].includes(a.action)){
    const policy=(facts.accountPolicy as {tradingPolicy?:TradingPolicy})?.tradingPolicy||recommendedTradingPolicy({accountType:p.strategy,value:risk.value,cash:risk.cash,largestPositionBps:risk.value?p.shares*e.price/risk.value*10000:0,liquid:e.volumeRatio>=1.2});
    const friday=fridaySwingGate(new Date(),p.strategy==="SWING"?"SWING":"LONG_TERM",policy,{fundamentals:e.thesis==="VALID"&&e.valuationAttractive,trend:e.price>=e.sma20&&e.price>=e.sma50,market:e.marketStrong,sector:e.sectorStrong,technical:e.volumeRatio>=1.5,liquid:e.volumeRatio>=1.5,weekendCatalystClear:(facts.checks.catalysts as {weekendClear?:boolean})?.weekendClear===true,rewardRisk:a.stop&&a.targets[0]?(a.targets[0]-e.price)/(e.price-a.stop):0,confidence:Number(facts.checks.confidence||0)});
    if(!friday.allowed){Object.assign(a,{action:"NO ACTION",shares:0,cost:0,proceeds:0,cashAfter:risk.cash,pipeline:"INCOMPLETE",reason:friday.reason});}
  }
  if(["BUY NOW","BUY IF","ADD","REBUY IF"].includes(a.action)){
    let plan=p.entryPlan||watchEntry({trigger:a.reentry?.mode==="BREAKOUT"?a.reentry.breakout:a.reentry?.high||a.price,low:a.reentry?.low,high:a.reentry?.high,stop:a.reentry?.invalidation||a.stop,targets:a.targets,shares:a.shares});
    if(e.entryObservation)plan=monitorEntry(plan,e.entryObservation);
    if(plan.status==="CONFIRMED"&&e.ask&&e.ask>=e.price){
      const cap=a.reentry?.mode==="BREAKOUT"?a.reentry.breakoutLimit:(plan.zoneHigh??plan.trigger??0)+e.atr*.1;
      // An observed ask is a separate order limit. Never substitute the trigger.
      if(e.ask<=cap){
        const shares=sizeReentry(a.reentry?.reservedCash??risk.cash,e.ask,Number(plan.stopAfterEntry),p,risk);
        plan={...plan,classification:a.reentry?.mode==="BREAKOUT"?"BREAKOUT/STOP-LIMIT":a.reentry?"CONFIRMED PULLBACK":"LIMIT ENTRY",orderType:a.reentry?.mode==="BREAKOUT"?"STOP_LIMIT":"LIMIT",orderPrice:e.ask,orderStopPrice:a.reentry?.mode==="BREAKOUT"?e.price:null,shares,actionAfterConfirmation:`Buy ${shares} shares with limit $${e.ask.toFixed(2)} only while confirmation remains valid. User confirmation required.`};
      }
    }
    p.entryPlan=plan;a.entryPlan=plan;
    if(!entryOrderReady(plan)){Object.assign(a,{action:"NO ACTION",shares:0,cost:0,proceeds:0,cashAfter:risk.cash,pipeline:"INCOMPLETE",reason:plan.actionAfterConfirmation});}
    else {a.price=plan.orderPrice!;a.shares=plan.shares;a.cost=Math.round((a.price*a.shares*(1+risk.slippageBps/10000)+risk.commission)*100)/100;a.cashAfter=Math.round((risk.cash-a.cost)*100)/100;}
  }
  a.entryPlan=p.entryPlan;
  const asOf=p.lastAnalysisAt,source=(label:string,value:unknown,time=asOf,sourceType:EvidenceItem['sourceType']="CALCULATION"):EvidenceItem=>({label,value,asOf:time,sourceType,sourceId:"NORTHSTAR_VERIFIED_SNAPSHOT"});
  const evidence=[source("currentPrice",e.price,e.asOf,"PROVIDER"),source("fundamentals",facts.researchComplete?facts.fundamentals:null,facts.fundamentalAsOf||"","PROVIDER"),source("technical",facts.technical,e.asOf),source("patterns",facts.checks.patterns??[],e.asOf),source("portfolio",{shares:p.shares,averageCost:p.basisKnown===false?null:p.averageCost,basisStatus:p.basisKnown===false?'Cost basis unavailable':'AVAILABLE',value:risk.value}),source("accountCash",risk.cash),source("riskLimit",{maxPositionBps:risk.maxPositionBps,maxRiskBps:risk.maxRiskBps,reservedElsewhere:risk.reservedElsewhere}),source("news",facts.news,e.asOf,"PROVIDER"),source("valuation",facts.valuation,facts.fundamentalAsOf||""),source("marketRegime",facts.marketRegime,e.asOf,"PROVIDER")];
  if(p.strategy==="OPTIONS")evidence.push(source("underlyingThesis",p.thesisStatus),source("optionQuote",e.options?{premium:e.options.premium,iv:e.options.iv,dte:e.options.dte}:null,e.asOf,"PROVIDER"),source("greeks",e.options?{delta:e.options.delta,gamma:e.options.gamma,theta:e.options.theta,vega:e.options.vega}:null,e.asOf,"PROVIDER"),source("liquidity",e.options?.bid&&e.options?.ask?{bid:e.options.bid,ask:e.options.ask,spread:e.options.ask-e.options.bid}:null,e.asOf,"PROVIDER"));
  const input={householdId,accountId:p.investmentAccountId,accountName:"Investment account",strategy:p.strategy==="LONG_TERM"?"LONG_TERM_SHARES" as const:p.strategy==="OPTIONS"?"OPTIONS" as const:"SWING_SHARES" as const,ticker:p.ticker,requestType:"TRADE_LIFECYCLE",features:{rotationScenarios:p.strategy!=="OPTIONS"&&a.targets[0]>e.price&&Number(a.stop)>0&&Number(a.stop)<e.price?{horizonDays:p.strategy==="SWING"?Number((facts.accountPolicy as any)?.tradingPolicy?.maxSwingDays||14):365,price:e.price,bull:a.targets[0],base:e.price,bear:a.stop}:null,position:p,accountRisk:risk,accountPolicy:facts.accountPolicy,patterns:facts.checks.patterns??[],technical:e,deterministicAction:a},evidence,dataTimestamp:e.asOf,requiredFacts:[],candidates:lifecycleCandidates(p,a)};
  const decision=await decideInvestment(input,{db,aiProvider});
  const available=decision.providerStatus==="AVAILABLE",selected=decision.candidateId==="lifecycle";
  const published:Action&{aiEvidence:DecisionOutput;deterministicAction:Action}={...a,...(!available?{action:"NO ACTION" as const,shares:0,cost:0,proceeds:0,cashAfter:a.cashBefore,remainingShares:p.shares,realizedGain:0,pipeline:"INCOMPLETE" as const}:!selected?{action:p.shares?"HOLD" as const:"NO ACTION" as const,shares:0,cost:0,proceeds:0,cashAfter:a.cashBefore,remainingShares:p.shares,realizedGain:0,sellReason:null,reentry:p.reservedReentryCash>0?a.reentry:null}:{}),reason:decision.interpretation,supporting:decision.reasoningFactors,opposing:decision.contradictingEvidence,aiEvidence:decision,deterministicAction:a};
  if(published.entryPlan&&(!available||!selected)){published.entryPlan={...published.entryPlan,orderType:"NONE",orderPrice:null,orderStopPrice:null,actionAfterConfirmation:"No order recommended by the central decision. Continue monitoring or review cancellation."};}
  // Do not publish a response after a newer analysis superseded the snapshot.
  await db.transaction(async tx=>{
    const current=await tx.prepare("SELECT state_json FROM position_states WHERE account_id=? AND security_id=? FOR UPDATE").bind(p.investmentAccountId,securityId).first<{state_json:PositionState}>();
    if(current?.state_json.lastAnalysisAt!==p.lastAnalysisAt)return;
    const live=await tx.prepare("SELECT COALESCE(s.available_cash_cents,a.available_balance_cents,0)::text cash,(SELECT COALESCE(SUM(h.quantity),0) FROM holdings h WHERE h.account_id=a.id AND h.security_id=?)::text shares FROM accounts a LEFT JOIN investment_account_settings s ON s.account_id=a.id WHERE a.id=?").bind(securityId,p.investmentAccountId).first<{cash:string;shares:string}>();
    if(!live||Number(live.cash)/100!==risk.cash||Number(live.shares)!==p.shares){
      Object.assign(decision,{providerStatus:"SNAPSHOT_CHANGED",action:"WAIT",shares:0,interpretation:"Account cash or holdings changed during analysis. Rebuild the snapshot."});
      await tx.prepare("UPDATE ai_decision_runs SET status='REJECTED_BY_GATE',output_json=?,error_code='SNAPSHOT_CHANGED' WHERE id=?").bind(JSON.stringify(decision),decision.decisionId).run();
      await tx.prepare("UPDATE ai_current_decisions SET expires_at=CURRENT_TIMESTAMP WHERE decision_id=?").bind(decision.decisionId).run();
      await tx.prepare("UPDATE position_states SET action_json=? WHERE account_id=? AND security_id=?").bind(JSON.stringify({...published,action:"NO ACTION",shares:0,cost:0,proceeds:0,pipeline:"INCOMPLETE",reason:decision.interpretation,aiEvidence:decision}),p.investmentAccountId,securityId).run();
      return;
    }
    if(p.entryPlan)await tx.prepare("UPDATE position_states SET state_json=jsonb_set(state_json,'{entryPlan}',?::jsonb) WHERE account_id=? AND security_id=?").bind(JSON.stringify(p.entryPlan),p.investmentAccountId,securityId).run();
    const security={security_id:securityId};
    const recommendationId=id("ai_recommendation"),dbAction=decision.action==="SELL_NOW"?"SELL":decision.action==="TRIM"?"REDUCE":["BUY_NOW","BUY_IF","ADD","REBUY_IF"].includes(decision.action)?"BUY":decision.action==="HOLD"?"HOLD":"WAIT";
    await tx.prepare("UPDATE recommendations SET lifecycle='INVALIDATED' WHERE account_id=? AND security_id=? AND lifecycle IN ('MONITORING','TRIGGERED')").bind(p.investmentAccountId,security.security_id).run();
    await tx.prepare("INSERT INTO recommendations(id,household_id,account_id,security_id,strategy_type,action,lifecycle,suggested_quantity,entry_low_cents,entry_high_cents,ideal_price_cents,invalidation_cents,targets_json,confidence,reason,checks_json,actionable,model_version,strategy_version,evidence_as_of,expires_at,sell_reason,lifecycle_audit_json,pipeline_status) VALUES(?,?,?,?,?,?,'MONITORING',?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP+INTERVAL '20 minutes',?,?,?)").bind(recommendationId,householdId,p.investmentAccountId,security.security_id,p.strategy,available?dbAction:"WAIT",decision.shares,decision.entry?Math.round(decision.entry*100):null,decision.entry?Math.round(decision.entry*100):null,decision.entry?Math.round(decision.entry*100):null,decision.stop?Math.round(decision.stop*100):null,JSON.stringify(decision.targets.map(x=>Math.round(x*100))),decision.confidence,decision.interpretation,JSON.stringify({...facts.checks,researchOnly:false,aiEvidence:decision,researchSnapshot:input.features}),available&&selected&&a.pipeline==="COMPLETE",decision.modelVersion,decision.strategyVersion,e.asOf,decision.sellReason||null,JSON.stringify(published),published.pipeline).run();
    await tx.prepare("UPDATE position_states SET action_json=?,state_json=jsonb_set(state_json,'{recommendationId}',to_jsonb(?::text)) WHERE account_id=? AND security_id=? AND state_json->>'lastAnalysisAt'=?").bind(JSON.stringify(published),recommendationId,p.investmentAccountId,security.security_id,p.lastAnalysisAt).run();
  });
  return decision;
}
