import { migrations } from "@/db/migrations";

type MigrationClient = {
  query(text: string, values?: unknown[]): Promise<unknown>;
};

export async function runMigrations(client: MigrationClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const applied = await client.query("SELECT id FROM schema_migrations") as { rows?: Array<{ id: string }> };
  const completed = new Set((applied.rows || []).map((row) => row.id));

  for (const migration of migrations) {
    if (completed.has(migration.id)) continue;
    await client.query("BEGIN");
    try {
      for (const statement of migration.statements) await client.query(statement);
      await client.query(
        "INSERT INTO schema_migrations(id, description) VALUES($1, $2)",
        [migration.id, migration.description],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

