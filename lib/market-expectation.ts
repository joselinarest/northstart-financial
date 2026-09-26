type Row=Record<string,any>;
const avg=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
const ema=(v:number[],n:number)=>v.reduce((a,b,i)=>i?a+(b-a)*2/(n+1):b,0);
export function technicalExpectation(bars:Row[],market:Row[],price:number,sector:Row[]=[]){
 const c=bars.map(b=>Number(b.close)),last=bars.at(-1),prior=bars.at(-2),sma20=avg(c.slice(-20)),sma50=avg(c.slice(-50));
 const ema9=ema(c,9),ema21=ema(c,21),macd=ema(c,12)-ema(c,26),previousMacd=ema(c.slice(0,-1),12)-ema(c.slice(0,-1),26);
 const changes=c.slice(-15).slice(1).map((p,i)=>p-c.slice(-15)[i]),gain=avg(changes.map(v=>Math.max(0,v))),loss=avg(changes.map(v=>Math.max(0,-v))),rsi=loss?100-100/(1+gain/loss):gain?100:50;
 const recent=bars.slice(-15),atr=recent.length>=15?avg(recent.slice(1).map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-recent[i].close),Math.abs(b.low-recent[i].close)))):null;
 const trend=(b:Row[])=>b.length<20?'UNAVAILABLE':b.at(-1)!.close>avg(b.slice(-20).map(x=>x.close))?'BULLISH':'BEARISH';
 const volume=avg(bars.slice(-21,-1).map(b=>b.volume)),relativeVolume=volume?Number(last?.volume)/volume:null;
 const support=bars.length?Math.min(...bars.slice(-20).map(b=>b.low)):null,resistance=bars.length?Math.max(...bars.slice(-20).map(b=>b.high)):null;
 const complete=c.length>=50&&price>0&&atr!=null&&atr>0,up=complete&&price>sma20&&sma20>sma50&&macd>0,down=complete&&price<sma20&&sma20<sma50&&macd<0;
 const reversalUp=complete&&rsi<40&&macd>previousMacd&&price>Number(prior?.close),reversalDown=complete&&rsi>60&&macd<previousMacd&&price<Number(prior?.close);
 const expectation=up?'BULLISH_CONTINUATION':down?'BEARISH_CONTINUATION':reversalUp?'REVERSAL_BULLISH':reversalDown?'REVERSAL_BEARISH':complete?'RANGE_NEUTRAL':'UNRESOLVED';
 const direction=/BULLISH/.test(expectation)?'CALL':/BEARISH/.test(expectation)?'PUT':null;
 const marketTrend=trend(market),sectorTrend=trend(sector),alignment=direction?(marketTrend===(direction==='CALL'?'BULLISH':'BEARISH')?1:-1):0;
 const confidence=complete?Math.min(85,Math.max(20,45+(up||down?15:0)+(relativeVolume&&relativeVolume>=1.5?10:0)+alignment*5+(sectorTrend===marketTrend?5:0))):0;
 return {expectation,direction,confidence,confidenceBasis:'Deterministic evidence score, not a calibrated win probability',price,sma20,sma50,ema9,ema21,macd,rsi,atr,support,resistance,relativeVolume,marketTrend,sectorTrend,vwap:last?.vwap||null,gapPct:prior?.close?100*(Number(last?.open)/prior.close-1):null,averageDollarVolume:volume*price,complete,trigger:direction==='CALL'?Math.max(price,ema9):direction==='PUT'?Math.min(price,ema9):null,invalidation:direction==='CALL'&&atr?Math.max(Number(support),price-1.5*atr):direction==='PUT'&&atr?Math.min(Number(resistance),price+1.5*atr):null,evidence:[`${expectation.replaceAll('_',' ')}; price ${price}, SMA20 ${sma20.toFixed(2)}, SMA50 ${sma50.toFixed(2)}`,`RSI ${rsi.toFixed(1)}; MACD ${macd.toFixed(3)}; relative volume ${relativeVolume?.toFixed(2)||'unavailable'}`,`Market ${marketTrend}; sector ${sectorTrend}`]};
}
export function opportunityExpectancy(t:ReturnType<typeof technicalExpectation>,context:{catalystClear:boolean;fundamentals:boolean;valuation:boolean;liquid:boolean;concentrated?:boolean}){
 if(!t.complete||!t.direction||!t.invalidation||!t.atr)return {score:null,expectedReturn:null,rewardRisk:null,scenarios:null,reason:'Directional structure and technical invalidation are required'};
 const downside=Math.abs(t.price-t.invalidation),upside=3*t.atr,rewardRisk=downside>0?upside/downside:null;
 const bull=Math.max(.25,Math.min(.6,t.confidence/100-(context.catalystClear?0:.15))),bear=.3,base=1-bull-bear;
 const expected=bull*upside-bear*downside,penalty=(context.liquid?1:.3)*(context.catalystClear?1:.5)*(context.concentrated?.5:1)*(context.fundamentals?1:.85)*(context.valuation?1:.9);
 return {score:downside?Number((expected/downside*penalty).toFixed(3)):null,expectedReturn:expected/t.price,rewardRisk,scenarios:{bull:{probability:bull,move:upside},base:{probability:base,move:0},bear:{probability:bear,move:-downside}},reason:'Scenario-weighted directional payoff with liquidity, catalyst, concentration, fundamental and valuation penalties. Probabilities are explicit modeling assumptions, not calibrated forecasts.'};
}
