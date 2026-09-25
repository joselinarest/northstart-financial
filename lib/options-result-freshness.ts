/** Saved research remains readable; an old result never remains an entry signal. */
export function currentOptionsResult(input: Record<string, any>, now=Date.now()) {
  const timestamp=Date.parse(String(input.asOf||'')),age=now-timestamp;
  if(Number.isFinite(timestamp)&&age>=0&&age<=120000)return input;
  return {...input,status:'NO_TRADE',decisionLabel:'WAIT',contract:null,priorContract:input.contract||null,freshness:'STALE',rationale:['Saved analysis is stale. Refresh price, contract quotes, account risk and confirmation before acting.',...(input.rationale||[])],decision:{...input.decision,action:'WAIT',shares:0,interpretation:'WAIT — saved evidence needs revalidation.',whatWouldChange:['Fresh provider data and central decision checks must pass.',...(input.decision?.whatWouldChange||[])]}};
}
