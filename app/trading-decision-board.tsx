"use client";
import {cloneElement,isValidElement,useState,type ReactNode,type ReactElement} from 'react';
import { tradingPlan } from '@/lib/trading-plan';
import { RecommendationCard } from '@/app/action-guidance-panel';
import { Button, FactGrid } from '@/app/ui/primitives';

type Row = Record<string, any>;
const money = (v: unknown) => v == null ? 'Unavailable' : new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(Number(v)/100);
export default function TradingDecisionBoard({data, portfolio, risk, status, marketOpen, onAnalyze, onRefresh, onSave, options}: {data:Row;portfolio:Row;risk:Row;status:Row|null;marketOpen:boolean;onAnalyze:()=>void;onRefresh:()=>void;onSave:(a:any)=>void;options?:ReactNode}) {
  const [optionAllocation,setOptionAllocation]=useState<{symbol:string;amountCents:number}|null>(null);
  const plan = tradingPlan(data, portfolio, risk), incomplete = !status || ['EMPTY','STALE','BLOCKED'].includes(status.state);
  const optionBudget=Math.max(0,plan.keepCashCents-plan.reserveCents), optionAmount=optionAllocation&&optionAllocation.amountCents<=optionBudget?optionAllocation.amountCents:0;
  const longTerm = !/SWING|OPTIONS|MIXED|DAY_TRADE/.test(data.strategyType || '');
  return <div className="grid min-w-0 gap-4" data-testid="trading-board">
    <div className="trading-context rounded-xl border border-line bg-soft p-4">
      <FactGrid compact><span>Brokerage cash <b>{money(plan.cashCents)}</b></span><span>Buying power <b>{risk.buyingPowerCents == null ? 'Not supplied by broker' : money(risk.buyingPowerCents)}</b></span><span>Risk <b>{incomplete ? 'Analysis needs refresh' : 'Account limits applied'}</b></span><span>Goal <b>{data.goalName} · {data.horizonMonths} months</b></span></FactGrid>
      <div className="mt-3 flex flex-wrap gap-2"><Button onClick={onAnalyze}>Run account analysis</Button><Button onClick={onRefresh}>Refresh results</Button><a className="p-2" href="/workspace/accounts">Account settings →</a></div>
    </div>
    <section aria-labelledby="trading-actions" className="rounded-xl border border-line bg-surface p-4"><h2 id="trading-actions">ACTIONS</h2>
      {!plan.actions.length && !optionAmount && <p role="status">{incomplete ? 'Analysis is incomplete or expired. Refresh account analysis before acting.' : 'No high-quality action currently meets your account and risk requirements.'}</p>}
      {plan.actions.map(a => <RecommendationCard key={a.symbol} action={a as any} accountName={data.accountName} cashBeforeCents={String(plan.cashCents)} onSave={()=>onSave(a)}/>)}
      {isValidElement(options)?cloneElement(options as ReactElement<any>,{cashLimitCents:optionBudget,onSessionAllocation:setOptionAllocation}):options}
    </section>
    {!!plan.prepare.length && <section aria-labelledby="trading-prepare" className="rounded-xl border border-line bg-surface p-4"><h2 id="trading-prepare">PREPARE</h2>{plan.prepare.map(a=><article key={a.symbol} className="my-3 rounded-lg border border-line p-3"><b>{a.symbol} · {a.details.expectedQuantity} shares if confirmed</b><p>{a.priceCondition}</p><p>Missing confirmation: {a.details.missingConfirmation || a.when}</p><p>{a.why}</p><p>Reserve {money(plan.allocations.find(r=>r.symbol===a.symbol)?.amountCents)}. Recheck price and risk {marketOpen ? 'before entry' : 'at the next session'}.</p></article>)}</section>}
    <section aria-labelledby="trading-positions" className="rounded-xl border border-line bg-surface p-4"><h2 id="trading-positions">POSITIONS</h2><div className="grid gap-3 md:grid-cols-2">{(portfolio.holdings || []).map((h:Row)=>{
      const a = (data.queue || []).find((a:Row)=>a.symbol===h.symbol && !a.details?.analysisPending), ready = plan.actions.find(a=>a.symbol===h.symbol), prep = plan.prepare.find(a=>a.symbol===h.symbol);
      const label = ready ? /SELL/.test(ready.action) ? 'SELL IF' : /REDUCE|TRIM|TAKE_PROFIT/.test(ready.action) ? 'TRIM IF' : 'ADD IF' : prep ? 'ADD IF' : h.action === 'REDUCE' ? 'TRIM IF' : 'HOLD';
      return <article key={h.id} className="trading-position min-w-0 rounded-lg border border-line p-3"><b>{h.symbol} · {label}</b><p>{h.name}{h.quoteAsOf ? " · "+new Date(h.quoteAsOf).toLocaleString() : ""}</p><FactGrid compact><span>Shares <b>{h.quantity}</b></span><span>Average cost <b>{money(h.averageCostCents)}</b></span><span>{h.quoteAsOf ? 'Latest quote' : 'Last recorded price'} <b>{money(h.priceCents)}</b></span><span>Position value <b>{money(h.marketValueCents)}</b></span><span>Gain / loss <b>{money(h.unrealizedPnlCents)}</b></span><span>Portfolio weight <b>{(h.weightBps/100).toFixed(2)}%</b></span></FactGrid><p>{a?.why || (h.action==='REDUCE' ? 'Review concentration against account targets; trim only after thesis, tax and risk confirmation.' : 'Keep the position pending fresh account-specific analysis.')}</p>{(ready || prep) && <p>Next opportunity: {(ready || prep)?.priceCondition}</p>}<a href={`/workspace/research/${encodeURIComponent(h.symbol.toLowerCase())}?accountId=${encodeURIComponent(data.accountId)}`}>Research position →</a></article>;
    })}</div>{!portfolio.holdings?.length && <p>No holdings recorded in this account.</p>}</section>
    <section aria-labelledby="trading-cash" className="rounded-xl border border-line bg-surface p-4"><h2 id="trading-cash">CASH TO INVEST</h2><p>Available brokerage cash: <b>{money(plan.cashCents)}</b></p>
      {plan.allocations.map(row=><p key={row.symbol}><b>{row.conditional ? 'Reserve' : 'Allocate'} {money(row.amountCents)} for {row.quantity} {row.symbol} shares</b> · {row.trigger}</p>)}
      {optionAmount>0 && <p><b>Reserve {money(optionAmount)} for the {optionAllocation?.symbol} option action.</b> Confirm the contract and premium in Options Analysis.</p>}
      <p><b>Keep {money(plan.keepCashCents-optionAmount)} cash.</b> {!plan.allocations.length && !optionAmount ? incomplete ? 'Current evidence is incomplete; retain all cash until analysis and account checks pass.' : 'No purchase currently meets the account’s allocation, valuation and risk requirements.' : 'Retain the remainder for reserves and opportunities that independently qualify.'}</p>
      {plan.reservedReentryCents>0 && <p>Includes {money(plan.reservedReentryCents)} already reserved for existing reentry plans.</p>}
      {longTerm && <><p>Contributions follow portfolio targets and drift, valuation, risk and the {data.horizonMonths}-month {data.goalName} goal.</p><div className="flex flex-wrap gap-3">{(portfolio.categories || []).filter((c:Row)=>c.category!=='CASH' && c.status==='UNDERWEIGHT').map((c:Row)=><span key={c.category}>{c.category}: {(c.currentBps/100).toFixed(1)}% → {(c.targetBps/100).toFixed(1)}% target · gap {money(c.gapCents)}</span>)}</div></>}
      <small>Conditional reserves remain cash until execution. Unexecuted sale proceeds and future contributions are excluded.</small>
    </section>
  </div>;
}
