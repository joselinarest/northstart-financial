"use client";
import {useEffect} from 'react';
import {readChartSetup} from '@/lib/chart-setup-link';
export function useChartLinkSelection(tab:string,setSymbol:(value:string)=>void,setLookup:(value:string)=>void,setTimeframe:(value:string)=>void){
 useEffect(()=>{
  if(tab!=="Professional Charts")return;
  const linked=window.location.pathname==='/workspace/charts'?readChartSetup(window.location.search):null;
  const saved=sessionStorage.getItem('northstar-chart-symbol');
  const symbol=linked?.symbol||saved;
  if(symbol){setSymbol(symbol);setLookup(symbol)}
  if(linked)setTimeframe('5m');
  if(saved)sessionStorage.removeItem('northstar-chart-symbol');
 },[tab,setSymbol,setLookup,setTimeframe]);
}
