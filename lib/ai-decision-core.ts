import {researchMarketFresh} from "@/lib/research-market-freshness";
import {flowForStrategy,flowDecisionSummary,type FlowEvidence} from "@/lib/flow-evidence";
import {QuantDataProvider} from "@/lib/providers/quant-data";
import {entryOrderReady} from "@/lib/entry-plan";
import {createHash} from "node:crypto";
import {id,type PostgresDatabase} from "@/lib/db";
import {safeDecision,type DecisionInput,type DecisionOutput,type DecisionCandidate,type DecisionModelAdapter} from "@/lib/ai-investment-decision-engine";
import {AI_SCHEMA_VERSION,configuredAIProvider,validateAIReasoning,type AIProvider,type AIRequest,type AIReasoning} from "@/lib/ai-provider";
const commonFacts=["currentPrice","fundamentals","technical","portfolio","accountCash","riskLimit","news","valuation","marketRegime"];
export function strictDecisionQuality(input:DecisionInput){
  const required=[...new Set([...commonFacts,...input.requiredFacts,...(input.strategy==="OPTIONS"?["underlyingThesis","optionQuote","greeks","liquidity"]:[])])];
  const labels=new Set(input.evidence.filter(e=>e.value!==null&&e.value!==undefined&&e.value!==""&&!(typeof e.value==="number"&&!Number.isFinite(e.value))&&!(typeof e.value==="object"&&!Array.isArray(e.value)&&!Object.keys(e.value as object).length)).map(e=>e.label));
  const missing=required.filter(x=>!labels.has(x));
  const stale=input.evidence.filter(e=>required.includes(e.label)).filter(e=>{const age=Date.now()-Date.parse(e.asOf||"");const limit=["fundamentals","valuation"].includes(e.label)?7*86400000:input.strategy==="LONG_TERM_SHARES"?86400000:20*60000;return ["currentPrice","technical","marketRegime"].includes(e.label)?!researchMarketFresh(e.asOf||"",limit):!Number.isFinite(age)||age<0||age>limit;}).map(e=>e.label);
  if(!Number.isFinite(Date.parse(input.dataTimestamp)))stale.push("snapshotTimestamp");
  const conflicts=[...(input.conflicts||[]),...input.evidence.flatMap(e=>e.conflicts||[])];
  return {score:Math.max(0,100-missing.length*14-stale.length*8-conflicts.length*10),missing,stale,conflicts};
}
export function redactDecisionData(value:unknown):unknown{
  if(Array.isArray(value))return value.map(redactDecisionData);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([key])=>!/(secret|token|password|api.?key|authorization|email|address|account.?number|routing|accountName|nickname|userId|householdId)/i.test(key)).map(([key,v])=>[key,redactDecisionData(v)]));
  return value;
}
const stable=(v:unknown):string=>Array.isArray(v)?`[${v.map(stable).join(',')}]`:v&&typeof v==="object"?`{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${JSON.stringify(k)}:${stable(x)}`).join(',')}}`:JSON.stringify(v)??"null";
export function decisionSnapshotId(input:DecisionInput){return createHash('sha256').update(stable(redactDecisionData({accountId:input.accountId,ticker:input.ticker,strategy:input.strategy,features:input.features,evidence:input.evidence,candidates:input.candidates,dataTimestamp:input.dataTimestamp}))).digest('hex');}
export function candidateIsSafe(c:DecisionCandidate){
  const sale=["SELL_NOW","SELL_IF","TRIM"].includes(c.action),buy=["BUY_NOW","BUY_IF","ADD","REBUY_IF","ROTATE_CAPITAL"].includes(c.action);
  if(!c.eligible||![c.shares,c.cost,c.proceeds,c.cashBefore,c.cashAfter,...c.targets].every(Number.isFinite)||c.shares<0||c.cost<0||c.proceeds<0||c.cashAfter<0)return false;
  if((sale||buy)&&(!(c.shares>0)||!c.entry||c.entry<=0))return false;
  const option=c.instrument==="CALL"||c.instrument==="PUT";
  if(buy&&option){if(c.action!=="BUY_IF"||!c.contractSymbol||!Number.isInteger(c.shares)||Math.abs(c.cost-c.shares*Number(c.entry)*100)>.02)return false;}
  else if(buy&&(!entryOrderReady(c.entryPlan)||c.entryPlan?.orderPrice!==c.entry||c.entryPlan?.shares!==c.shares))return false;
  if(buy&&(!c.stop||c.stop>=Number(c.entry)||c.stop<=0||c.cost>c.cashBefore+.01||Math.abs(c.cashBefore-c.cost-c.cashAfter)>.02))return false;
  if(sale&&(!c.sellReason||c.cashAfter>c.cashBefore+c.proceeds+.01))return false;
  if(sale&&c.instrument==="SHARES"&&!["THESIS BROKEN","GOAL/REBALANCE","CAPITAL ROTATION"].includes(c.sellReason||"")&&!c.reentryPlan)return false;
  return true;
}
export async function runCentralDecision(input:DecisionInput,{db,persist=true,aiProvider}:{db?:PostgresDatabase;persist?:boolean;adapter?:DecisionModelAdapter;aiProvider?:AIProvider}={}):Promise<DecisionOutput>{
  if(db){
    const flow=await new QuantDataProvider(db).getEvidence(input.ticker).then(f=>flowForStrategy(f,input.strategy)).catch(()=>null);
    input={...input,features:{...input.features,marketStructure:flow??{status:'UNAVAILABLE',canAuthorizeTrade:false}},evidence:[...input.evidence.filter(e=>e.label!=='marketStructure'),{label:'marketStructure',value:flow??{status:'UNAVAILABLE'},sourceType:'PROVIDER',sourceId:'Quant Data',asOf:flow?.retrievedAt??undefined,quality:'LOW'}]};
  }
  const started=Date.now(),capturedAt=new Date().toISOString(),q=strictDecisionQuality(input),provider=aiProvider||configuredAIProvider();
  const champion=db?await db.prepare("SELECT m.* FROM ai_model_versions m JOIN ai_strategy_versions s ON s.version=m.strategy_version AND s.status='APPROVED' WHERE m.strategy=? AND m.status='CHAMPION' ORDER BY m.released_at DESC NULLS LAST,m.created_at DESC LIMIT 1").bind(input.strategy).first<{version:string;strategy_version:string;provider_model:string;calibration_factor:number;provider:string}>():null;
  const modelVersion=champion?.version||"NO_APPROVED_CHAMPION",strategyVersion=champion?.strategy_version||"lifecycle-1.0.0",model=champion?.provider_model||process.env.OPENAI_MODEL||"";
  let result:DecisionOutput={...safeDecision(input,q,modelVersion,strategyVersion),confidence:0,providerFacts:input.evidence.filter(e=>e.sourceType!=="MODEL_INFERENCE").map(e=>`${e.label}: ${JSON.stringify(redactDecisionData(e.value))}`),interpretation:"AI recommendations unavailable. Deterministic portfolio facts remain available.",modelInferences:[],snapshotId:decisionSnapshotId(input),schemaVersion:AI_SCHEMA_VERSION,providerStatus:"UNAVAILABLE",cashBefore:null,cashAfter:null,thesisStatus:"RESEARCH_REQUIRED",sellReason:null,reentryPlan:null,evidenceSources:input.evidence,executionAllowed:false,deterministicCandidates:input.candidates||[]};
  let errorCode:string|null=null,request:AIRequest|null=null,response:AIReasoning|null=null,requestId:string|null=null;
  const candidates=(input.candidates||[]).filter(candidateIsSafe);
  if(q.missing.length||q.stale.length||q.conflicts.length)errorCode="INSUFFICIENT_DATA";
  else if(!champion||!model)errorCode="MODEL_OR_STRATEGY_NOT_APPROVED";
  else if(!provider)errorCode="AI_NOT_CONFIGURED";
  else if(champion.provider!==provider.name)errorCode="AI_PROVIDER_VERSION_MISMATCH";
  else if(!candidates.length)errorCode="NO_VERIFIED_CANDIDATES";
  else {
    const fullFlow=input.features.marketStructure as FlowEvidence|undefined;
    const compactFlow=fullFlow?.prints?flowDecisionSummary(fullFlow):fullFlow;
    const modelFeatures={...input.features,marketStructure:compactFlow},modelEvidence=input.evidence.map(e=>e.label==='marketStructure'?{...e,value:compactFlow}:e);
    const snapshot=redactDecisionData({schemaVersion:AI_SCHEMA_VERSION,snapshotId:result.snapshotId,account:{id:createHash('sha256').update(input.accountId).digest('hex').slice(0,16),strategy:input.strategy},ticker:input.ticker,features:modelFeatures,evidence:modelEvidence,candidates}) as Record<string,unknown>;
    request={snapshotId:result.snapshotId!,schemaVersion:AI_SCHEMA_VERSION,model,snapshot,candidateIds:candidates.map(c=>c.id),evidenceIds:input.evidence.map(e=>e.label)};
    try {
      const raw=await provider.analyze(request);requestId=raw.requestId;response=validateAIReasoning(raw.output,request);
      const scenarios=input.features.rotationScenarios as {horizonDays:number;price:number;bull:number;base:number;bear:number}|null;
      if(scenarios&&Object.values(scenarios).every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0)&&scenarios.bull>scenarios.price&&scenarios.bear<scenarios.price){result.returnEstimate={horizonDays:scenarios.horizonDays,price:scenarios.price,expectedReturn:(response.scenarios.bull*scenarios.bull+response.scenarios.base*scenarios.base+response.scenarios.bear*scenarios.bear)/100/scenarios.price-1,downside:(scenarios.price-scenarios.bear)/scenarios.price,asOf:input.dataTimestamp};}
      const c=candidates.find(c=>c.id===response!.candidateId)!;
      if(response.evidenceIds.length===0||response.evidenceIds.every(e=>/flow|marketStructure/i.test(e)))throw new Error("AI_FLOW_ONLY_REASONING");
      if(c.instrument!==response.instrument)throw new Error("AI_INSTRUMENT_MISMATCH");
      const confidence=Math.round(response.confidence*Math.max(.5,Math.min(1,Number(champion.calibration_factor)))*q.score/100);
      result={...result,entryPlan:c.entryPlan,action:c.action,shares:c.shares,entry:c.entry,trigger:c.trigger,stop:c.stop,targets:c.targets,cashBefore:c.cashBefore,cashAfter:c.cashAfter,expectedCostProceeds:c.proceeds||c.cost,thesisStatus:c.thesisStatus,sellReason:c.sellReason,reentryPlan:c.reentryPlan,instrument:c.instrument,contractSymbol:c.contractSymbol,candidateId:c.id,confidence,confidenceBand:confidence>=85?"VERY_HIGH":confidence>=70?"HIGH":confidence>=50?"MEDIUM":"LOW",interpretation:response.interpretation,reasoningFactors:response.reasonsFor,contradictingEvidence:response.reasonsAgainst,whatWouldChange:response.whatWouldChange,risk:response.risks.join("; "),invalidation:c.stop?`Invalid below ${c.stop}; invalidate on thesis change.`:"Thesis or evidence changes",modelInferences:[response.interpretation],providerStatus:"AVAILABLE",bull:{probability:response.scenarios.bull,priceZone:c.targets.join(" – ")||"No deterministic target",confirmation:c.reason,invalidation:"Thesis or confirmation fails"},base:{probability:response.scenarios.base,priceZone:c.entry?String(c.entry):"No action",confirmation:c.reason,invalidation:"Evidence changes"},bear:{probability:response.scenarios.bear,priceZone:c.stop?String(c.stop):"Risk not priced",confirmation:"Stop or thesis invalidation",invalidation:"Recovery confirmed"}};
    }catch(error){errorCode=error instanceof Error&&/^AI_[A-Z0-9_]+$/.test(error.message)?error.message:"AI_PROVIDER_FAILED";response=null;}
  }
  if(errorCode){result.providerStatus=errorCode;result.reasoningFactors.push(errorCode);}
  if(persist&&db){
    const decisionId=id("decision"),status=errorCode?(request?"FAILED":"REJECTED_BY_GATE"):"COMPLETED";result.decisionId=decisionId;
    await db.transaction(async tx=>{
      await tx.prepare("INSERT INTO ai_decision_runs(id,household_id,account_id,ticker,strategy,request_type,input_snapshot_json,evidence_json,output_json,data_quality,model_version,strategy_version,provider,status,latency_ms,data_timestamp,snapshot_id,schema_version,provider_request_id,error_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(decisionId,input.householdId,input.accountId,input.ticker,input.strategy,input.requestType,JSON.stringify(redactDecisionData(input.features)),JSON.stringify(redactDecisionData(input.evidence)),JSON.stringify(redactDecisionData(result)),q.score,modelVersion,strategyVersion,provider?.name||"NONE",status,Date.now()-started,Number.isFinite(Date.parse(input.dataTimestamp))?input.dataTimestamp:capturedAt,result.snapshotId,AI_SCHEMA_VERSION,requestId,errorCode).run();
      await tx.prepare("INSERT INTO ai_decision_requests(id,decision_id,snapshot_id,schema_version,request_json,response_json,status,error_code) VALUES(?,?,?,?,?,?,?,?)").bind(id("ai_request"),decisionId,result.snapshotId,AI_SCHEMA_VERSION,JSON.stringify(request?.snapshot||redactDecisionData({features:input.features,evidence:input.evidence,candidates})),response?JSON.stringify(response):null,status,errorCode).run();
      await tx.prepare("INSERT INTO ai_current_decisions(account_id,ticker,strategy,decision_id,snapshot_id,captured_at,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id,ticker,strategy) DO UPDATE SET decision_id=EXCLUDED.decision_id,snapshot_id=EXCLUDED.snapshot_id,captured_at=EXCLUDED.captured_at,expires_at=EXCLUDED.expires_at WHERE ai_current_decisions.captured_at<=EXCLUDED.captured_at").bind(input.accountId,input.ticker,input.strategy,decisionId,result.snapshotId,capturedAt,new Date(started+(input.strategy==="LONG_TERM_SHARES"?86400000:20*60000)).toISOString()).run();
      if(request)await tx.prepare("INSERT INTO ai_provider_health(provider,last_success_at,last_failure_at,last_latency_ms,last_model,last_model_version,successes,failures,fallback_state,error_code) VALUES(?,CASE WHEN ? THEN CURRENT_TIMESTAMP END,CASE WHEN ? THEN CURRENT_TIMESTAMP END,?,?,?,?,?,?,?) ON CONFLICT(provider) DO UPDATE SET last_success_at=COALESCE(EXCLUDED.last_success_at,ai_provider_health.last_success_at),last_failure_at=COALESCE(EXCLUDED.last_failure_at,ai_provider_health.last_failure_at),last_latency_ms=EXCLUDED.last_latency_ms,last_model=EXCLUDED.last_model,last_model_version=EXCLUDED.last_model_version,successes=ai_provider_health.successes+EXCLUDED.successes,failures=ai_provider_health.failures+EXCLUDED.failures,fallback_state=EXCLUDED.fallback_state,error_code=EXCLUDED.error_code,updated_at=CURRENT_TIMESTAMP").bind(provider!.name,!errorCode,Boolean(errorCode),Date.now()-started,model,modelVersion,errorCode?0:1,errorCode?1:0,errorCode?"DETERMINISTIC_FACTS_ONLY":"NONE",errorCode).run();
    });
  }
  return result;
}
