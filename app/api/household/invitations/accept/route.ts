import {database,id} from "@/lib/db";
import {requireUser} from "@/lib/auth";
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,"0")).join("");
const canonicalEmail=(value:string)=>{const [rawLocal,rawDomain]=value.trim().toLowerCase().split("@");const domain=rawDomain==="googlemail.com"?"gmail.com":rawDomain;const local=domain==="gmail.com"?rawLocal.split("+")[0].replaceAll(".",""):rawLocal;return `${local}@${domain}`};

export async function POST(request:Request){
 try{
  const user=await requireUser(request),db=await database(),body=await request.json() as {token?:string};
  if(!body.token)return Response.json({error:"Invitation token required"},{status:400});
  await db.prepare("INSERT INTO users(id,email,display_name,last_login_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,last_login_at=CURRENT_TIMESTAMP").bind(user.userId,user.email,user.name).run();
  const invite=await db.prepare("SELECT id,household_id,email,role,invitation_type,household_name,expires_at FROM household_invitations WHERE token_hash=? AND status='pending'").bind(await hash(body.token)).first<{id:string;household_id:string;email:string;role:string;invitation_type:string;household_name:string|null;expires_at:string}>();
  if(!invite)return Response.json({error:"Invitation is invalid, replaced, canceled, or already accepted. Use the newest pending link."},{status:404});
  if(new Date(invite.expires_at)<=new Date()){await db.prepare("UPDATE household_invitations SET status='expired' WHERE id=?").bind(invite.id).run();return Response.json({error:"Invitation expired. Ask an owner to resend it."},{status:410})}
  if(canonicalEmail(invite.email)!==canonicalEmail(user.email))return Response.json({error:`Sign in with the email address that received this invitation. Currently signed in as ${user.email}; invitation is for ${invite.email}.`,signedInEmail:user.email,invitedEmail:invite.email},{status:403});
  const createsHousehold=invite.invitation_type==="create_household",acceptedHouseholdId=createsHousehold?`household_${invite.id}`:invite.household_id,acceptedRole=createsHousehold?"owner":invite.role;
  const statements=[];
  if(createsHousehold){statements.push(db.prepare("INSERT OR IGNORE INTO households(id,name,goal_date) VALUES(?,?,?)").bind(acceptedHouseholdId,invite.household_name||`${user.name}'s Household`,"2036-12-31"));statements.push(db.prepare("INSERT OR IGNORE INTO entities(id,household_id,type,name) VALUES(?,?,?,?)").bind(`entity_${invite.id}_personal`,acceptedHouseholdId,"personal","Personal Finances"))}
  statements.push(
   db.prepare("INSERT INTO household_members(household_id,user_id,role,status) VALUES(?,?,?,'active') ON CONFLICT(household_id,user_id) DO UPDATE SET role=excluded.role,status='active'").bind(acceptedHouseholdId,user.userId,acceptedRole),
   db.prepare("UPDATE household_invitations SET status='accepted',accepted_by=?,accepted_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.userId,invite.id),
   db.prepare("INSERT INTO audit_log(id,household_id,user_id,action,target_type,target_id,metadata_json) VALUES(?,?,?,?,?,?,?)").bind(id("audit"),acceptedHouseholdId,user.userId,"household.invitation.accepted","invitation",invite.id,JSON.stringify({invitationType:invite.invitation_type,sourceHouseholdId:invite.household_id})),
  );
  await db.batch(statements);
  return Response.json({householdId:acceptedHouseholdId,role:acceptedRole,email:user.email,status:"accepted",invitationType:invite.invitation_type});
 }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Invitation could not be accepted"},{status:500})}
}
