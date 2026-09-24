"use client";
import {createContext,useContext,type ReactNode} from 'react';
import {holdingCost,type CostHolding} from '@/lib/holding-cost';
const Context=createContext<{holdings:CostHolding[];accountId:string}>({holdings:[],accountId:''});
export function HoldingCostProvider({holdings,accountId,children}:{holdings:CostHolding[];accountId:string;children:ReactNode}){return <Context.Provider value={{holdings,accountId}}>{children}</Context.Provider>}
export function useHoldingCost(symbol:string,accountId?:string){const context=useContext(Context);return holdingCost(context.holdings,accountId??context.accountId,symbol)}
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
export default function HoldingCostBadge({symbol,accountId,currentPrice,stop}:{symbol?:string|null;accountId?:string;currentPrice?:number|null;stop?:number|null}){
 const holding=useHoldingCost(symbol||'',accountId);if(!holding)return null;
 const supplied=currentPrice!=null&&Number.isFinite(currentPrice)&&currentPrice>0,price=supplied?currentPrice:holding.storedPrice;
 const change=holding.average!=null&&holding.average>0&&price!=null?(price-holding.average)/holding.average*100:null;
 return <span className="holding-cost-badge" style={{display:'flex',flexWrap:'wrap',gap:'5px 12px',fontSize:12,lineHeight:1.5,padding:'8px 10px',border:'1px solid #78998a',borderRadius:7,marginBlock:8,overflowWrap:'anywhere'}}>
  <strong>Your avg. buy: {holding.average==null?'Not provided':money(holding.average)}</strong>
  <span>{holding.shares.toLocaleString(undefined,{maximumFractionDigits:6})} shares · this account</span>
  {price!=null&&<span>{supplied?'Compared price':'Saved holding price'}: {money(price)}{change!=null?` · ${change>=0?'+':''}${change.toFixed(2)}% vs buy`:''}</span>}
  {holding.average!=null&&stop!=null&&Number.isFinite(stop)&&stop>0&&<span>Stop vs buy: {money(stop-holding.average)}/share{price!=null?` · ${money(Math.max(0,price-stop)*holding.shares)} downside from compared price to stop`:''}</span>}
  <small>Recorded cost basis ÷ shares; average across purchases. Gain/loss is not a risk score.</small>
 </span>;
}
