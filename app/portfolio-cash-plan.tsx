import styles from './portfolio-cash-plan.module.css';

type Plan = ReturnType<typeof import('../lib/domain/cash-allocation').allocateCash>;
const money=(cents:string)=>Number(cents)/100;
const dollars=(cents:string)=>money(cents).toLocaleString(undefined,{style:'currency',currency:'USD'});
const percent=(bps:number)=>`${(bps/100).toFixed(2)}%`;

export default function PortfolioCashPlan({plan,accountName}:{plan:Plan;accountName:string}) {
  return <section className={styles.plan} aria-label={`${accountName} cash allocation plan`}>
    <header><span>CASH → TARGET ALLOCATION</span><h3>Put {accountName}’s cash toward the gaps</h3><p>Use new cash to bring the portfolio closer to its saved percentage targets. These are allocation estimates; better balance does not guarantee faster growth.</p></header>
    <div className={styles.totals}>
      <div>Account cash<strong>{dollars(plan.cashBeforeCents)}</strong></div>
      <div>Cash reserve<strong>{dollars(plan.reserveCents)}</strong></div>
      <div>Reserved for reentry<strong>{dollars(plan.reservedReentryCents)}</strong></div>
      <div>Available to allocate<strong>{dollars(plan.deployableCents)}</strong></div>
    </div>
    <p><b>The calculation:</b> target dollars = account value including cash × target %. Gap = target dollars − current holding value. Available cash is divided proportionally across eligible gaps.</p>
    <details><summary>How each holding’s target is chosen</summary><p>{plan.method} Category targets come from this account’s saved allocation, or its strategy defaults. Targets are planning weights, not predictions of a stock’s return.</p></details>
    <div className={styles.rows}>{plan.rows.map(row=><article key={row.symbol}>
      <header><b>{row.symbol || 'Unmapped holding'} <small>{row.category}</small></b><strong>{row.status==='REVIEW_ENTRY'?'ENTRY REVIEW':row.status==='PRICE_REQUIRED'?'PRICE REQUIRED':row.status==='WAIT_FOR_CASH'?'WAIT / KEEP CASH':'HOLD / STOP ADDING'}</strong></header>
      <div className={styles.weights}><span>Current <b>{percent(row.currentBps)}</b></span><span>Target <b>{percent(row.targetBps)}</b></span><span>After proposed allocation <b>{percent(row.afterBps)}</b></span></div>
      <p>{row.status==='REVIEW_ENTRY'?<>Set aside <b>{dollars(row.allocatedCents)}</b> for {row.symbol}. At the saved valuation of {dollars(row.priceCents)}, that covers about <b>{row.shares} shares</b> costing {dollars(row.estimatedCostCents)}.</>:row.status==='PRICE_REQUIRED'?'A verified price is needed before calculating shares. Keep this allocation in cash.':row.status==='WAIT_FOR_CASH'?'No affordable allocation is available after reserves, account safety limits and share rounding. Keep monitoring.':'This holding does not need more cash under the current allocation and position limits.'}</p>
      <p>Gap to target: <b>{dollars(row.gapCents)}</b> · Remaining after this plan: <b>{dollars(row.remainingGapCents)}</b></p>
      {row.status==='REVIEW_ENTRY'&&<p className={styles.note}>Not a BUY NOW instruction. Verify a fresh quote, entry confirmation, order price, fees and risk budget in the central trade review before buying. The saved valuation is not an order limit.</p>}
      {row.symbol&&<a href={`/workspace/research/${encodeURIComponent(row.symbol.toLowerCase())}`}>Review {row.symbol} before investing →</a>}
    </article>)}</div>
    <footer><b>Estimated purchases: {dollars(plan.estimatedCostCents)} · Cash remaining: {dollars(plan.cashAfterCents)}</b><p>{dollars(plan.unallocatedCents)} of the deployable budget stays unallocated because of share rounding, position limits, or categories without eligible holdings. Reserved cash stays available for its existing purpose. Fees may reduce purchasable shares; this plan never places orders.</p></footer>
  </section>;
}
