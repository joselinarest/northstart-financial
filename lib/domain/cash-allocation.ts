/** Allocation math only. A target gap never authorizes an order. All money is cents. */
export function allocateCash(input: {
  cash: bigint; safeCapacity: bigint; reserved: bigint; reserveBps: number;
  maximumPositionBps: number; fractional: boolean;
  targets: Record<string, number>;
  holdings: {symbol: string; category: string; value: bigint; price: bigint}[];
}) {
  const min = (...values: bigint[]) => values.reduce((a, b) => a < b ? a : b);
  const positive = (value: bigint) => value > 0n ? value : 0n;
  for (const bps of [...Object.values(input.targets), input.reserveBps, input.maximumPositionBps]) {
    if (!Number.isInteger(bps) || bps < 0 || bps > 10000) throw Error('Invalid allocation percentage');
  }
  if (Object.values(input.targets).reduce((a,b)=>a+b,0) !== 10000) throw Error('Targets must total 100%');
  if (input.cash < 0n || input.holdings.some(h=>h.value<0n)) throw Error('Negative balances require a margin-aware allocation review');
  const total = input.cash + input.holdings.reduce((sum,h)=>sum+h.value,0n);
  const reserve = total * BigInt(Math.max(input.reserveBps, input.targets.CASH || 0)) / 10000n;
  const reserved = positive(input.reserved);
  const budget = positive(min(input.cash - reserve - reserved, positive(input.safeCapacity)));
  const groups = new Map<string, typeof input.holdings[number]>();
  for (const h of input.holdings) {
    const previous = groups.get(h.symbol);
    if (previous) { previous.value += h.value; if (previous.price !== h.price) previous.price = 0n; }
    else groups.set(h.symbol, {...h});
  }
  const holdings = [...groups.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
  const categoryValue = (category: string) => holdings.filter(h=>h.category===category).reduce((sum,h)=>sum+h.value,0n);
  const categoryGap = (category: string) => positive(total * BigInt(input.targets[category] || 0)/10000n - categoryValue(category));
  // Equal targets within each saved category, capped by the account position limit.
  // No inferred expected returns are used to overweight a security.
  const rows = holdings.map(h=>{
    const count = holdings.filter(x=>x.category===h.category).length;
    const target = min(total * BigInt(input.targets[h.category] || 0)/10000n/BigInt(count), total*BigInt(input.maximumPositionBps)/10000n);
    return {...h, target, gap: h.category==='CASH' ? 0n : positive(target-h.value), allocation:0n};
  });
  // Cap the sum of per-security gaps by the category gap before sharing one cash budget.
  for (const category of Object.keys(input.targets)) {
    const members = rows.filter(r=>r.category===category);
    const sum = members.reduce((s,r)=>s+r.gap,0n), cap = min(sum,categoryGap(category));
    for (const r of members) r.allocation = sum>0n ? r.gap*cap/sum : 0n;
  }
  const demand = rows.reduce((s,r)=>s+r.allocation,0n);
  const usable = min(budget,demand);
  let spent = 0n;
  const result = rows.map(r=>{
    const assigned = demand>0n ? usable*r.allocation/demand : 0n;
    const scale = input.fractional ? 1000n : 1n;
    const units = r.price>0n ? assigned*scale/r.price : 0n;
    const cost = units>0n ? (units*r.price+scale-1n)/scale : 0n;
    spent += cost;
    const bps = (value: bigint) => total>0n ? Number(value*10000n/total) : 0;
    return {symbol:r.symbol,category:r.category,currentBps:bps(r.value),targetBps:bps(r.target),afterBps:bps(r.value+cost),gapCents:r.gap.toString(),allocatedCents:assigned.toString(),estimatedCostCents:cost.toString(),shares:(Number(units)/Number(scale)).toFixed(input.fractional?3:0),priceCents:r.price.toString(),remainingGapCents:positive(r.gap-cost).toString(),status:r.gap===0n?'HOLD':r.price<=0n?'PRICE_REQUIRED':units===0n?'WAIT_FOR_CASH':'REVIEW_ENTRY'};
  });
  return {cashBeforeCents:input.cash.toString(),reserveCents:reserve.toString(),reservedReentryCents:reserved.toString(),deployableCents:budget.toString(),estimatedCostCents:spent.toString(),cashAfterCents:(input.cash-spent).toString(),unallocatedCents:(budget-spent).toString(),rows:result,method:'Equal weights within each saved category, capped by maximum position size; cash is shared in proportion to eligible dollar gaps.',executionAllowed:false};
}
