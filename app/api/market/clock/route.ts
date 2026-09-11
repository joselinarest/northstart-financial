import{marketDataProvider}from"@/lib/providers/alpaca-market-data";
import{MarketProviderError}from"@/lib/providers/market-data";
export const dynamic = "force-dynamic";

export async function GET() {
  try{const clock=await marketDataProvider().getClock();return Response.json({status:"connected",...clock},{headers:{"Cache-Control":"private, max-age=15"}})}catch(error){const known=error instanceof MarketProviderError;return Response.json({status:known?error.code:"provider_error",error:error instanceof Error?error.message:"Market clock unavailable"},{status:known?error.status:502})}
}
