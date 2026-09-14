import {requireUser} from "@/lib/auth";

export async function GET(request:Request){
 try{const user=await requireUser(request);return Response.json({authenticated:true,email:user.email,name:user.name},{headers:{"Cache-Control":"no-store"}})}catch(error){if(error instanceof Response)return error;return Response.json({authenticated:false},{status:401})}
}
export async function POST(request:Request){
 try{const authorization=request.headers.get("authorization");if(!authorization?.startsWith("Bearer "))return Response.json({error:"Identity token required"},{status:401});const user=await requireUser(request),token=authorization.slice(7),secure=new URL(request.url).protocol==="https:"?"; Secure":"";return Response.json({authenticated:true,email:user.email,name:user.name},{headers:{"Cache-Control":"no-store","Set-Cookie":`northstar_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${secure}`}})}catch(error){if(error instanceof Response)return error;return Response.json({error:"Session could not be established"},{status:401})}
}
export async function DELETE(request:Request){const secure=new URL(request.url).protocol==="https:"?"; Secure":"";return Response.json({ok:true},{headers:{"Set-Cookie":`northstar_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`}})}
