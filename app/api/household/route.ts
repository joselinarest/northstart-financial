import {workspace} from "@/lib/db";
export async function GET(r:Request){
 try{
  const {db,householdId,role,userId}=await workspace(r);
  const [household,members,invitations,available]=await Promise.all([
   db.prepare("SELECT id,name,base_currency,timezone FROM households WHERE id=?").bind(householdId).first(),
   db.prepare("SELECT hm.user_id,hm.role,hm.status,u.email,u.display_name,(SELECT MAX(hi.accepted_at) FROM household_invitations hi WHERE hi.household_id=hm.household_id AND hi.accepted_by=hm.user_id AND hi.status='accepted') accepted_at FROM household_members hm JOIN users u ON u.id=hm.user_id WHERE hm.household_id=? ORDER BY CASE hm.role WHEN 'owner' THEN 0 WHEN 'co_owner' THEN 1 ELSE 2 END,u.display_name").bind(householdId).all(),
   ["owner","co_owner"].includes(role)?db.prepare("SELECT id,email,role,invitation_type,household_name,status,expires_at,created_at,accepted_at,accepted_by FROM household_invitations WHERE household_id=? AND status='pending' ORDER BY created_at DESC LIMIT 50").bind(householdId).all():Promise.resolve({results:[]}),
   db.prepare("SELECT h.id,h.name,hm.role,CASE WHEN hm.household_id=? THEN 'personal' ELSE 'shared' END workspace_type FROM household_members hm JOIN households h ON h.id=hm.household_id WHERE hm.user_id=? AND hm.status='active' ORDER BY CASE WHEN hm.household_id=? THEN 1 ELSE 0 END,h.name").bind(`household_${userId}`,userId,`household_${userId}`).all(),
  ]);
  return Response.json({household,role,members:members.results,invitations:invitations.results,availableHouseholds:available.results});
 }catch(e){if(e instanceof Response)return e;throw e}
}
