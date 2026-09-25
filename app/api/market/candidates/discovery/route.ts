/* eslint-disable @typescript-eslint/no-explicit-any */
import { discoveryCoverage,queueDiscoveryRefresh } from "@/lib/discovery-queue";
import { id, workspace } from "@/lib/db";
import { listMarketDiscoveries } from "@/lib/market-discovery-engine";
import { rankCandidatesForAccount } from "@/lib/account-candidate-ranking";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Row = Record<string, any>;
export async function GET(request: Request) {
  try {
    const { db, householdId } = await workspace(request),
      url = new URL(request.url),
      search = (url.searchParams.get("search") || "").trim().toUpperCase(),
      accountId = url.searchParams.get("accountId") || "",
      result = await listMarketDiscoveries(
        db,
        search,
        url.searchParams.get("strategy") || "ALL",
      ),
      rows = result.candidates as Row[],
      minimumConfidence = 62,
      ranked: { account: Row | null; candidates: Row[] } = accountId
        ? await rankCandidatesForAccount(db, householdId, accountId, rows)
        : { account: null, candidates: rows },
      nearMisses = ranked.candidates
        .filter((row) => row.status === "REJECTED")
        .sort(
          (a, b) =>
            Number(b.discovery_confidence) - Number(a.discovery_confidence),
        )
        .slice(0, 5),
      exact: Row | undefined = search
        ? ranked.candidates.find(
            (row) => String(row.symbol).toUpperCase() === search,
          )
        : undefined,
      lookup = search
        ? exact
          ? {
              symbol: search,
              scanned: true,
              status:
                exact.status === "REJECTED"
                  ? "REJECTED"
                  : Number(exact.discovery_confidence) < minimumConfidence
                    ? "NEAR_MISS"
                    : "QUALIFIED_CANDIDATE",
              candidate: exact,
              reason: exact.rejected_reason || exact.why_ranked,
              becomesActionable:
                exact.ai_action === "WAIT"
                  ? "Improve technical confirmation or entry attractiveness while account fit remains acceptable."
                  : exact.ai_action === "DO NOT ADD"
                    ? "Reduce account concentration or evaluate this security in a better-fitting account."
                    : "Maintain fresh fundamentals, valuation, technical and portfolio-fit evidence.",
            }
          : {
              symbol: search,
              scanned: false,
              status:
                result.run?.status === "SUCCEEDED"
                  ? "NOT_SCANNED"
                  : "DATA_UNAVAILABLE",
              candidate: null,
              reason:
                result.run?.status === "SUCCEEDED"
                  ? `${search} is not present in the persisted scan batch or discovery ledger.`
                  : "No successful persisted market scan can confirm coverage.",
              becomesActionable:
                "Run or refresh the market-wide scan, then evaluate current provider fundamentals, valuation, technical setup and selected-account fit.",
            }
        : null;
    if(lookup && !exact){const entry=await db.prepare("SELECT stage,error_code,last_screened_at,last_researched_at FROM discovery_queue WHERE symbol=? AND active").bind(search).first<Row>();if(entry){lookup.scanned=Boolean(entry.last_screened_at);lookup.status=entry.stage==='RESEARCH_INCOMPLETE'?'DATA_UNAVAILABLE':entry.stage==='RESEARCHED'?'SCANNED':entry.stage==='RESEARCH_PENDING'?'SCANNED':entry.stage;lookup.reason=entry.error_code||`Screened: ${entry.last_screened_at||"pending"}; deep research: ${entry.last_researched_at||"pending"}`;}}
    return Response.json(
      {
        ...result,
        account: ranked.account,
        candidates: ranked.candidates,
        lookup,
        scan: {
          coverage: await discoveryCoverage(db),
          status: result.run?.status || "NEVER_RUN",
          lastSuccessfulScan: result.lastSuccessfulScan,
          universeSize: Number(result.run?.universe_size || 0),
          companiesEvaluated: Number(result.run?.screened_count || 0),
          candidatesAccepted: Number(result.run?.candidates_created || 0),
          candidatesRejected: Number(result.run?.rejected_count || 0),
          minimumConfidence,
          providerErrors: result.run?.provider_errors_json || [],
          aiAnalysisFailures: Number(result.run?.ai_analysis_failures || 0),
          errorCode: result.run?.error_code || null,
        },
        nearMisses,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("candidate.frontend_api_fetch_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        error: "Candidate discovery API unavailable",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const { db } = await workspace(request);
    const body=await request.json().catch(()=>({})),symbol=String(body.symbol||"").trim().toUpperCase();
    if(symbol&&!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol))return Response.json({error:"Invalid ticker"},{status:400});
    if(symbol&&!await queueDiscoveryRefresh(db,symbol))return Response.json({error:"Ticker is not in the eligible provider directory. Refresh the directory or verify the ticker."},{status:422});
    const bucket = new Date().toISOString().slice(0, 16),
      job = await db
        .prepare(
          "INSERT INTO background_jobs(id,job_type,idempotency_key,payload_json) VALUES(?,'MARKET_DISCOVERY',?,?::jsonb) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id",
        )
        .bind(
          id("job"),
          `manual-discovery:${bucket}`,
          JSON.stringify({
            requestedAt: new Date().toISOString(),
            source: "manual",
          }),
        )
        .first<{ id: string }>();
    console.info("candidate.scan_queued", {
      jobId: job?.id || null,
      bucket,
      source: "manual",
    });
    return Response.json(
      {
        queued: Boolean(job),
        jobId: job?.id || null,
        status: job ? "QUEUED" : "ALREADY_QUEUED",
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("candidate.scan_enqueue_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        error: "Candidate scan could not be queued",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
