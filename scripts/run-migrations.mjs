import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import pg from "pg";
import ts from "typescript";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const source = await readFile(new URL("../db/migrations.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { migrations } = await import(moduleUrl);
const connectionUrl = new URL(process.env.DATABASE_URL);
for (const parameter of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"])
  connectionUrl.searchParams.delete(parameter);
const certificateResponse = await fetch("https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem");
if (!certificateResponse.ok) throw new Error(`RDS CA download failed: ${certificateResponse.status}`);
const client = new pg.Client({
  connectionString: connectionUrl.toString(),
  ssl: { ca: await certificateResponse.text(), rejectUnauthorized: true },
});

await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(hashtext($1))", ["northstar_schema_init"]);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const applied = await client.query("SELECT id FROM schema_migrations");
  const completed = new Set(applied.rows.map((row) => row.id));
  let appliedCount = 0;
  for (const migration of migrations) {
    if (completed.has(migration.id)) continue;
    await client.query("BEGIN");
    try {
      for (const statement of migration.statements) await client.query(statement);
      await client.query("INSERT INTO schema_migrations(id,description) VALUES($1,$2)", [migration.id, migration.description]);
      await client.query("COMMIT");
      appliedCount++;
      console.log(`Applied ${migration.id}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  const requiredColumn = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='alert_deliveries' AND column_name='available_at'");
  if (!requiredColumn.rowCount) throw new Error("Notification schema verification failed: alert_deliveries.available_at is missing");
  console.log(`Migration check complete: ${appliedCount} applied, ${completed.size + appliedCount} recorded`);
} finally {
  await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["northstar_schema_init"]).catch(() => undefined);
  await client.end();
}
