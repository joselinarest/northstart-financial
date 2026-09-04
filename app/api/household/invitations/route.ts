import {workspace,id,roleCanManageMembers} from "@/lib/db";
const roles=["co_owner","manager","investment_manager","member","observer","account_connector","student","viewer","accountant"];
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,"0")).join("");

export async function POST(request:Request){
 try{
  const {db,householdId,userId,role}=await workspace(request);
  if(!roleCanManageMembers(role))return Response.json({error:"Only an owner or co-owner can invite members"},{status:403});
  const body=await request.json() as {email?:string;role?:string},email=String(body.email||"").trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email)||!roles.includes(String(body.role)))return Response.json({error:"A valid email and role are required"},{status:400});
  const token=crypto.randomUUID()+crypto.randomUUID(),inviteId=id("invite"),expires=new Date(Date.now()+7*86400000).toISOString();
  await db.batch([
   db.prepare("UPDATE household_invitations SET status='revoked' WHERE household_id=? AND email=? AND status='pending'").bind(householdId,email),
   db.prepare("INSERT INTO household_invitations(id,household_id,email,role,token_hash,invited_by,expires_at) VALUES(?,?,?,?,?,?,?)").bind(inviteId,householdId,email,body.role,await hash(token),userId,expires),
   db.prepare("INSERT INTO audit_log(id,household_id,user_id,action,target_type,target_id,metadata_json) VALUES(?,?,?,?,?,?,?)").bind(id("audit"),householdId,userId,"household.invitation.created","invitation",inviteId,JSON.stringify({email,role:body.role})),
  ]);
  const base=process.env.APP_URL||new URL(request.url).origin,acceptUrl=`${base}/workspace/household?invite=${encodeURIComponent(token)}`;
  let delivered=false;
  if(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM){
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[email],subject:"You are invited to a Northstar household",html:`<p>You were invited as <strong>${String(body.role).replaceAll("_"," ")}</strong>.</p><p><a href="${acceptUrl}">Accept secure invitation</a></p><p>This invitation expires in 7 days. Northstar cannot move money or execute trades.</p>`})});
   delivered=response.ok;
   if(!response.ok){const detail=await response.text();return Response.json({error:`Invitation saved, but email delivery failed (${response.status})`,providerDetail:detail.slice(0,160),acceptUrl},{status:502})}
  }
  return Response.json({id:inviteId,status:"pending",delivered,acceptUrl:delivered?undefined:acceptUrl,expiresAt:expires},{status:201});
 }catch(error){
  if(error instanceof Response)return error;
  console.error("Invitation creation failed",error);
  return Response.json({error:error instanceof Error?error.message:"Invitation could not be created"},{status:500});
 }
}

export async function DELETE(request:Request){
 try{
  const {db,householdId,userId,role}=await workspace(request);
  if(!roleCanManageMembers(role))return Response.json({error:"Only an owner or co-owner can cancel invitations"},{status:403});
  const {invitationId}=await request.json() as {invitationId?:string};
  if(!invitationId)return Response.json({error:"invitationId is required"},{status:400});
  const invitation=await db.prepare("SELECT id FROM household_invitations WHERE id=? AND household_id=? AND status='pending'").bind(invitationId,householdId).first();
  if(!invitation)return Response.json({error:"Pending invitation not found"},{status:404});
  await db.batch([
   db.prepare("UPDATE household_invitations SET status='revoked' WHERE id=? AND household_id=?").bind(invitationId,householdId),
   db.prepare("INSERT INTO audit_log(id,household_id,user_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)").bind(id("audit"),householdId,userId,"household.invitation.revoked","invitation",invitationId),
  ]);
  return Response.json({status:"revoked",id:invitationId});
 }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Invitation could not be canceled"},{status:500})}
}
