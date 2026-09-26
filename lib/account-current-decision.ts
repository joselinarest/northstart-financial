import {tradingPlan} from './trading-plan';
type Row=Record<string,any>;
/** A non-executable account decision remains useful when research is incomplete. */
export function accountCurrentDecision(data:Row,portfolio:Row,risk:Row,status:Row|null,now=Date.now(),search:Row|null=null){
 const plan=tradingPlan(data,portfolio,risk,now),holdings=portfolio.holdings||[],longTerm=!/SWING|OPTIONS|MIXED|DAY_TRADE/.test(data.strategyType||'');
 const incomplete=!status||['EMPTY','STALE','BLOCKED'].includes(status.state)||!search||!['RESEARCHED','COMPLETE'].includes(search.status);
 const strongest=plan.actions[0]||plan.prepare[0];
 const passive=(data.queue||[]).find((a:Row)=>['HOLD','HOLD_CASH','DO_NOTHING'].includes(a.action)&&!a.details?.analysisPending&&Date.parse(a.details?.expiration)>now);
 const under=(portfolio.categories||[]).filter((c:Row)=>c.status==='UNDERWEIGHT'&&c.category!=='CASH').sort((a:Row,b:Row)=>Number(b.gapCents)-Number(a.gapCents));
 const over=(portfolio.categories||[]).filter((c:Row)=>c.status==='OVERWEIGHT'&&c.category!=='CASH');
 const researched=search?.candidates?.map((r:Row)=>r.decision_json).find((r:Row)=>r?.decision==='PREPARE'&&r.shares>0&&!Object.keys(r.stageErrors||{}).length&&Number(r.expectancy?.score)>0);
 if(!strongest&&researched)return {action:"PREPARE",symbol:researched.symbol,reason:researched.reason,incomplete:true,trigger:String(researched.trigger)+' · '+researched.confirmation,change:researched.cancelConditions.join('; '),under,over,longTerm,asOf:researched.asOf};
 const action=strongest?(plan.actions.length?strongest.action:'PREPARE'):passive?(passive.action==='DO_NOTHING'?'HOLD':passive.action):holdings.length?'HOLD':'HOLD CASH';
 const reason=strongest?.why||passive?.why||(incomplete?'Maintain recorded exposure and preserve available cash while missing or stale evidence is refreshed. No new order is validated.':holdings.length?'Current evidence does not justify changing exposure. Keep holdings and available cash until an account-qualified opportunity improves the plan.':'Keep available cash until a supported opportunity passes allocation and risk checks.');
 return {action,symbol:strongest?.symbol||null,reason,incomplete,trigger:strongest?.priceCondition||passive?.priceCondition||(longTerm?'Contribution or target-allocation drift review, followed by valuation and risk confirmation.':'A fresh directional thesis, price trigger, liquidity and account risk confirmation.'),change:strongest?.details?.missingConfirmation||strongest?.when||(incomplete?'Complete missing provider research and revalidate current prices, cash and account limits.':'A confirmed trigger, thesis change, concentration change or new contribution changes this plan.'),under,over,longTerm,asOf:status?.latestAt||null};
}
