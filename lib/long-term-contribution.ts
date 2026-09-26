import {allocateCash} from '@/lib/domain/cash-allocation';
import {classifyHolding, strategyTarget, type AllocationTarget} from '@/lib/domain/portfolio';
import type {StrategyType} from '@/lib/domain/investment-accounts';
import {watchEntry} from '@/lib/entry-plan';
import {researchMarketFresh} from '@/lib/research-market-freshness';
import type {Action, Evidence, PositionState, AccountRisk} from '@/lib/trade-lifecycle';

export function contributionAction(input:{account:{strategy:string;goal:string;horizonMonths:number;fractional:boolean};holdings:{symbol:string;type:string;name:string;value:number;price:number}[];targets?:Partial<AllocationTarget>;security:{symbol:string;type:string};position:PositionState;evidence:Evidence;risk:AccountRisk;previous:Action}):Action {
  const {account,position:p,evidence:e,risk,previous}=input;
  if(['SELL','TRIM'].includes(previous.action))return previous;
  const hold={...previous,action:(p.shares?'HOLD':'NO ACTION') as Action['action'],shares:0,cost:0,cashAfter:risk.cash,remainingShares:p.shares,entryPlan:undefined};
  if(risk.maxRiskBps===0)return {...hold,reason:'The account risk limit is zero. Keep contribution cash until the risk policy permits additions.'};
  if(account.strategy==='LONG_TERM_ETF'&&!/^etf$/i.test(input.security.type))return {...hold,reason:'ETF-only strategy: individual securities are ineligible for new contributions.'};
  if(!account.goal||!Number.isFinite(account.horizonMonths)||account.horizonMonths<=0)return {...hold,reason:'Set the account goal and time horizon before allocating contributions.'};
  if(account.horizonMonths<=24&&/education|college|house|purchase/i.test(account.goal)&&!['cash','bond'].includes(input.security.type.toLowerCase()))return {...hold,reason:'The goal is within two years. Keep this contribution liquid instead of increasing equity exposure.'};
  if(!e.complete||!researchMarketFresh(e.asOf,86400000)||e.thesis!=='VALID'||!e.valuationAttractive||!e.newsClear||e.majorValuationRisk)return {...hold,reason:'Keep contribution cash until current quality, valuation, news and risk evidence pass.'};
  const target=strategyTarget(account.strategy as StrategyType,input.targets);
  const holdings=input.holdings.map(h=>({symbol:h.symbol,category:classifyHolding({ticker:h.symbol,name:h.name,securityType:h.type}),value:BigInt(Math.round(h.value*100)),price:BigInt(Math.round((h.symbol===p.ticker?e.price:h.price)*100))}));
  if(!holdings.some(h=>h.symbol===p.ticker))holdings.push({symbol:p.ticker,category:classifyHolding({ticker:p.ticker,securityType:input.security.type}),value:0n,price:BigInt(Math.round(e.price*100))});
  const allocation=allocateCash({cash:BigInt(Math.round(risk.cash*100)),safeCapacity:BigInt(Math.round(risk.cash*100)),reserved:BigInt(Math.round(risk.reservedElsewhere*100)),reserveBps:risk.cashReserveBps||target.CASH,maximumPositionBps:risk.maxPositionBps,fractional:account.fractional,targets:target,holdings});
  const row=allocation.rows.find(r=>r.symbol===p.ticker),price=Number(e.ask)>0?Number(e.ask):e.price,stop=e.support-e.atr*.5;
  const round=(v:number)=>account.fractional?Math.floor(v*1000)/1000:Math.floor(v);
  const shares=round(Math.max(0,Number(row?.estimatedCostCents||0)/100-risk.commission)/(price*(1+risk.slippageBps/10000)));
  if(!shares||!Number.isFinite(price)||price<=0||stop<=0||stop>=price)return {...hold,reason:'No contribution fits the current allocation gap, cash reserve and position limit at the verified price.'};
  const cost=Math.round((shares*price*(1+risk.slippageBps/10000)+risk.commission)*100)/100;
  const plan={...watchEntry({trigger:price,stop,targets:previous.targets,shares,expiresAt:new Date(Date.now()+20*60000).toISOString()}),confirmationBasis:'ALLOCATION' as const,classification:'LIMIT ENTRY' as const,status:'CONFIRMED' as const,orderType:'LIMIT' as const,orderPrice:price,confirmedAt:e.asOf,confirmationRequired:['Account target gap and position limit confirmed','Company quality, valuation and material news reviewed',`Goal ${account.goal}; horizon ${account.horizonMonths} months`],actionAfterConfirmation:`Allocate to the target gap with a limit of $${price.toFixed(2)}; reconfirm the quote before execution.`};
  return {...previous,action:p.shares?'ADD':'BUY NOW',shares,price,cost,proceeds:0,cashAfter:Math.round((risk.cash-cost)*100)/100,remainingShares:p.shares+shares,stop,entryPlan:plan,pipeline:'COMPLETE',reason:`Deploy contribution toward ${p.ticker}: ${(Number(row?.currentBps||0)/100).toFixed(1)}% → ${(Number(row?.targetBps||0)/100).toFixed(1)}% target. Valuation and risk pass for ${account.goal} over ${account.horizonMonths} months.`,supporting:[...previous.supporting,allocation.method]};
}
