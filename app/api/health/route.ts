import { database } from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(){try{const db=await database();const row=await db.prepare("SELECT 1 ok").first<{ok:number}>();return Response.json({ok:Number(row?.ok)===1,database:"AWS PostgreSQL",databaseTlsVerification:"AWS RDS CA bundle",documents:"PostgreSQL BYTEA",connections:"read-only",release:"rds-ca"})}catch(error){return Response.json({ok:false,database:"AWS PostgreSQL",databaseTlsVerification:"AWS RDS CA bundle",release:"rds-ca",error:error instanceof Error?error.message:"Database unavailable"},{status:503})}}
