type Row = Record<string, any>;
const cents = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0));
const buys = new Set(['BUY_NOW', 'BUY', 'ADD', 'REBUY', 'REBUY_IF', 'ROTATE', 'BUY_ON_CONFIRMATION', 'WAIT_FOR_PRICE']);
const sells = new Set(['SELL', 'REDUCE', 'TRIM', 'TAKE_PROFIT']);

/** One cash budget for all displayed proposals. Unexecuted sales never fund buys. */
export function tradingPlan(guidance: Row, portfolio: Row, risk: Row, now = Date.now()) {
  const cash = cents(guidance.availableCashPlan?.cashCents);
  const reentryReserve = cents(portfolio.cashAllocation?.reservedReentryCents);
  const reserve = reentryReserve + Math.max(cents(portfolio.cashAllocation?.reserveCents), cents(risk.value * 100 * Number(risk.effective?.cashReserveBps || 0) / 10000));
  let remaining = Math.max(0, cash - reserve);
  const seen = new Set<string>(), actions: Row[] = [], prepare: Row[] = [], allocations: Row[] = [];
  for (const source of guidance.queue || []) {
    const d = source.details || {}, symbol = source.symbol;
    if (!symbol || seen.has(symbol) || d.analysisPending || !d.recommendationId || !d.expiration || Date.parse(d.expiration) <= now) continue;
    if (!Number.isFinite(Date.parse(d.expiration))) continue;
    const purchase = buys.has(source.action), sale = sells.has(source.action);
    const ready = Number(source.quantity) > 0 && ['READY', 'TRIGGERED'].includes(source.lifecycle) && (purchase || sale);
    const near = !ready && purchase && d.prepareEligible === true && Number(d.expectedQuantity) > 0 && Number(d.triggerPriceCents) > 0;
    if (!ready && !near) continue;
    const quantity = Number(ready ? source.quantity : d.expectedQuantity);
    const amount = ready ? cents(source.amountCents) : Math.ceil(quantity * Number(d.triggerPriceCents));
    if (purchase && (!amount || amount > remaining)) continue;
    seen.add(symbol);
    const action = {...source, details: {...d, estimatedCashAfterCents: String(purchase ? remaining - amount + Math.min(cash, reserve) : cash + amount)}};
    if (purchase) {
      remaining -= amount;
      allocations.push({symbol, quantity, amountCents: amount, conditional: !ready, trigger: source.priceCondition, reason: source.why});
    }
    (ready ? actions : prepare).push(action);
  }
  return {actions, prepare, allocations, cashCents: cash, keepCashCents: cash - allocations.reduce((sum, row) => sum + row.amountCents, 0), reservedReentryCents: Math.min(cash,reentryReserve), reserveCents: Math.min(cash, reserve)};
}
