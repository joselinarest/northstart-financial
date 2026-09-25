"use client";
import {createContext,useContext,type ReactNode} from 'react';
import {holdingCost,type CostHolding} from '@/lib/holding-cost';
const Context=createContext<{holdings:CostHolding[];accountId:string;accounts:{id?:unknown;name?:unknown;nickname?:unknown}[]}>({holdings:[],accountId:'',accounts:[]});
export function HoldingCostProvider({holdings,accountId,accounts=[],children}:{holdings:CostHolding[];accountId:string;accounts?:{id?:unknown;name?:unknown;nickname?:unknown}[];children:ReactNode}){return <Context.Provider value={{holdings,accountId,accounts}}>{children}</Context.Provider>}
export function useHoldingCost(symbol:string,accountId?:string){const context=useContext(Context);return holdingCost(context.holdings,accountId??context.accountId,symbol)}
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
export default function HoldingCostBadge({symbol,accountId,currentPrice,stop,compact=false}:{compact?:boolean;symbol?:string|null;accountId?:string;currentPrice?:number|null;stop?:number|null}){
 const context=useContext(Context),activeAccount=accountId??context.accountId;
 const holding=useHoldingCost(symbol||'',activeAccount);if(!holding)return null;
 const account=context.accounts.find(a=>String(a.id)===activeAccount),name=String(account?.nickname||account?.name||'Selected investment account'),accountLabel=/^(plaid_|manual_account_)/.test(name)?'Selected investment account':name;
 const supplied=currentPrice!=null&&Number.isFinite(currentPrice)&&currentPrice>0,price=supplied?currentPrice:holding.storedPrice;
 const change=holding.average!=null&&holding.average>0&&price!=null?(price-holding.average)/holding.average*100:null;
 if(compact)return <span className="shortlist-position"><span className="shortlist-position-caption">Owned in {accountLabel} · {holding.shares.toLocaleString(undefined,{maximumFractionDigits:4})} shares</span><span className="shortlist-position-grid"><span><small>Average cost</small><b>{holding.average==null?"Unavailable":money(holding.average)}</b></span><span><small>{supplied?"Compared price":"Saved price"}</small><b>{price==null?"Unavailable":money(price)}</b></span><span><small>Position value</small><b>{price==null?"Unavailable":money(price*holding.shares)}</b></span><span className={change==null?"":change>=0?"position-gain":"position-loss"}><small>Unrealized gain / loss</small><b>{price==null||holding.cost==null?"Unavailable":money(price*holding.shares-holding.cost)}</b><small>{change==null?"Cost basis required":(change>=0?"+":"")+change.toFixed(2)+"%"}</small></span></span></span>;
 return <span className="my-2! flex! min-w-0! flex-wrap! gap-x-3! gap-y-1! rounded-lg! border! border-line! bg-soft! p-3! text-sm! leading-relaxed! text-ink! [overflow-wrap:anywhere]">
  <strong>Your avg. buy: {holding.average==null?'Cost basis unavailable':money(holding.average)}</strong>
  <span>Account: {accountLabel} · {holding.shares.toLocaleString(undefined,{maximumFractionDigits:6})} shares</span>
  {price!=null&&<span>{supplied?'Compared price':'Saved holding price'}: {money(price)}{change!=null?` · ${change>=0?'+':''}${change.toFixed(2)}% vs buy`:''}</span>}
  {price!=null&&<span>Position value: {money(price*holding.shares)}{holding.cost!=null?` · Unrealized P/L: ${money(price*holding.shares-holding.cost)}`:''}</span>}
  {holding.average!=null&&stop!=null&&Number.isFinite(stop)&&stop>0&&<span>Stop vs buy: {money(stop-holding.average)}/share{price!=null?` · ${money(Math.max(0,price-stop)*holding.shares)} downside from compared price to stop`:''}</span>}
  <small>Recorded cost basis ÷ shares; average across purchases. Gain/loss is not a risk score.</small>
 </span>;
}
