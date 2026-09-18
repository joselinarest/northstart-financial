import { POST as analyzeOption } from "@/app/api/market/options/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ScanBody = {
  accountId?: string;
  symbols?: string[];
  maxRisk?: number;
  targetDte?: number;
};

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = (await request.json().catch(() => ({}))) as ScanBody;
    const accountId = String(body.accountId || "");
    const symbols = [...new Set((body.symbols || []).map(value => String(value).trim().toUpperCase()).filter(value => /^[A-Z.]{1,10}$/.test(value)))].slice(0, 6);
    if (!accountId) return Response.json({ error: "Select an investment account before scanning options." }, { status: 400 });
    if (!symbols.length) return Response.json({ error: "No eligible stocks were available for this scan." }, { status: 400 });

    const headers = new Headers({ "Content-Type": "application/json" });
    const authorization = request.headers.get("authorization");
    const cookie = request.headers.get("cookie");
    if (authorization) headers.set("authorization", authorization);
    if (cookie) headers.set("cookie", cookie);

    const evaluations = await Promise.all(symbols.flatMap(symbol =>
      ["bullish", "bearish"].map(async outlook => {
        const nested = new Request(new URL("/api/market/options", request.url), {
          method: "POST",
          headers,
          body: JSON.stringify({
            accountId,
            symbol,
            outlook,
            maxRisk: body.maxRisk,
            targetDte: body.targetDte,
          }),
        });
        const response = await analyzeOption(nested);
        const result = await response.json();
        if (!response.ok) {
          return {
            ok: false as const,
            symbol: symbol + " " + (outlook === "bullish" ? "CALL" : "PUT"),
            reason: String(result.error || "Option analysis failed"),
            status: response.status,
          };
        }
        return { ok: true as const, result };
      }),
    ));

    const results = evaluations.filter(item => item.ok).map(item => item.result);
    const rejections = evaluations.filter(item => !item.ok).map(item => ({
      symbol: item.symbol,
      reason: item.symbol + ": " + item.reason,
      status: item.status,
    }));
    console.info("options.scan_completed", {
      accountId,
      symbols: symbols.length,
      evaluations: evaluations.length,
      results: results.length,
      rejected: rejections.length,
      durationMs: Date.now() - started,
    });
    return Response.json({ results, rejections, symbols, durationMs: Date.now() - started }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("options.scan_failed", {
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    });
    return Response.json({ error: "The options scan could not be completed. Please retry." }, { status: 500 });
  }
}