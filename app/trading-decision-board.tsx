"use client";
import {cloneElement,isValidElement,useState,type ReactNode,type ReactElement} from 'react';
import NextSessionResearch from './next-session-research';
import AccountResearchResults from './account-research-results';
import {accountCurrentDecision} from '@/lib/account-current-decision';
import { tradingPlan } from '@/lib/trading-plan';
import { RecommendationCard } from '@/app/action-guidance-panel';
import { Button } from '@/app/ui/primitives';

function TradingFacts({children}:{children:ReactNode}) { return <div className="trading-facts">{children}</div>; }

type Row = Record<string, any>;
const money = (v: unknown) => v == null ? 'Unavailable' : new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(Number(v)/100);
export default function TradingDecisionBoard({search,data, portfolio, risk, status, marketOpen, onAnalyze, onRefresh, onSave, options}: {search?:Row|null;data:Row;portfolio:Row;risk:Row;status:Row|null;marketOpen:boolean;onAnalyze:()=>void;onRefresh:()=>void;onSave:(a:any)=>void;options?:ReactNode}) {
  const [optionAllocation,setOptionAllocation]=useState<{symbol:string;amountCents:number}|null>(null);
  const plan = tradingPlan(data, portfolio, risk), incomplete = !status || ['EMPTY','STALE','BLOCKED'].includes(status.state);
  const current=accountCurrentDecision(data,portfolio,risk,status,Date.now(),search);
  const researchedPrepare=current.action==='PREPARE'&&!plan.allocations.length?search?.candidates?.find((r:Row)=>r.symbol===current.symbol)?.decision_json:null;
  const researchReserve=researchedPrepare?.shares>0?Math.min(Math.max(0,plan.keepCashCents-plan.reserveCents),Math.ceil(researchedPrepare.totalCost*100)):0;
  const optionBudget=Math.max(0,plan.keepCashCents-plan.reserveCents-researchReserve), optionAmount=optionAllocation&&optionAllocation.amountCents<=optionBudget?optionAllocation.amountCents:0;
  const longTerm = !/SWING|OPTIONS|MIXED|DAY_TRADE/.test(data.strategyType || '');
  return <div className="trading-board" data-testid="trading-board">
    <div className="trading-context rounded-xl border border-line bg-soft p-4">
      <TradingFacts><span>Brokerage cash <b>{money(plan.cashCents)}</b></span><span>Buying power <b>{risk.buyingPowerCents == null ? 'Not supplied by broker' : money(risk.buyingPowerCents)}</b></span><span>Risk <b>{incomplete ? 'Analysis needs refresh' : 'Account limits applied'}</b></span><span>Goal <b>{data.goalName} · {data.horizonMonths} months</b></span></TradingFacts>
      {search&&<p role="status">{search.status} · {search.stage.replaceAll('_',' ')} · {search.counts_json?.deepResearched||0}/{search.counts_json?.shortlisted||0} shortlisted stocks researched</p>}<div className="mt-3 flex flex-wrap gap-2"><Button onClick={onAnalyze}>Refresh Account Intelligence</Button><Button onClick={onAnalyze}>Retry research</Button><a className="p-2" href="/workspace/accounts">Account settings →</a></div>
    </div>
    <section aria-labelledby="trading-actions" className="rounded-xl border border-line bg-surface p-4"><h2 id="trading-actions">ACTIONS</h2>
      <article role="status" className="rounded-lg border border-line bg-soft p-4"><h3>{String(current.action).replaceAll('_',' ')}{current.symbol?' · '+current.symbol:''}</h3><p>{current.reason}</p><p><b>Next trigger:</b> {current.trigger}</p><p><b>What changes the decision:</b> {current.change}</p><small>{current.asOf?'Last account analysis '+new Date(current.asOf).toLocaleString():'No completed account analysis recorded'} · {marketOpen?'Live session; reconfirm before execution':'Next-session plan; live confirmation required before execution'}</small></article>
      <AccountResearchResults search={search} accountId={data.accountId} cashCents={plan.cashCents}/>
      {plan.actions.map(a => <RecommendationCard key={a.symbol} action={a as any} accountName={data.accountName} cashBeforeCents={String(plan.cashCents)} onSave={()=>onSave(a)}/>)}
      {isValidElement(options)?cloneElement(options as ReactElement<any>,{cashLimitCents:optionBudget,onSessionAllocation:setOptionAllocation}):options}
    </section>
    {!!plan.prepare.length && <section aria-labelledby="trading-prepare" className="rounded-xl border border-line bg-surface p-4"><h2 id="trading-prepare">PREPARE</h2>{plan.prepare.map(a=><article key={a.symbol} className="my-3 rounded-lg border border-line p-3"><b>{a.symbol} · {a.details.expectedQuantity} shares if confirmed</b><p>{a.priceCondition}</p><p>Missing confirmation: {a.details.missingConfirmation || a.when}</p><p>{a.why}</p><p>Reserve {money(plan.allocations.find(r=>r.symbol===a.symbol)?.amountCents)}. Recheck price and risk {marketOpen ? 'before entry' : 'at the next session'}.</p></article>)}</section>}
    <section aria-labelledby="trading-positions" className="rounded-xl border border-line bg-surface p-4"><h2 id="trading-positions">POSITION DECISIONS</h2><div className="trading-position-list">{(portfolio.holdings||[]).map((h:Row)=>{const recommendation=(status?.items||[]).find((r:Row)=>r.symbol===h.symbol);const action=plan.actions.find((a:Row)=>a.symbol===h.symbol);return <article key={h.id} className="trading-position rounded-lg border border-line"><b>{h.symbol} · {action?String(action.action).replaceAll('_',' '):'HOLD / REVIEW'}</b><p>{recommendation?.reason||'Maintain recorded exposure while current thesis and risk evidence are reviewed.'}</p><TradingFacts><span>Shares<b>{h.quantity}</b></span><span>Stock average cost<b>{money(h.averageCostCents)}</b></span><span>Recorded price<b>{money(h.priceCents)}</b></span><span>Value<b>{money(h.marketValueCents)}</b></span><span>Gain / loss<b>{money(h.unrealizedPnlCents)}</b></span><span>Weight<b>{(Number(h.weightBps)/100).toFixed(1)}%</b></span></TradingFacts><small>{h.quoteAsOf?new Date(h.quoteAsOf).toLocaleString():'Price timestamp unavailable'}{recommendation?.stale?' · Saved thesis needs refresh':''}</small><p>Next opportunity: {action?.priceCondition||search?.candidates?.find((r:Row)=>r.symbol===h.symbol)?.decision_json?.confirmation||'Reassess this holding’s own thesis, price structure and allocation before changing exposure.'}</p></article>})}</div>{!portfolio.holdings?.length&&<p>No holdings recorded. The cash decision below remains active.</p>}</section>
    <section aria-labelledby="trading-cash" className="rounded-xl border border-line bg-surface p-4"><h2 id="trading-cash">CASH TO INVEST</h2><p>Available brokerage cash: <b>{money(plan.cashCents)}</b></p>
      {plan.allocations.map(row=><p key={row.symbol}><b>{row.conditional ? 'Reserve' : 'Allocate'} {money(row.amountCents)} for {row.quantity} {row.symbol} shares</b> · {row.trigger}</p>)}
      {researchReserve>0&&<p><b>Conditionally reserve {money(researchReserve)} for {researchedPrepare.shares} {researchedPrepare.symbol} shares</b> · trigger {money(researchedPrepare.trigger*100)}. {researchedPrepare.confirmation}. This remains cash until confirmed.</p>}
      {optionAmount>0 && <p><b>Reserve {money(optionAmount)} for the {optionAllocation?.symbol} option action.</b> Confirm the contract and premium in Options Analysis.</p>}
      <p><b>Keep {money(plan.keepCashCents-optionAmount-researchReserve)} cash.</b> {!plan.allocations.length && !optionAmount ? incomplete ? 'Current evidence is incomplete; retain all cash until analysis and account checks pass.' : 'Cash remains uncommitted while ranked alternatives and execution checks are evaluated. See research evidence above.' : 'Retain the remainder for reserves and opportunities that independently qualify.'}</p>
      {plan.reservedReentryCents>0 && <p>Includes {money(plan.reservedReentryCents)} already reserved for existing reentry plans.</p>}
      {longTerm&&<div><h3>Next contribution and rebalancing priorities</h3>{current.under.length?current.under.map((c:Row)=><p key={c.category}><b>Add to {c.category} if valuation and risk confirm</b> · target gap {money(c.gapCents)}. Direct the next contribution toward this shortfall before adding to overweight categories.</p>):<p>Keep the next contribution in cash until target gaps or a qualifying valuation opportunity are identified.</p>}{current.over.map((c:Row)=><p key={c.category}><b>Stop adding to {c.category}</b> · {(Number(c.currentBps)/100).toFixed(1)}% versus {(Number(c.targetBps)/100).toFixed(1)}% target. Review a trim only after tax, thesis and risk checks.</p>)}</div>}
      {longTerm && <><p>Contributions follow portfolio targets and drift, valuation, risk and the {data.horizonMonths}-month {data.goalName} goal.</p><div className="flex flex-wrap gap-3">{(portfolio.categories || []).filter((c:Row)=>c.category!=='CASH' && c.status==='UNDERWEIGHT').map((c:Row)=><span key={c.category}>{c.category}: {(c.currentBps/100).toFixed(1)}% → {(c.targetBps/100).toFixed(1)}% target · gap {money(c.gapCents)}</span>)}</div></>}
      <small>Conditional reserves remain cash until execution. Unexecuted sale proceeds and future contributions are excluded.</small>
    </section>
    <NextSessionResearch accountId={data.accountId}/>
  </div>;
}
