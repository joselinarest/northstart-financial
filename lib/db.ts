import pg from "pg";
import { schemaStatements } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {loadRuntimeSecrets} from "@/lib/runtime-secrets";

const { Pool } = pg;
type QueryResult = { rows: Array<Record<string, unknown>>; rowCount: number | null };
const globalDatabase = globalThis as typeof globalThis & { northstarPool?: InstanceType<typeof Pool>; northstarSchemaReady?: Promise<void>; northstarSchemaVersion?: number };
const schemaVersion=6;

function pool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required. Configure the AWS PostgreSQL connection before using financial data.");
  if (!globalDatabase.northstarPool) {
    const local = /(?:localhost|127\.0\.0\.1)/.test(connectionString);
    const connectionUrl = new URL(connectionString);
    connectionUrl.searchParams.delete("sslmode");
    connectionUrl.searchParams.delete("uselibpqcompat");
    const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase() !== "false";
    globalDatabase.northstarPool = new Pool({ connectionString: connectionUrl.toString(), max: Number(process.env.DATABASE_POOL_MAX || 10), idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000, ssl: local || process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized } });
  }
  return globalDatabase.northstarPool;
}

function postgresSql(source: string) {
  let index = 0, sql = source.replace(/\?/g, () => `$${++index}`);
  if (/^\s*INSERT\s+OR\s+IGNORE\s+/i.test(sql)) { sql = sql.replace(/^\s*INSERT\s+OR\s+IGNORE\s+/i, "INSERT "); sql = `${sql} ON CONFLICT DO NOTHING`; }
  return sql;
}

export class DbStatement {
  values: unknown[] = [];
  constructor(public sql: string, private client: { query(text: string, values?: unknown[]): Promise<QueryResult> } = pool()) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async execute() { return this.client.query(postgresSql(this.sql), this.values); }
  async all<T = Record<string, unknown>>() { const result = await this.execute(); return { results: result.rows as T[] }; }
  async first<T = Record<string, unknown>>() { const result = await this.execute(); return (result.rows[0] as T | undefined) || null; }
  async run() { const result = await this.execute(); return { success: true, meta: { changes: result.rowCount || 0 } }; }
}

export class PostgresDatabase {
  prepare(sql: string) { return new DbStatement(sql); }
  async batch(statements: DbStatement[]) {
    const client = await pool().connect();
    try {
      await client.query("BEGIN"); const output = [];
      for (const statement of statements) { const result = await new DbStatement(statement.sql, client).bind(...statement.values).execute(); output.push({ results: result.rows, success: true, meta: { changes: result.rowCount || 0 } }); }
      await client.query("COMMIT"); return output;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}

export async function database() {
  await loadRuntimeSecrets();
  if (!globalDatabase.northstarSchemaReady||globalDatabase.northstarSchemaVersion!==schemaVersion) globalDatabase.northstarSchemaReady = (async () => {const client=await pool().connect();try{await client.query("SELECT pg_advisory_lock(hashtext($1))",["northstar_schema_init"]);for(const statement of schemaStatements)await client.query(postgresSql(statement));globalDatabase.northstarSchemaVersion=schemaVersion}finally{await client.query("SELECT pg_advisory_unlock(hashtext($1))",["northstar_schema_init"]).catch(()=>undefined);client.release()}})();
  await globalDatabase.northstarSchemaReady; return new PostgresDatabase();
}

export const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
export const roleCanWrite = (role: string) => ["owner", "co_owner", "manager", "investment_manager", "member", "accountant"].includes(role);
export const roleCanManageMembers = (role: string) => ["owner","co_owner"].includes(role);
export const roleCanConnectAccounts = (role:string) => ["owner","co_owner","manager","account_connector"].includes(role);

export async function workspace(request: Request) {
  const user = await requireUser(request), db = await database(), personalHouseholdId = `household_${user.userId}`, personalEntityId = `entity_${user.userId}_personal`;
  await db.prepare("INSERT INTO users(id,email,display_name,last_login_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,last_login_at=CURRENT_TIMESTAMP").bind(user.userId,user.email,user.name).run();
  const existingMembership=await db.prepare("SELECT household_id FROM household_members WHERE user_id=? AND status='active' LIMIT 1").bind(user.userId).first();
  const approvers=(process.env.FAMILY_APPROVER_EMAILS||"lisdanay.dm@gmail.com,jose.linaret@gmail.com").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean),isApprover=approvers.includes(user.email.toLowerCase())||(user.userId==="local_owner"&&process.env.ALLOW_LOCAL_DEV_AUTH==="true"),requestRow=await db.prepare("SELECT id,status FROM family_access_requests WHERE user_id=?").bind(user.userId).first<{id:string;status:string}>();
  if(!existingMembership&&!isApprover&&requestRow?.status!=="approved"){
    if(!requestRow){const requestId=id("access"),escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));await db.prepare("INSERT INTO family_access_requests(id,user_id,email,display_name,status) VALUES(?,?,?,?,'pending') ON CONFLICT(user_id) DO NOTHING").bind(requestId,user.userId,user.email,user.name).run();if(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM){await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.EMAIL_FROM,to:approvers,subject:"Northstar family access approval required",html:`<p><strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}) requested a new Northstar account.</p><p>Sign in to Northstar Settings to approve or deny access. No financial data is available while this request is pending.</p>`})}).catch(()=>undefined)}}
    throw new Response(JSON.stringify({error:requestRow?.status==="denied"?"Family access was denied. Contact a Northstar family administrator.":"Account approval is pending. Family administrators have been notified; no financial data is accessible."}),{status:403,headers:{"Content-Type":"application/json"}});
  }
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO households(id,name,goal_date) VALUES(?,?,?)").bind(personalHouseholdId,"My Household","2036-12-31"),
    db.prepare("INSERT OR IGNORE INTO household_members(household_id,user_id,role) VALUES(?,?,?)").bind(personalHouseholdId,user.userId,"owner"),
    db.prepare("INSERT OR IGNORE INTO entities(id,household_id,type,name) VALUES(?,?,?,?)").bind(personalEntityId,personalHouseholdId,"personal","Personal Finances"),
  ]);
  const requested = request.headers.get("x-household-id");
  let membership = requested ? await db.prepare("SELECT household_id,role FROM household_members WHERE household_id=? AND user_id=? AND status='active'").bind(requested,user.userId).first<{household_id:string;role:string}>() : null;
  if (requested && !membership) throw new Response(JSON.stringify({error:"You do not have access to this household"}),{status:403,headers:{"Content-Type":"application/json"}});
  if (!membership) membership = await db.prepare("SELECT household_id,role FROM household_members WHERE user_id=? AND status='active' ORDER BY CASE WHEN household_id=? THEN 1 ELSE 0 END, CASE role WHEN 'owner' THEN 0 WHEN 'co_owner' THEN 1 ELSE 2 END, household_id LIMIT 1").bind(user.userId,personalHouseholdId).first<{household_id:string;role:string}>();
  const householdId = membership?.household_id || personalHouseholdId;
  const requestPath=new URL(request.url).pathname,studentAllowed=requestPath==="/api/household"||requestPath.startsWith("/api/learning")||requestPath.startsWith("/api/documents")||requestPath.startsWith("/api/paper-trades");
  if(membership?.role==="student"&&!studentAllowed)throw new Response(JSON.stringify({error:"Student accounts are limited to Northstar Academy and educational simulation"}),{status:403,headers:{"Content-Type":"application/json"}});
  const mutation=!['GET','HEAD','OPTIONS'].includes(request.method.toUpperCase());
  if(mutation&&['observer','viewer'].includes(membership?.role||''))throw new Response(JSON.stringify({error:"Your household role is read-only"}),{status:403,headers:{"Content-Type":"application/json"}});
  if(mutation&&membership?.role==='student'&&!requestPath.startsWith('/api/paper-trades'))throw new Response(JSON.stringify({error:"Student accounts may only save Academy and simulation activity"}),{status:403,headers:{"Content-Type":"application/json"}});
  if(mutation&&membership?.role==='account_connector'&&!requestPath.startsWith('/api/connections/plaid'))throw new Response(JSON.stringify({error:"Account connectors may only link and synchronize their own financial institutions"}),{status:403,headers:{"Content-Type":"application/json"}});
  const entity = await db.prepare("SELECT id FROM entities WHERE household_id=? ORDER BY CASE type WHEN 'personal' THEN 0 ELSE 1 END,id LIMIT 1").bind(householdId).first<{id:string}>();
  return { db, householdId, entityId: entity?.id || personalEntityId, role: membership?.role || "owner", ...user };
}
