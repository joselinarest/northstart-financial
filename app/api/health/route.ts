import { database } from "@/lib/db";
export const dynamic="force-dynamic";
const tlsVerification=()=>process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase()==="false"?"disabled-by-configuration":"enabled";
export async function GET(){try{const db=await database();const row=await db.prepare("SELECT 1 ok").first<{ok:number}>();return Response.json({ok:Number(row?.ok)===1,database:"AWS PostgreSQL",databaseTlsVerification:tlsVerification(),documents:"PostgreSQL BYTEA",connections:"read-only",release:"40b4d0c"})}catch(error){return Response.json({ok:false,database:"AWS PostgreSQL",databaseTlsVerification:tlsVerification(),release:"40b4d0c",error:error instanceof Error?error.message:"Database unavailable"},{status:503})}}
