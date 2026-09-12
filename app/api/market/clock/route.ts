import{marketDataProvider}from"@/lib/providers/alpaca-market-data";
import{MarketProviderError}from"@/lib/providers/market-data";
import{providerCached}from"@/lib/provider-response-cache";
export const dynamic = "force-dynamic";

export async function GET() {
  try{const clock=await providerCached("market-clock",30_000,()=>marketDataProvider().getClock()),configuration={key:true,secret:true,baseUrl:Boolean(process.env.ALPACA_CLOCK_BASE_URL)};return Response.json({status:"connected",configured:true,configuration,...clock},{headers:{"Cache-Control":"private, max-age=30, stale-while-revalidate=60"}})}catch(error){const known=error instanceof MarketProviderError,configuration={key:Boolean(process.env.ALPACA_API_KEY),secret:Boolean(process.env.ALPACA_API_SECRET),baseUrl:Boolean(process.env.ALPACA_CLOCK_BASE_URL)},configured=configuration.key&&configuration.secret,status=!configured?"not_configured":known&&[401,403].includes(error.status)?"credentials_rejected":known&&error.status===429?"rate_limited":"temporarily_unavailable",httpStatus=!configured?503:known&&error.status===429?503:known&&error.status>=500?503:502;return Response.json({status,configured,configuration,error:error instanceof Error?error.message:"Market clock unavailable",retryable:configured&&status!=="credentials_rejected"},{status:httpStatus,headers:{"Cache-Control":"private, no-store"}})}
}
