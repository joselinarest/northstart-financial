import {evaluatePosition,monitorReentry,compareCapital,type PositionState,type Evidence,type AccountRisk} from './trade-lifecycle';
import {buildOptionCandidates} from './ai-options-candidates';
export function decisionVerification(){
 const now=Date.now(),at=new Date(now).toISOString();
 const p:PositionState={investmentAccountId:'SYNTHETIC-SWING',ticker:'TEST',strategy:'SWING',shares:20,averageCost:70,currentPrice:100,thesisStatus:'VALID',positionState:'OPEN',recommendationId:null,sellReason:null,exitPrice:null,exitDate:null,proceeds:0,reservedReentryCash:0,reentryLow:null,reentryHigh:null,reentryTrigger:null,reentryInvalidation:null,target1:120,target2:130,stop:80,lastAnalysisAt:at,strategyVersion:'fixture',modelVersion:'fixture'};
 const e:Evidence={asOf:at,complete:true,thesis:'VALID',price:100,support:85,resistance:110,sma20:93,sma50:90,atr:5,volumeRatio:1,relativeStrength:2,marketStrong:true,sectorStrong:true,newsClear:true,valuationAttractive:true,majorValuationRisk:false,momentumBroken:false,goalChanged:false,targetReached:false,sellConfirmations:0};
 const risk:AccountRisk={cash:5000,value:20000,maxPositionBps:2000,maxRiskBps:50,taxRate:.2,slippageBps:10,commission:0,reservedElsewhere:0,sectorRoom:5000,remainingOpenRisk:200,liquidityShares:1000,cashReserveBps:1000};
 const rows=[{name:'HOLD',expected:'HOLD',result:evaluatePosition(p,e,risk,now)},{name:'TRIM',expected:'TRIM',result:evaluatePosition(p,{...e,targetReached:true},risk,now)},{name:'SELL',expected:'SELL',result:evaluatePosition(p,{...e,thesis:'BROKEN'},risk,now)},{name:'BUY',expected:'BUY NOW',result:evaluatePosition({...p,shares:0},{...e,volumeRatio:2},risk,now)},{name:'NO TRADE',expected:'NO ACTION',result:evaluatePosition({...p,shares:0},{...e,complete:false},risk,now)}];
 const plan=rows[1].result.reentry!,rebuy=monitorReentry(plan,{...p,shares:0},{...e,price:plan.high,sma20:80,sma50:79,volumeRatio:2},risk,now);
 const c={ticker:'TEST',expectedReturn:.2,downside:.1,costs:.02,valuation:true,technical:true,fundamentals:true,accountFit:true,concentration:true,asOf:at};
 const extra=[{name:'REBUY',expected:'READY',actual:rebuy.plan.status},{name:'ROTATE',expected:'ROTATE',actual:compareCapital(.04,c,[{...c,ticker:'OTHER',expectedReturn:.4}],now).choice},{name:'HOLD CASH',expected:'HOLD CASH',actual:compareCapital(.04,null,[],now).choice},{name:'NO OPTION TRADE',expected:'NO_TRADE',actual:buildOptionCandidates([],null,5000,100,false)[0].instrument}];
 return {rows,extra,risk,position:p};
}
