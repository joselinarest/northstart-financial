import {database} from "@/lib/db";
import {listMarketDiscoveries,runMarketDiscovery} from "@/lib/market-discovery-engine";

export const dynamic="force-dynamic";

const local=(request:Request)=>process.env.NODE_ENV!=="production"&&["localhost","127.0.0.1"].includes(new URL(request.url).hostname);

export async function GET(request:Request){
 if(!local(request))return Response.json({error:"Not found"},{status:404});
 return Response.json(await listMarketDiscoveries(await database()));
}

export async function POST(request:Request){
 if(!local(request))return Response.json({error:"Not found"},{status:404});
 try{return Response.json(await runMarketDiscovery(await database(),{force:true}))}
 catch(error){return Response.json({error:error instanceof Error?error.message:"Market discovery failed"},{status:500})}
}
