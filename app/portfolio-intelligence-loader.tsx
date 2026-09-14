"use client";

import {useEffect,useState} from "react";
import PortfolioIntelligence from "@/app/portfolio-intelligence";

export default function PortfolioIntelligenceLoader({accountId,accessToken}:{accountId:string;accessToken:string}){
  const[ready,setReady]=useState(false);
  useEffect(()=>{
    setReady(false);
    const timer=window.setTimeout(()=>setReady(true),600);
    return()=>window.clearTimeout(timer);
  },[accountId]);
  if(!ready)return <section className="portfolio-intelligence card account-analysis-skeleton" aria-busy="true" aria-live="polite"><div className="ledger-notice">Loading the selected account’s holdings, cash, targets and recommendations…</div><i/><i/><i/><i/></section>;
  return <PortfolioIntelligence accountId={accountId} accessToken={accessToken}/>;
}
