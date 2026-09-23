import type {PostgresDatabase} from '@/lib/db';
/** Durable lease prevents EventBridge retries from running overlapping whole-worker scans. */
export async function claimWorker(db:PostgresDatabase,owner:string){
  return Boolean(await db.prepare("INSERT INTO worker_run_leases(name,owner,expires_at) VALUES('notifications',?,CURRENT_TIMESTAMP+INTERVAL '10 minutes') ON CONFLICT(name) DO UPDATE SET owner=EXCLUDED.owner,expires_at=EXCLUDED.expires_at WHERE worker_run_leases.expires_at<CURRENT_TIMESTAMP RETURNING owner").bind(owner).first());
}
export async function releaseWorker(db:PostgresDatabase,owner:string){
  await db.prepare("DELETE FROM worker_run_leases WHERE name='notifications' AND owner=?").bind(owner).run();
}
