// Without a usable protective stop, reserve the entire long position value.
export function holdingOpenRisk(quantity: unknown, priceCents: unknown, state: unknown): number {
  let parsed: any = state;
  if (typeof state === 'string') { try { parsed = JSON.parse(state); } catch { parsed = null; } }
  const price = Number(priceCents) / 100;
  const shares = Number(quantity);
  if (!Number.isFinite(price) || !Number.isFinite(shares)) return Number.POSITIVE_INFINITY;
  const rawStop = Number(parsed?.stop);
  const stop = Number.isFinite(rawStop) && rawStop > 0 ? rawStop : 0;
  return Math.max(0, shares) * Math.max(0, price - stop);
}
