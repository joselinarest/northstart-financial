type NewsItem = Record<string, any>;
export function newsTimestamp(item: NewsItem): number {
  const value = item.datetime ?? item.publishedAt ?? item.created_at;
  const numeric = Number(value);
  if (value != null && value !== '' && Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
/** Transparent headline screening, never a prediction of the stock's return. */
export function stockNewsImpact(item: NewsItem) {
  const supplied = String(item.impact || item.sentiment || '').toLowerCase();
  const headline = String(item.headline || item.title || '');
  const positive = /\b(beat(?:s)? (?:earnings|profit|revenue|estimates|expectations)|raises? (?:its )?(?:guidance|outlook|forecast)|wins? (?:a |major |new )?contract|(?:fda|regulatory) approval|dividend (?:increase|hike)|increases? (?:its )?dividend|upgraded? to buy)\b/i.test(headline);
  const negative = /\b(miss(?:es)? (?:earnings|profit|revenue|estimates|expectations)|cuts? (?:its )?(?:guidance|outlook|forecast)|lowers? (?:its )?(?:guidance|outlook|forecast)|(?:faces?|under) (?:a )?(?:lawsuit|investigation)|bankruptcy|recall|downgraded? to (?:sell|underperform)|dividend (?:cut|suspension)|suspends? (?:its )?dividend)\b/i.test(headline);
  const ambiguous = /\b(no|not|denies?|rumou?r|could|may|might|reportedly)\b|\?/.test(headline.toLowerCase());
  const suppliedTone = /^(positive|bullish)$/.test(supplied) ? 'positive' : /^(negative|bearish)$/.test(supplied) ? 'negative' : /^(mixed|neutral)$/.test(supplied) ? 'mixed' : null;
  const tone = suppliedTone || (ambiguous ? 'unknown' : positive && negative ? 'mixed' : positive ? 'positive' : negative ? 'negative' : 'unknown');
  const reason = item.whyItMatters || (tone === 'positive' ? 'The reported development may support earnings expectations or investor demand. Verify its size and whether it is already reflected in the price.' : tone === 'negative' ? 'The reported development may pressure earnings expectations or increase company risk. Verify its scope and the company’s response.' : tone === 'mixed' ? 'The evidence has offsetting implications; the net effect on the stock is unclear.' : 'The direction of the stock impact has not been established. Review the source before changing the trade plan.');
  return {tone, label: tone === 'positive' ? 'Potential positive impact' : tone === 'negative' ? 'Potential negative impact' : tone === 'mixed' ? 'Mixed impact' : 'Impact uncertain', reason, basis: suppliedTone ? 'Source-provided assessment' : 'Preliminary headline assessment', importance: Number(item.importance) || (positive || negative ? 3 : /earnings|guidance|merger|acquisition|regulator|lawsuit/i.test(headline) ? 2 : 1)};
}
export function importantStockNews(symbol: string, items: NewsItem[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const related = Array.isArray(item.related) ? item.related : String(item.related || '').split(',');
    if (item.related && !related.some((s: unknown) => String(s).trim().toUpperCase() === symbol.toUpperCase())) return false;
    const key = String(item.url || item.headline || item.title || item.id);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map((item): NewsItem & {assessment:ReturnType<typeof stockNewsImpact>} => ({...item, assessment: stockNewsImpact(item)})).sort((a, b) => b.assessment.importance - a.assessment.importance || newsTimestamp(b) - newsTimestamp(a));
}
