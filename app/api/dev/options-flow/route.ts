import{database}from"@/lib/db";
import{evaluateOptionsFlow,optionsFlowForSymbol}from"@/lib/options-flow-engine";
export const dynamic="force-dynamic";
const local=(request:Request)=>process.env.NODE_ENV!=="production"&&["localhost","127.0.0.1"].includes(new URL(request.url).hostname);
export async function POST(request:Request){if(!local(request))return Response.json({error:"Not found"},{status:404});try{return Response.json(await evaluateOptionsFlow(await database()))}catch(error){return Response.json({error:error instanceof Error?error.message:"Flow evaluation failed"},{status:500})}}
export async function GET(request:Request){if(!local(request))return Response.json({error:"Not found"},{status:404});const symbol=new URL(request.url).searchParams.get("symbol")||"SPY";return Response.json(await optionsFlowForSymbol(await database(),symbol))}
