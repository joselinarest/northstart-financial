import {id,type PostgresDatabase} from '@/lib/db';
import {coreScenarios} from './core-scenario-model';
import {safeDecision,type DecisionInput,type DecisionOutput,type DecisionCandidate} from './ai-investment-decision-engine';
import {candidateIsSafe,strictDecisionQuality,decisionSnapshotId,redactDecisionData} from './decision-validation';
import {sizeReentry,type AccountRisk,type PositionState,type Evidence,type Action} from './trade-lifecycle';
import {researchMarketFresh,sessionWindow} from './research-market-freshness';

export const CORE_VERSION='account-rules-1';
const buying=(c:DecisionCandidate)=>['BUY_NOW','BUY_IF','ADD','REBUY_IF','ROTATE_CAPITAL'].includes(c.action);
const selling=(c:DecisionCandidate)=>['SELL_NOW','SELL_IF','TRIM'].includes(c.action);
type Row=Record<string,any>;

/** Candidate eligibility alone cannot authorize a recommendation. Recheck its facts and economics. */
export function coreCandidateChecks(input:DecisionInput,c:DecisionCandidate):string[]{
  const reasons:string[]=[];
  if(!candidateIsSafe(c))reasons.push('Candidate price, quantity, cash arithmetic or confirmed entry plan failed validation.');
  if(!buying(c)&&!selling(c)&&!c.contractSymbol)return reasons;
  const f=input.features as Row;
  if(input.requestType==='TRADE_LIFECYCLE'){
    const e=f.technical as Evidence,p=f.position as PositionState,r=f.accountRisk as AccountRisk,a=f.deterministicAction as Action;
    if(!e?.complete||a?.pipeline!=='COMPLETE')reasons.push(a?.reason||'Underlying research is incomplete.');
    if(!p||!r||!a)return [...reasons,'Position and account risk snapshot required.'];
    if(c.id!=='lifecycle')reasons.push('Trade must match the evaluated lifecycle proposal.');
    if(c.shares!==a.shares||c.entry!==a.price||Math.abs(c.cashBefore-r.cash)>.01)reasons.push('Candidate differs from the account snapshot.');
    if(selling(c)){
      if(c.shares>p.shares||p.basisKnown===false)reasons.push('Verified owned quantity and cost basis are required for a sale.');
    }else{
      const policy=f.accountPolicy?.tradingPolicy||{};
      if(p.thesisStatus!=='VALID')reasons.push('The underlying thesis must remain valid.');
      if(p.strategy==='SWING'&&policy.swingEnabled===false)reasons.push('Swing entries are disabled for this account.');
      if(p.strategy==='LONG_TERM'&&policy.longTermEnabled===false)reasons.push('Long-term entries are disabled for this account.');
      if(f.accountPolicy?.strategy==='LONG_TERM_ETF'&&!/^etf$/i.test(f.accountPolicy?.securityType||''))reasons.push('This account only permits ETF allocation.');
      if(!e.newsClear)reasons.push('News and catalyst risk have not cleared.');
      if(p.strategy==='SWING'&&(!e.marketStrong||!e.sectorStrong||e.volumeRatio<1.2||e.relativeStrength<=0||e.price<e.sma20||e.price<e.sma50))reasons.push('Trend, volume, relative strength and market/sector confirmation must all pass.');
      const capacity=sizeReentry(r.cash,Number(c.entry),Number(c.stop),p,r);
      if(c.shares>capacity)reasons.push('Quantity exceeds verified cash, reserve, concentration, liquidity or open-risk capacity.');
      const rr=(Number(c.targets[0])-Number(c.entry))/(Number(c.entry)-Number(c.stop));
      if(p.strategy==='SWING'&&(!Number.isFinite(rr)||rr+1e-9<Number(policy.minimumRewardRisk??2)))reasons.push(`Reward/risk ${Number.isFinite(rr)?rr.toFixed(2):'not verified'} is below the account requirement ${Number(policy.minimumRewardRisk??2)}.`);
    }
  }else if(input.strategy==='OPTIONS'&&['OPTIONS_SELECTOR','OPTIONS_NEXT_OPEN_RESEARCH'].includes(input.requestType)){
    const research=input.requestType==='OPTIONS_NEXT_OPEN_RESEARCH';
    const chain=(f.chainSummary||[]) as Row[],contract=chain.find(r=>r.contractSymbol===c.contractSymbol),vol=(f.contractVolatility||[]).find((r:Row)=>r.contractSymbol===c.contractSymbol);
    const underlying=f.underlyingThesis as DecisionOutput|undefined;
    if(!underlying||underlying.providerStatus!=='AVAILABLE')reasons.push('Verified underlying decision is required.');
    if(c.instrument==='SHARES'){
      if(!underlying?.deterministicCandidates?.some(p=>p.eligible&&p.instrument==='SHARES'&&p.entry===c.entry&&p.shares===c.shares))reasons.push('Stock alternative does not match the underlying decision.');
      if(c.shares*(Number(c.entry)-Number(c.stop))>Number(f.maxRisk))reasons.push('Stock alternative exceeds the risk budget.');
    }else{
      const tech=underlying?.evidenceSources?.find(e=>e.label==='technical')?.value as Row|undefined;
      const aligned=research?(c.instrument==='CALL'?tech?.state==='BULLISH'&&tech.price>tech.sma20&&tech.price>tech.sma50:tech?.state==='BEARISH'&&tech.price<tech.sma20&&tech.price<tech.sma50):(c.instrument==='CALL'?['BUY_NOW','BUY_IF','ADD','REBUY_IF'].includes(underlying?.action||''):['SELL_NOW','SELL_IF'].includes(underlying?.action||'')&&underlying?.thesisStatus==='BROKEN');
      if(!aligned)reasons.push('Contract direction does not match the independently verified underlying thesis.');
      if(!contract||!vol?.[research?'researchAllowed':'allowed'])reasons.push('Contract liquidity, volatility and quote validation must pass.');
      if(contract&&(!researchMarketFresh(contract.quoteAsOf||'',120000)||Number(contract.openInterest)<=0||Number(contract.volume)<10||contract.spreadPct>8))reasons.push('Contract quote, spread, open interest or volume failed.');
      if(contract&&(![contract.delta,contract.gamma,contract.theta,contract.vega,contract.impliedVolatility].every(n=>typeof n==='number'&&Number.isFinite(n))||contract.gamma<0||contract.vega<0||contract.impliedVolatility<=0||contract.dte<14||contract.dte>30||(c.instrument==='CALL'?contract.delta<=0||contract.delta>1:contract.delta>=0||contract.delta< -1)))reasons.push('Contract Greeks, IV or supported holding period failed.');
      if(!f.catalystGate?.pass)reasons.push('Contract catalyst risk has not cleared.');
      if(!research&&c.cost>Number(f.maxRisk))reasons.push('Total premium exceeds the account option-risk cap.');
      if(contract&&c.entry!==contract.ask)reasons.push('Entry premium does not match the verified contract ask.');
    }
  }else reasons.push('No reviewed deterministic strategy evaluator supports this request.');
  return reasons;
}

export async function runCoreDecision(input:DecisionInput,{db,persist=true}:{db?:PostgresDatabase;persist?:boolean}={}):Promise<DecisionOutput>{
  const started=Date.now(),q=strictDecisionQuality(input),snapshotId=decisionSnapshotId(input);
  const currentPrice=input.evidence.find(e=>e.label==='currentPrice')?.value;
  if(typeof currentPrice!=='number'||!Number.isFinite(currentPrice)||currentPrice<=0)q.missing.push('verified positive currentPrice');
  const checks=(input.candidates||[]).map(c=>({candidateId:c.id,reasons:coreCandidateChecks(input,c)})).map(c=>({...c,passed:c.reasons.length===0}));
  const dataPass=!q.missing.length&&!q.stale.length&&!q.conflicts.length;
  const eligible=(input.candidates||[]).filter(c=>checks.find(r=>r.candidateId===c.id)?.passed);
  // Risk-reducing exits first; entry candidates already carry strategy-specific sizing and confirmation.
  // Option contract ranking uses the researched chain score, never the cheapest premium.
  const score=(c:DecisionCandidate)=>selling(c)?10000:buying(c)||c.contractSymbol?100+Number((input.features.chainSummary as Row[]|undefined)?.find(r=>r.contractSymbol===c.contractSymbol)?.score||0):0;
  const selected=dataPass?eligible.slice().sort((a,b)=>score(b)-score(a))[0]:undefined;
  const action=input.features.deterministicAction as Action|undefined;
  const blocked=checks.filter(c=>!c.passed).flatMap(c=>c.reasons);
  const researchOnly=input.requestType==='OPTIONS_NEXT_OPEN_RESEARCH';
  let result:DecisionOutput={...safeDecision(input,q,CORE_VERSION,CORE_VERSION),decisionSource:'RULES',planState:'RESEARCH_REQUIRED',snapshotId,schemaVersion:'core-decision-1',providerStatus:selected?'AVAILABLE':'INSUFFICIENT_DATA',coreAudit:{version:CORE_VERSION,passed:Boolean(selected),checks},confidenceBasis:'Rule conformance score; not a probability of profit.',confidence:selected?q.score:0,confidenceBand:selected?'VERY_HIGH':'LOW',executionAllowed:false,deterministicCandidates:input.candidates||[],evidenceSources:input.evidence,modelInferences:[],providerFacts:input.evidence.filter(e=>e.sourceType!=='MODEL_INFERENCE').map(e=>`${e.label}: ${JSON.stringify(redactDecisionData(e.value))}`),interpretation:'Required market or account evidence has not passed verification.',reasoningFactors:[...q.missing.map(s=>'Missing '+s),...q.stale.map(s=>'Stale '+s),...q.conflicts,...blocked],whatWouldChange:[...blocked,...q.missing.map(s=>'Refresh '+s),...q.stale.map(s=>'Revalidate '+s)],historicalSimilarity:'No calibrated historical win probability is asserted by the rules engine.'};
  if(selected){
    const c=selected,passive=!buying(c)&&!selling(c),multiplier=c.instrument==='CALL'||c.instrument==='PUT'?100:1;
    const reason=passive?(action?.reason||c.reason):c.reason;
    result={...result,planState:researchOnly&&c.contractSymbol?'PREPARE':passive?(c.action==='HOLD'?'HOLD':'HOLD_CASH'):'READY',action:c.action,candidateId:c.id,shares:c.shares,entry:c.entry,trigger:c.trigger,stop:c.stop,targets:c.targets,entryPlan:c.entryPlan,cashBefore:c.cashBefore,cashAfter:c.cashAfter,expectedCostProceeds:c.proceeds||c.cost,thesisStatus:c.thesisStatus,sellReason:c.sellReason,reentryPlan:c.reentryPlan,instrument:c.instrument,contractSymbol:c.contractSymbol,interpretation:reason,reasoningFactors:[reason,...(action?.supporting||[])],contradictingEvidence:[...(action?.opposing||[]),...blocked],whatWouldChange:[...(c.entryPlan?.confirmationRequired||[]),...(c.entryPlan?.cancelConditions||[]),...blocked,'Reassess when price, thesis, cash, concentration or account risk changes.'],risk:researchOnly?'Next-session research only. Live quotes, entry confirmation and account risk must be revalidated.':'Prices can gap beyond invalidation. Planned loss is an estimate, not a guaranteed maximum.',invalidation:c.stop?`Reassess at invalidation ${c.stop}; cancel on thesis or account-risk changes.`:'Reassess on thesis, allocation or risk changes.',payoff:{plannedLoss:!passive&&buying(c)&&c.entry&&c.stop?Math.max(0,(c.entry-c.stop)*c.shares*multiplier):null,targetGains:!passive&&buying(c)&&c.entry?c.targets.map(t=>(t-c.entry!)*c.shares*multiplier):[],maxPremiumLoss:multiplier===100&&buying(c)?c.cost:null,basis:'Conditional price scenarios, before exit fees/taxes; no win probabilities assumed.'}};
    const prepared=(input.features.position as PositionState|undefined)?.entryPlan;
    if(passive&&prepared?.status==='WATCH'&&prepared.shares>0){result.planState='PREPARE';result.entryPlan=prepared;result.whatWouldChange=[...prepared.confirmationRequired,...prepared.cancelConditions,...blocked];}
    if(!passive&&!sessionWindow(started).regular){result.planState='PREPARE';result.whatWouldChange.unshift('Revalidate at the next regular session before submitting an order.');}
    const geometry=input.features.rotationScenarios as {price:number;bull:number;base:number;bear:number;horizonDays:number}|null,e=input.features.technical as Evidence|undefined;
    if(geometry&&e){
      const signals=[e.thesis==='VALID',e.valuationAttractive,e.marketStrong,e.sectorStrong,e.newsClear,e.price>=e.sma20&&e.price>=e.sma50];
      const scenarios=coreScenarios({...geometry,positiveSignals:signals.filter(Boolean).length,negativeSignals:signals.filter(x=>!x).length,asOf:input.dataTimestamp});
      if(scenarios){result.returnEstimate=scenarios;result.scenarioBasis=scenarios.basis;for(const key of ['bull','base','bear'] as const)result[key]={probability:scenarios[key].probability,priceZone:String(scenarios[key].price),confirmation:key==='bull'?'Trend, thesis and entry confirmation remain valid':key==='bear'?'Invalidation or thesis deterioration':'No material directional change',invalidation:'Recalculate when verified evidence changes'};}
    }
  }
  if(db&&persist){
    const decisionId=id('core_decision');result.decisionId=decisionId;
    const capturedAt=new Date().toISOString(),expiresAt=new Date(started+(input.strategy==='LONG_TERM_SHARES'?86400000:1200000)).toISOString();
    // Keep the existing immutable decision ledger and account/ticker pointers for all consumers.
    // provider=RULES and decisionSource distinguish this authority from optional AI commentary.
    await db.transaction(async tx=>{
      await tx.prepare('INSERT INTO ai_decision_runs(id,household_id,account_id,ticker,strategy,request_type,input_snapshot_json,evidence_json,output_json,data_quality,model_version,strategy_version,provider,status,latency_ms,data_timestamp,snapshot_id,schema_version,error_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(decisionId,input.householdId,input.accountId,input.ticker,input.strategy,input.requestType,JSON.stringify(redactDecisionData(input.features)),JSON.stringify(redactDecisionData(input.evidence)),JSON.stringify(result),q.score,CORE_VERSION,CORE_VERSION,'RULES',selected?'COMPLETED':'REJECTED_BY_GATE',Date.now()-started,Number.isFinite(Date.parse(input.dataTimestamp))?input.dataTimestamp:capturedAt,snapshotId,'core-decision-1',selected?null:'INSUFFICIENT_DATA').run();
      await tx.prepare('INSERT INTO ai_current_decisions(account_id,ticker,strategy,decision_id,snapshot_id,captured_at,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id,ticker,strategy) DO UPDATE SET decision_id=EXCLUDED.decision_id,snapshot_id=EXCLUDED.snapshot_id,captured_at=EXCLUDED.captured_at,expires_at=EXCLUDED.expires_at WHERE ai_current_decisions.captured_at<=EXCLUDED.captured_at').bind(input.accountId,input.ticker,input.strategy,decisionId,snapshotId,capturedAt,expiresAt).run();
      if(selected&&process.env.OPENAI_API_KEY&&process.env.AI_REVIEW_ENABLED!=='false'&&(buying(selected)||selling(selected)||result.planState==='PREPARE'))await tx.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,'AI_EVENT_REVIEW',?,?::jsonb) ON CONFLICT DO NOTHING").bind(id('optional_ai'),input.householdId,`optional-ai:${input.accountId}:${input.ticker}:${input.strategy}:${Math.floor(started/1800000)}`,JSON.stringify({accountId:input.accountId,symbol:input.ticker,mode:'AI_SECONDARY',decisionId})).run();
    });
  }
  return result;
}
