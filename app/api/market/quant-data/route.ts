import {workspace} from '@/lib/db';
import {QuantDataProvider,quantDataHealth} from '@/lib/providers/quant-data';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const {db}=await workspace(request),url=new URL(request.url);
 if(url.searchParams.get('health')==='true')return Response.json(await quantDataHealth(db),{headers:{'Cache-Control':'private, no-store'}});
 const symbol=(url.searchParams.get('symbol')||'').toUpperCase();if(!/^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol))return Response.json({error:'Valid ticker required'},{status:400});
 return Response.json(await new QuantDataProvider(db).getEvidence(symbol),{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){if(error instanceof Response)return error;return Response.json({status:'UNAVAILABLE',error:'Flow evidence unavailable; other research providers remain independent.'},{status:503})}}
