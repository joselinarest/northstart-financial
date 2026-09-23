import {id,type PostgresDatabase} from "@/lib/db";
import type {NormalizedBar} from "@/lib/providers/market-data";
type Prior={id:string;data_timestamp:string;input_snapshot_json:{position?:{currentPrice?:number};quote?:{last?:number}};output_json:{action:string;shares:number};};
export function decisionPathMetrics(entry:number,bars:Pick<NormalizedBar,'high'|'low'|'close'>[],action:string){
  if(!(entry>0)||!bars.length||bars.some(b=>![b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)))return null;
  const end=bars.at(-1)!.close,high=Math.max(entry,...bars.map(b=>b.high)),low=Math.min(entry,...bars.map(b=>b.low));
  let peak=entry,drawdown=0;
  for(const bar of bars){peak=Math.max(peak,bar.close);drawdown=Math.max(drawdown,(peak-bar.close)/peak);}
  const underlyingReturn=Math.round((end/entry-1)*10000),sold=["SELL_NOW","SELL_IF"].includes(action),decisionReturn=sold?0:underlyingReturn;
  return {actualReturnBps:decisionReturn,alternativeReturnBps:underlyingReturn,maeBps:Math.round((low/entry-1)*10000),mfeBps:Math.round((high/entry-1)*10000),drawdownBps:Math.round(drawdown*10000),missedUpsideBps:sold?Math.max(0,underlyingReturn):0,avoidedLossBps:sold?Math.max(0,-underlyingReturn):0,excessVsHoldBps:decisionReturn-underlyingReturn,basis:"Daily-bar recommendation counterfactual, before execution costs; executed sale/reentry/rotation attribution is stored in trade_lifecycle_exits."};
}
export async function measureCentralDecisionOutcomes(db:PostgresDatabase,accountId:string,ticker:string,bars:NormalizedBar[]){
  const rows=(await db.prepare("SELECT d.id,d.data_timestamp,d.input_snapshot_json,d.output_json FROM ai_decision_runs d LEFT JOIN ai_decision_outcomes o ON o.decision_id=d.id WHERE d.account_id=? AND d.ticker=? AND d.status='COMPLETED' AND d.data_timestamp<CURRENT_TIMESTAMP-INTERVAL '1 day' AND o.id IS NULL ORDER BY d.data_timestamp LIMIT 100").bind(accountId,ticker).all<Prior>()).results;
  for(const row of rows){
    const entry=Number(row.input_snapshot_json.position?.currentPrice||row.input_snapshot_json.quote?.last||0),start=new Date(row.data_timestamp).getTime(),path=bars.filter(b=>Date.parse(b.time)>start),metrics=decisionPathMetrics(entry,path,row.output_json.action);
    if(!metrics)continue;
    await db.prepare("INSERT INTO ai_decision_outcomes(id,decision_id,evaluation_horizon,actual_return_bps,alternative_return_bps,max_adverse_excursion_bps,max_favorable_excursion_bps,drawdown_bps,outperformed_alternative,outcome_json) VALUES(?,?,'NEXT_AVAILABLE_DAILY_REVIEW',?,?,?,?,?,?,?) ON CONFLICT(decision_id) DO NOTHING").bind(id("ai_outcome"),row.id,metrics.actualReturnBps,metrics.alternativeReturnBps,metrics.maeBps,metrics.mfeBps,metrics.drawdownBps,metrics.excessVsHoldBps>0,JSON.stringify(metrics)).run();
  }
}
