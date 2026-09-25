import {researchMarketFresh} from '@/lib/research-market-freshness';
import {exchangeDay} from '@/lib/exchange-calendar';
import type {DecisionCandidate,DecisionOutput} from '@/lib/ai-investment-decision-engine';
export function nextOpenResearch(now=Date.now()){const day=exchangeDay(now);return day.supported&&(!day.tradingDay||day.minute<570||day.minute>=day.closeMinute);}
/** Research may use the completed session. This never authorizes an order. */
export function optionQuoteResearchFresh(asOf:string,now=Date.now()){return researchMarketFresh(asOf,120000,now);}
export function buildNextOpenOptionCandidates(chain:any[],thesis:DecisionOutput|null,cash:number):DecisionCandidate[]{
 const passive:DecisionCandidate={id:'research-wait',action:'WAIT',instrument:'NO_TRADE',shares:0,entry:null,trigger:null,stop:null,targets:[],cost:0,proceeds:0,cashBefore:cash,cashAfter:cash,thesisStatus:thesis?.thesisStatus||'RESEARCH_REQUIRED',sellReason:null,reentryPlan:null,eligible:true,reason:'No sufficiently supported option research setup; continue analysis.'};
 if(thesis?.providerStatus!=='AVAILABLE')return [passive];
 const technical:any=thesis.evidenceSources?.find(e=>e.label==='technical')?.value;
 const bullish=technical?.state==='BULLISH'&&technical.price>technical.sma20&&technical.price>technical.sma50&&['VALID','INTACT','STRONG'].includes(thesis.thesisStatus||'');
 const bearish=technical?.state==='BEARISH'&&technical.price<technical.sma20&&technical.price<technical.sma50;
 return [passive,...chain.filter(c=>c.volatility?.researchAllowed===true&&(c.type==='CALL'?bullish:bearish)&&c.dte>=14&&c.dte<=30&&c.bid>0&&c.ask>=c.bid&&c.spreadPct<=8&&c.volume>=10&&c.openInterest>0&&c.impliedVolatility>0&&[c.delta,c.gamma,c.theta,c.vega].every(x=>typeof x==='number'&&Number.isFinite(x))&&(c.type==='CALL'?c.delta>0&&c.delta<=1:c.delta<0&&c.delta>=-1)&&c.gamma>=0&&c.vega>=0).slice(0,10).map(c=>({...passive,id:'research-'+c.contractSymbol,instrument:c.type,contractSymbol:c.contractSymbol,entry:c.ask,trigger:technical.price,reason:`${c.type} next-open research: daily trend, underlying evidence, IV, catalyst, spread, volume and OI passed. Last-session ask ${c.ask}; strike ${c.strike}; ${c.dte} DTE. Compare with shares and waiting. No contracts approved; live price, cash, risk and confirmation must be checked at next open.`}))];
}
