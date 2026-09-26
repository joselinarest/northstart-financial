import {assessOptionVolatility} from './options-volatility';
import {optionQuoteResearchFresh,nextOpenResearch} from './options-next-open';
type Row=Record<string,any>;
export function rankOptionContracts(payload:Row,research:Row,account:Row,now=Date.now()){
 const technical=research.technical||{},direction=technical.direction,offHours=nextOpenResearch(now),riskCap=Math.max(0,Math.min(account.cash,account.premiumCap));
 const contracts=Object.entries(payload.snapshots||{}).flatMap(([symbol,snapshot]:[string,any])=>{
  const match=symbol.match(/^([A-Z.]+)(\d{6})([CP])(\d{8})$/);if(!match)return[];
  const expiration=`20${match[2].slice(0,2)}-${match[2].slice(2,4)}-${match[2].slice(4,6)}`,dte=Math.ceil((Date.parse(expiration+'T20:00:00Z')-now)/86400000),type=match[3]==='C'?'CALL':'PUT',strike=Number(match[4])/1000;
  const bid=Number(snapshot.latestQuote?.bp||0),ask=Number(snapshot.latestQuote?.ap||0),mid=(bid+ask)/2,spread=mid?(ask-bid)/mid*100:100,volume=Number(snapshot.dailyBar?.v||0),oi=Number(snapshot.openInterest||0),iv=Number(snapshot.impliedVolatility||0),g=snapshot.greeks||{};
  const assessment=assessOptionVolatility(research.volatility,iv,dte,g.vega??null,research.catalystGate?.pass===true),missing:string[]=[],rejected:string[]=[];
  if(!research.marketFresh)missing.push('Underlying price needs revalidation');
  if(!technical.complete||!technical.invalidation||!direction)missing.push('Directional thesis and technical invalidation');
  if(!(bid>0&&ask>=bid))missing.push('Two-sided chain quote');
  if(!optionQuoteResearchFresh(snapshot.latestQuote?.t||'',now))missing.push('Fresh contract quote');
  if(!(iv>0)||![g.delta,g.gamma,g.theta,g.vega].every(v=>typeof v==='number'&&Number.isFinite(v)))missing.push('IV and complete Greeks');
  if((type==='CALL'&&!(g.delta>0&&g.delta<=1))||(type==='PUT'&&!(g.delta<0&&g.delta>=-1))||g.gamma<0||g.vega<0)missing.push('Invalid directional Greeks');
  if(volume<10||oi<100)missing.push('Contract liquidity: volume ≥10 and OI ≥100');
  if(dte<2||dte>45)rejected.push('Outside supported 2–45 DTE; same-day trading is not enabled');
  if(spread>8)rejected.push('Spread exceeds 8%');
  if(type!==direction&&direction)rejected.push('Contract direction contradicts the underlying expectation');
  if(Math.abs(Number(g.delta))<.25||Math.abs(Number(g.delta))>.75)rejected.push('Delta outside 0.25–0.75 directional range');
  if(ask>0&&Math.abs(Number(g.theta))/ask>.08)rejected.push('Daily time decay exceeds 8% of premium');
  if(dte<7&&(volume<100||oi<500||spread>4||!account.intradayConfirmed))rejected.push('Short duration requires tighter liquidity and verified intraday confirmation');
  if(!assessment.allowed)missing.push(...assessment.reasons);
  const premium=ask*100,maxContracts=Number.isFinite(premium)&&premium>0?Math.floor(riskCap*assessment.riskMultiplier/premium):0;
  const accountReasons=[...(!account.optionsEnabled?['Options entries disabled for this account']:[]),...(!maxContracts?['One-contract premium exceeds available cash or option risk budget']:[])];
  const quality=Math.max(0,Math.min(100,Number(technical.confidence||0)*.4+Number(assessment.score||0)*.25+Math.min(15,Math.log10(oi+1)*4)+Math.min(10,Math.log10(volume+1)*4)+Math.max(0,10-spread)-Math.abs(Math.abs(Number(g.delta||0))-.5)*25-(dte<7?20:0)-(research.stageErrors?.FUNDAMENTAL_ANALYSIS?5:0)-(technical.sectorTrend==='UNAVAILABLE'?5:0)));
  const qualified=!missing.length&&!rejected.length,executionFresh=!offHours&&now-Date.parse(snapshot.latestQuote?.t||'')<=120000&&now-Date.parse(research.asOf||'')<=120000;
  const decision=rejected.length?'NO OPTION TRADE':!qualified?'WAIT':accountReasons.length?'PREPARE':type+' CANDIDATE';
  return [{symbol:research.symbol,contractSymbol:symbol,type,expectation:technical.expectation,confidence:technical.confidence,quality:Math.round(quality),decision,qualified,executionReady:false,researchOnly:offHours||payload.feed!=='opra',strike,expiration,dte,bid,ask,mid,spreadPct:spread,volume,openInterest:oi,iv,ivRank:null,delta:g.delta??null,gamma:g.gamma??null,theta:g.theta??null,vega:g.vega??null,contracts:qualified&&!accountReasons.length?maxContracts:0,expectedContracts:Math.max(1,maxContracts),premium,totalPremium:qualified?maxContracts*premium:0,maxRisk:qualified?maxContracts*premium:0,oneContractRisk:premium,breakEven:type==='CALL'?strike+ask:strike-ask,expectedMove:iv>0?research.quote.last*iv*Math.sqrt(dte/365):null,trigger:technical.trigger,invalidation:technical.invalidation,target:technical.atr?(type==='CALL'?technical.price+2*technical.atr:technical.price-2*technical.atr):null,timeStop:`Review each session; exit/reassess by ${new Date(Date.parse(expiration+'T20:00:00Z')-2*86400000).toISOString().slice(0,10)} or immediately on invalidation`,cancelConditions:['Underlying invalidation breaks','Catalyst/news risk changes','Quote expires or spread/liquidity deteriorates','Premium exceeds account risk/cash','Direction or volatility thesis changes'],reasons:[...rejected,...missing,...accountReasons],why:technical.evidence||[],whyContract:'Ranked by directional evidence, IV versus realized volatility, spread, liquidity, Delta, time decay and DTE; premium is a risk constraint, not the selection objective.',whyAlternative:qualified?'Compare bounded premium risk with share exposure and holding cash. Reconfirm all conditions before entry.':'Shares or waiting avoid paying time decay while these conditions are unresolved.',quoteAsOf:snapshot.latestQuote?.t||null,underlyingAsOf:research.asOf,asOf:new Date(now).toISOString(),freshness:optionQuoteResearchFresh(snapshot.latestQuote?.t||'',now)?offHours?'LAST_SESSION':'FRESH':'STALE'}];
 });
 return contracts.sort((a,b)=>Number(b.qualified)-Number(a.qualified)||b.quality-a.quality);
}
