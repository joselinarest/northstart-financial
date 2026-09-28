import {researchMarketFresh} from './research-market-freshness';
type R=Record<string,any>;
const usd=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
/** Explain actual sizing and policy requirements, including old saved plans with fewer fields. */
export function accountReadiness(d:R){
 const checks:{label:string;pass:boolean;detail:string}[]=[],cash=Number(d.investableCash),minimum=Number(d.minimumCash);
 if(Number.isFinite(cash)&&minimum>0)checks.push({label:'Cash for a purchase',pass:cash>=minimum,detail:`${usd(cash)} investable after ${usd(Number(d.reservedCash)||0)} reserved. ${d.fractional?'Minimum fractional increment':'One whole share'} needs ${usd(minimum)}; ${usd(Math.max(0,minimum-cash))} more investable cash required. Reserves remain in place.`});
 if(d.requiredRewardRisk>0)checks.push({label:'Reward versus risk',pass:Number(d.rewardRisk)>=d.requiredRewardRisk,detail:`Current ${Number(d.rewardRisk||0).toFixed(2)}:1; account requires at least ${Number(d.requiredRewardRisk).toFixed(2)}:1. Entry, invalidation and a defensible target must meet this ratio.`});
 if(d.maxEntryWithoutExtension>0)checks.push({label:'Avoid chasing the price',pass:d.price<=d.maxEntryWithoutExtension,detail:`Current price ${usd(d.price)}; current 20-session average plus three ATR is ${usd(d.maxEntryWithoutExtension)}. Reassess at or below that level with the thesis intact; this level changes with new data.`});
 const fresh=d.quoteFresh!==false&&researchMarketFresh(d.asOf||'',120000);
 if(d.asOf)checks.push({label:'Price evidence',pass:fresh,detail:fresh?'Price observation passed the session freshness check.':'Refresh the underlying quote. During trading, the observation must be no older than two minutes; outside trading, a valid latest-session observation is required.'});
 if(d.shareCapacity!=null)checks.push({label:'Position and loss limits',pass:d.shareCapacity>0,detail:`Current limits permit ${d.shareCapacity} ${d.fractional?'fractional':'whole'} shares. ${usd(Number(d.positionRoom)||0)} position room and ${usd(Number(d.tradeRiskBudget)||0)} trade-loss budget; cash and existing exposure also apply.`});
 for(const [stage,error]of Object.entries(d.stageErrors||{}))checks.push({label:stage.replaceAll('_',' '),pass:false,detail:`Research must retry and verify this source: ${String(error).replaceAll('_',' ')}.`});
 checks.push({label:'Entry confirmation',pass:false,detail:d.trigger>0?`Price must confirm the ${usd(d.trigger)} trigger; then the central engine must verify volume, current news, sector alignment and combined open risk. Reaching the price alone is not approval.`:'A directional price trigger must be established from refreshed technical research.'});
 return checks;
}
