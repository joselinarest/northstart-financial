import type {FlowEvidence} from "./flow-evidence";
import type {PatternBar} from './pattern-evidence';

export type ReviewInput={flow?:FlowEvidence|null;exitId:string;shares:number;exitPrice:number;exitAt:string;netProceeds:number;basis:number|null;entryAt:string|null;entryPrice:number|null;entryConfirmed:boolean|null;stop:number|null;predicted:unknown;patterns:{name:string;direction:string}[];modelVersion:string;strategyVersion:string;sellReason:string|null};
export function buildPostTradeReview(input:ReviewInput,bars:PatternBar[]){
  const exitTime=Date.parse(input.exitAt),entryTime=input.entryAt?Date.parse(input.entryAt):NaN;
  const valid=bars.filter(b=>Number.isFinite(Date.parse(b.time))&&[b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)&&b.high>=b.low).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
  // Daily candles overlapping either execution cannot establish intraday event ordering.
  const held=valid.filter(b=>Date.parse(b.time)>entryTime&&Date.parse(b.time)+86400000<=exitTime);
  const after=valid.filter(b=>Date.parse(b.time)>exitTime),last=after.at(-1),knownEntry=Boolean(input.entryPrice&&input.entryPrice>0);
  const completeHoldingPath=knownEntry&&held.length>0&&valid.some(b=>Date.parse(b.time)<=entryTime);
  const realized=input.basis===null?null:input.netProceeds-input.basis;
  const holdValue=last?last.close*input.shares:null,excess=holdValue===null?null:input.netProceeds-holdValue;
  const stopped=completeHoldingPath&&input.stop!==null?held.some(b=>b.low<=input.stop!):null;
  const evidenceAttribution=input.patterns.map(p=>({name:p.name,assessment:!last?'PENDING':(p.direction==='UP'&&last.close>input.exitPrice)||(p.direction==='DOWN'&&last.close<input.exitPrice)?'DIRECTION_MATCHED':'DIRECTION_NOT_CONFIRMED',qualification:'Observed association after exit; not evidence of causation or a calibrated signal.'}));
  for(const name of ['Options flow','GEX','Dark-pool levels']){
    const observed=input.flow?.retrievedAt?Date.parse(input.flow.retrievedAt):NaN;
    const contemporaneous=Number.isFinite(observed)&&observed<=exitTime;
    const directional=name==='Options flow'&&contemporaneous&&input.flow?.conviction!==null&&['BULLISH','BEARISH'].includes(input.flow?.direction||'');
    const change=last?last.close-input.exitPrice:null;
    evidenceAttribution.push({name,assessment:!contemporaneous?'UNAVAILABLE':!directional||change===null||change===0?'NEUTRAL':((input.flow!.direction==='BULLISH')===(change>0))?'USEFUL':'MISLEADING',qualification:'Post-exit directional association only; not causal trade attribution. GEX/dark-pool usefulness requires a preregistered level-response hypothesis. No automatic retraining.'});
  }
  return {version:'post-trade-1',exitId:input.exitId,status:!last?'AWAITING_POST_EXIT_DATA':completeHoldingPath?'PROVISIONAL':'INCOMPLETE_ENTRY_HISTORY',asOf:last?.time??input.exitAt,predicted:input.predicted,modelVersion:input.modelVersion,strategyVersion:input.strategyVersion,sellReason:input.sellReason,
    actual:{exitPrice:input.exitPrice,shares:input.shares,netProceeds:input.netProceeds,realizedResult:realized,realizedReturnBps:realized!==null&&input.basis!>0?Math.round(realized/input.basis!*10000):null},
    entryAssessment:input.entryConfirmed===null?'UNKNOWN — original entry confirmation not recorded':input.entryConfirmed?'Original entry confirmation recorded; profitability is evaluated separately':'Entry confirmation was missing; review execution discipline',
    stopAssessment:stopped===null?'UNKNOWN — complete entry path and original stop required':stopped?'Original stop was crossed on a full holding-period candle; inspect fills and gap/slippage':'No stop breach observed on complete interior daily candles; entry/exit-day sequencing unavailable',
    maximumFavorableExcursionBps:completeHoldingPath?Math.round((Math.max(input.entryPrice!,...held.map(b=>b.high))/input.entryPrice!-1)*10000):null,
    maximumAdverseExcursionBps:completeHoldingPath?Math.round((Math.min(input.entryPrice!,...held.map(b=>b.low))/input.entryPrice!-1)*10000):null,
    holdComparison:{asOf:last?.time??null,holdValue,excessVsHold:excess,holdWouldHaveBeenBetter:excess===null?null:excess<0,soldTooEarly:excess===null?'PENDING':excess<0?'HOLD outperformed through this observation horizon; not proof the sale was wrong ex ante':'Sale proceeds exceeded HOLD through this observation horizon',missedUpside:last?Math.max(0,Math.max(...after.map(b=>b.high))-input.exitPrice)*input.shares:null,avoidedLoss:last?Math.max(0,input.exitPrice-Math.min(...after.map(b=>b.low)))*input.shares:null},
    evidenceAttribution,lessons:[...(!completeHoldingPath?['Entry attribution or complete price history is missing; do not score entry quality.']:[]),...(stopped?['Review whether the planned stop was honored and whether volatility or a gap explains the breach.']:[]),...(excess!==null&&excess<0?['Compare partial trim and trailing-stop alternatives in a controlled evaluation.']:[]),'Aggregate by pattern, evidence combination, sell reason, strategy and model version before proposing a rule change.'],
    limitations:['MFE/MAE cover complete interior daily bars only, excluding execution-day ambiguity; intraday excursions may differ.','HOLD benchmark excludes hypothetical tax, financing and transaction costs; proceeds use the recorded exit calculation.','Pattern attribution is observational. No model retraining or strategy mutation is performed.'],automaticRuleChanges:false};
}
