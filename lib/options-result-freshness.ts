import {nextOpenResearch,optionQuoteResearchFresh} from "@/lib/options-next-open";
/** Saved research remains readable; an old result never remains an entry signal. */
export function currentOptionsResult(input: Record<string, any>, now=Date.now()) {
  if(input.researchQualified&&input.contract&&nextOpenResearch(now)&&optionQuoteResearchFresh(input.quoteAsOf||input.contract.quoteAsOf||input.asOf,now))return {...input,status:'RESEARCH',executionReady:false,freshness:'LAST_SESSION_RESEARCH',decision:{...input.decision,action:'WAIT',shares:0}};
  const researchAge=now-Date.parse(String(input.analyzedAt||''));
  if(input.researchOnly&&nextOpenResearch(now)&&researchAge>=0&&researchAge<=20*60000)return {...input,executionReady:false,freshness:'RECENT_AFTER_CLOSE_RESEARCH',decision:{...input.decision,action:'WAIT',shares:0}};
  const timestamp=Date.parse(String(input.asOf||'')),age=now-timestamp;
  if(Number.isFinite(timestamp)&&age>=0&&age<=120000)return input;
  return {...input,status:'NO_TRADE',decisionLabel:'WAIT',contract:input.contract||null,priorContract:input.contract||null,executionReady:false,researchQualified:false,freshness:'STALE',rationale:['Saved analysis is stale. Refresh price, contract quotes, account risk and confirmation before acting.',...(input.rationale||[])],decision:{...input.decision,action:'WAIT',shares:0,interpretation:'WAIT — saved evidence needs revalidation.',whatWouldChange:['Fresh provider data and central decision checks must pass.',...(input.decision?.whatWouldChange||[])]}};
}
