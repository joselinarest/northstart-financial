export type VolatilityBar={close:number;high:number;low:number;open:number;volume:number};
export function realizedVolatility(bars:VolatilityBar[]):number|null{
 const prices=bars.slice(-21).map(b=>b.close);
 if(prices.length<21||prices.some(p=>!Number.isFinite(p)||p<=0))return null;
 const returns=prices.slice(1).map((p,i)=>Math.log(p/prices[i]));const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
 return Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/(returns.length-1)*252);
}
export function volatilityContext(bars:VolatilityBar[],marketBars:VolatilityBar[]){
 const recent=bars.slice(-15),last=recent.at(-1),previous=recent.at(-2);
 const atr=recent.length>=15?recent.slice(1).reduce((sum,b,i)=>sum+Math.max(b.high-b.low,Math.abs(b.high-recent[i].close),Math.abs(b.low-recent[i].close)),0)/14:null;
 const changePct=last&&previous?100*(last.close/previous.close-1):null;
 return {realized:realizedVolatility(bars),marketRealized:realizedVolatility(marketBars),atr,changePct,atrMultiple:last&&previous&&atr?Math.abs(last.close-previous.close)/atr:null,range:last?last.high-last.low:null,vix:null,ivRank:null,skew:null,termStructure:null,sectorVolatility:null,missing:['VIX','IV rank/percentile','IV skew','IV term structure','Sector volatility'],classification:'UNKNOWN' as string};
}
export type OptionsVolatilityContext=ReturnType<typeof volatilityContext>;
export function assessOptionVolatility(context:OptionsVolatilityContext,iv:number|null,dte:number,vega:number|null,catalystPass:boolean){
 const reasons:string[]=[];
 const complete=context.realized!=null&&context.realized>0&&context.marketRealized!=null&&iv!=null&&iv>0;
 const ratio=complete?iv!/context.realized!:null;
 if(!complete)reasons.push('Current underlying/index realized volatility and contract IV are required.');
 if(ratio!=null&&(ratio>=1.6||iv!>=1.2))reasons.push('Long premium is expensive versus realized volatility; compare shares or wait.');
 if(!catalystPass)reasons.push('Catalyst coverage has not cleared event/IV-crush risk.');
 const riskMultiplier=context.marketRealized==null?0:context.marketRealized>=.4?.5:context.marketRealized>=.25?.75:1;
 const score=complete?Math.round(Math.max(0,Math.min(100,100-40*Math.max(0,ratio!-.8)-(context.marketRealized!>=.4?20:0)-(!catalystPass?40:0)))):null;
 // Sensitivity scenario, not a premium forecast: Vega is dollars per one IV percentage point per share.
 const crushLossPerContract=complete&&vega!=null&&vega>=0?Math.max(0,iv!-context.realized!)*100*vega*100:null;
 return {allowed:reasons.length===0,reasons,score,riskMultiplier,iv,ivToRealized:ratio,expectedMovePct:iv!=null&&iv>0?iv*Math.sqrt(dte/365)*100:null,crushLossPerContract,crushAssumption:'IV contracts to trailing 20-session realized volatility; first-order Vega sensitivity only.',context};
}
