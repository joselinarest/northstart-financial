import {nextOpenResearch} from '@/lib/options-next-open';
import {researchMarketFresh} from '@/lib/research-market-freshness';
import {entryOrderReady} from '@/lib/entry-plan';
import {createHash} from 'node:crypto';
import type {DecisionInput,DecisionCandidate} from '@/lib/ai-investment-decision-engine';
const commonFacts=["currentPrice","fundamentals","technical","portfolio","accountCash","riskLimit","news","valuation","marketRegime"];
export function strictDecisionQuality(input:DecisionInput){
  const required=[...new Set([...commonFacts,...input.requiredFacts,...(input.strategy==="OPTIONS"?["underlyingThesis","optionQuote","greeks","liquidity"]:[])])];
  const labels=new Set(input.evidence.filter(e=>e.value!==null&&e.value!==undefined&&e.value!==""&&!(typeof e.value==="number"&&!Number.isFinite(e.value))&&!(typeof e.value==="object"&&!Array.isArray(e.value)&&!Object.keys(e.value as object).length)).map(e=>e.label));
  const missing=required.filter(x=>!labels.has(x));
  const stale=input.evidence.filter(e=>required.includes(e.label)).filter(e=>{const age=Date.now()-Date.parse(e.asOf||"");const limit=["fundamentals","valuation"].includes(e.label)?7*86400000:input.strategy==="LONG_TERM_SHARES"?86400000:20*60000;return (["currentPrice","technical","marketRegime"].includes(e.label)||(input.requestType==="OPTIONS_NEXT_OPEN_RESEARCH"&&nextOpenResearch()&&["underlyingPrice","optionQuote","greeks","liquidity"].includes(e.label)))?!researchMarketFresh(e.asOf||"",limit):!Number.isFinite(age)||age<0||age>limit;}).map(e=>e.label);
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
