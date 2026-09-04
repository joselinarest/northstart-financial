import {id,roleCanManageMembers,workspace} from "@/lib/db";

export async function DELETE(request:Request){
 try{
  const {db,householdId,userId,role}=await workspace(request);
  if(!roleCanManageMembers(role))return Response.json({error:"Only an owner or co-owner can remove household members"},{status:403});
  const {memberUserId}=await request.json() as {memberUserId?:string};
  if(!memberUserId)return Response.json({error:"memberUserId is required"},{status:400});
  if(memberUserId===userId)return Response.json({error:"You cannot remove your own active access"},{status:400});
  const member=await db.prepare("SELECT role FROM household_members WHERE household_id=? AND user_id=? AND status='active'").bind(householdId,memberUserId).first<{role:string}>();
  if(!member)return Response.json({error:"Active household member not found"},{status:404});
  if(member.role==="owner")return Response.json({error:"The original household owner cannot be removed"},{status:403});
  await db.batch([
   db.prepare("UPDATE household_members SET status='removed' WHERE household_id=? AND user_id=?").bind(householdId,memberUserId),
   db.prepare("INSERT INTO audit_log(id,household_id,user_id,action,target_type,target_id,metadata_json) VALUES(?,?,?,?,?,?,?)").bind(id("audit"),householdId,userId,"household.member.removed","user",memberUserId,JSON.stringify({previousRole:member.role})),
  ]);
  return Response.json({status:"removed",userId:memberUserId});
 }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Household member could not be removed"},{status:500})}
}
