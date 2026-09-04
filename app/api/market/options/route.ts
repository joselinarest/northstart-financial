import {loadRuntimeSecrets} from "@/lib/runtime-secrets";
export const dynamic = "force-dynamic";

type ChainSnapshot = {
  latestQuote?: { bp?: number; ap?: number; t?: string };
  dailyBar?: { v?: number };
  greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number; rho?: number };
  impliedVolatility?: number;
};

const contractPattern = /^([A-Z.]+)(\d{6})([CP])(\d{8})$/;

function decodeContract(symbol: string) {
  const match = symbol.match(contractPattern);
  if (!match) return null;
  const date = match[2];
  const expiration = `20${date.slice(0, 2)}-${date.slice(2, 4)}-${date.slice(4, 6)}`;
  return { expiration, type: match[3] === "C" ? "call" : "put", strike: Number(match[4]) / 1000 };
}

export async function POST(request: Request) {
  await loadRuntimeSecrets();
  const body = await request.json().catch(() => ({}));
  const symbol = String(body.symbol || "SPY").toUpperCase().trim();
  const outlook = body.outlook === "bearish" ? "bearish" : "bullish";
  const maxRisk = Math.max(50, Math.min(100000, Number(body.maxRisk) || 500));
  const targetDte = Math.max(7, Math.min(180, Number(body.targetDte) || 45));
  if (!/^[A-Z.]{1,10}$/.test(symbol)) return Response.json({ error: "Invalid underlying symbol" }, { status: 400 });
  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) return Response.json({ error: "Connect Alpaca market data to rank live option contracts.", status: "not_configured" }, { status: 503 });

  const feed = process.env.ALPACA_OPTIONS_FEED || "indicative";
  const response = await fetch(`https://data.alpaca.markets/v1beta1/options/snapshots/${symbol}?feed=${encodeURIComponent(feed)}&limit=1000`, { headers: { "APCA-API-KEY-ID": process.env.ALPACA_API_KEY, "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET }, cache: "no-store" });
  if (!response.ok) return Response.json({ error: "The option-chain provider rejected the request.", providerStatus: response.status }, { status: response.status });
  const payload = await response.json() as { snapshots?: Record<string, ChainSnapshot> };
  const now = new Date();
  const wantedType = outlook === "bullish" ? "call" : "put";
  const candidates = Object.entries(payload.snapshots || {}).flatMap(([contractSymbol, snapshot]) => {
    const contract = decodeContract(contractSymbol);
    if (!contract || contract.type !== wantedType) return [];
    const dte = Math.ceil((new Date(`${contract.expiration}T20:00:00Z`).getTime() - now.getTime()) / 86400000);
    if (dte < Math.max(7, targetDte - 20) || dte > targetDte + 25) return [];
    const bid = Number(snapshot.latestQuote?.bp || 0), ask = Number(snapshot.latestQuote?.ap || 0);
    if (bid <= 0 || ask <= 0 || ask * 100 > maxRisk) return [];
    const mid = (bid + ask) / 2, spreadPct = ((ask - bid) / mid) * 100;
    const delta = Number(snapshot.greeks?.delta || 0), targetDelta = outlook === "bullish" ? .4 : -.4;
    const volume = Number(snapshot.dailyBar?.v || 0);
    const score = Math.max(0, Math.round(100 - Math.abs(delta - targetDelta) * 70 - Math.min(35, spreadPct) - Math.abs(dte - targetDte) * .35 + Math.min(12, Math.log10(volume + 1) * 4)));
    return [{ contractSymbol, ...contract, dte, bid, ask, mid, spreadPct, delta, volume, score, iv: snapshot.impliedVolatility ?? null, gamma: snapshot.greeks?.gamma ?? null, theta: snapshot.greeks?.theta ?? null, vega: snapshot.greeks?.vega ?? null }];
  }).sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) return Response.json({ error: "No contract passed the DTE, quote, and maximum-risk filters. Increase the risk limit or change the expiration window." }, { status: 422 });
  const premium = best.ask * 100;
  return Response.json({ underlying: symbol, outlook, feed, asOf: new Date().toISOString(), contract: { ...best, premium, maxLoss: premium, breakeven: best.type === "call" ? best.strike + best.ask : best.strike - best.ask }, rationale: [`Closest liquid candidate to ${targetDte} DTE and ±0.40 delta`, `Maximum debit $${premium.toFixed(0)} stays within the $${maxRisk.toFixed(0)} risk limit`, `Bid–ask spread is ${best.spreadPct.toFixed(1)}%; narrower is better`], warnings: ["Verify the quote immediately before acting; option markets change quickly.", "Check earnings, dividends, assignment, taxes, and portfolio concentration.", "This is a ranked research candidate, not an order or guarantee."] }, { headers: { "Cache-Control": "private, no-store" } });
}
