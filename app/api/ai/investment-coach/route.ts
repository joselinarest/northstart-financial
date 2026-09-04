import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const system = `You are Northstar Investment Coach, a read-only financial education and decision-support assistant. Never place trades, move money, guarantee returns, promise wealth, or present missing data as known. Never call a low nominal share price cheap. Separate facts, calculations, assumptions, forecasts, and opinions. Always answer using these headings in this order: Observation, Evidence, Risk, Recommendation, Why, Invalidation, What to monitor, Missing data, Confidence and timestamp. Recommendations require explicit user action. Prefer diversified, risk-aware choices and flag suitability, liquidity, concentration, taxes and conflicts. If current market or fundamental data is not supplied, say that live verification is required.`;

export async function POST(request:Request){
  try{
    await requireUser(request);
    const key=process.env.OPENAI_API_KEY;
    if(!key)return Response.json({status:"not_configured",error:"OpenAI decision coach is not configured. Add OPENAI_API_KEY on the server."},{status:503});
    const body=await request.json() as {question?:string;context?:unknown};
    const question=String(body.question||"").trim();
    if(question.length<8||question.length>6000)return Response.json({error:"Question must be between 8 and 6,000 characters."},{status:400});
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",store:false,instructions:system,input:`User question:\n${question}\n\nVerified application context (may be incomplete):\n${JSON.stringify(body.context||{}).slice(0,10000)}`,max_output_tokens:1400})});
    const data=await response.json() as {output_text?:string;output?:Array<{content?:Array<{type?:string;text?:string}>}>;error?:{message?:string}};
    if(!response.ok)return Response.json({error:data.error?.message||"Decision coach provider returned an error."},{status:502});
    const answer=data.output_text||data.output?.flatMap(item=>item.content||[]).filter(item=>item.type==="output_text").map(item=>item.text).join("\n")||"No analysis was returned.";
    return Response.json({answer,model:process.env.OPENAI_MODEL||"gpt-5.6-luna",asOf:new Date().toISOString(),readOnly:true});
  }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Unable to analyze the decision."},{status:500})}
}
