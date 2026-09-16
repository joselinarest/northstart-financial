import{workspace}from"@/lib/db";
import{evaluateOptionsFlow,optionsFlowForSymbol}from"@/lib/options-flow-engine";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const{db}=await workspace(request),symbol=(new URL(request.url).searchParams.get("symbol")||"").toUpperCase();if(!/^[A-Z0-9.-]{1,12}$/.test(symbol))return Response.json({error:"Valid symbol required"},{status:400});return Response.json(await optionsFlowForSymbol(db,symbol),{headers:{"Cache-Control":"private, no-store"}})}catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Flow intelligence unavailable"},{status:500})}}
export async function POST(request:Request){try{const{db}=await workspace(request);return Response.json(await evaluateOptionsFlow(db))}catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Flow evaluation failed"},{status:500})}}
