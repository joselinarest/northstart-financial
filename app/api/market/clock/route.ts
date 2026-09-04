import {loadRuntimeSecrets} from "@/lib/runtime-secrets";
export const dynamic = "force-dynamic";

export async function GET() {
  await loadRuntimeSecrets();
  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) return Response.json({ status: "not_configured", error: "Connect Alpaca to enable the official U.S. exchange clock." }, { status: 503 });
  const base = (process.env.ALPACA_CLOCK_BASE_URL || "https://paper-api.alpaca.markets").replace(/\/(?:v2(?:\/clock)?)?\/?$/, "");
  const response = await fetch(`${base}/v2/clock`, { headers: { "APCA-API-KEY-ID": process.env.ALPACA_API_KEY, "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET }, cache: "no-store" });
  if (!response.ok) return Response.json({ status: "provider_error", error: "The official market clock could not be loaded." }, { status: response.status });
  const clock = await response.json() as { timestamp:string; is_open:boolean; next_open:string; next_close:string };
  return Response.json({ status: "connected", timestamp: clock.timestamp, isOpen: clock.is_open, nextOpen: clock.next_open, nextClose: clock.next_close }, { headers: { "Cache-Control": "private, max-age=30" } });
}
