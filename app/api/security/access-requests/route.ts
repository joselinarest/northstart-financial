import {requireUser} from "@/lib/auth";

const approverEmails=()=>new Set((process.env.FAMILY_APPROVER_EMAILS||"lisdanay.dm@gmail.com,jose.linaret@gmail.com").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean));
async function approver(request:Request){const user=await requireUser(request);if(!approverEmails().has(user.email.toLowerCase()))throw new Response(JSON.stringify({error:"Family administrator access required"}),{status:403,headers:{"Content-Type":"application/json"}});return user}

export async function GET(request:Request){try{await approver(request);return Response.json({requests:[],invitationOnly:true})}catch(error){if(error instanceof Response)return error;return Response.json({error:"Unable to verify invitation-only access"},{status:500})}}

export async function PATCH(request:Request){try{await approver(request);return Response.json({error:"Direct account approval is disabled. Send a secure invitation for an existing or new household."},{status:410})}catch(error){if(error instanceof Response)return error;return Response.json({error:"Unable to verify invitation-only access"},{status:500})}}
