import type {PostgresDatabase} from '@/lib/db';
// These jobs recompute current state; older pending polls carry no unique event.
// Preserve every row for audit and never coalesce delivery, trade, or provider events.
export const coalesceRefreshSql=`WITH ranked AS (
 SELECT id,row_number() OVER(PARTITION BY job_type,household_id ORDER BY created_at DESC,id DESC) ordinal
 FROM background_jobs WHERE status IN ('QUEUED','FAILED')
 AND job_type IN ('MARKET_INTELLIGENCE','OPTIONS_FLOW','TACTICAL_REENTRY_MONITOR')
) UPDATE background_jobs j SET status='DEAD',error_code='SUPERSEDED_REFRESH',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
FROM ranked r WHERE j.id=r.id AND r.ordinal>1`;
export async function coalesceRefreshJobs(db:PostgresDatabase){return db.prepare(coalesceRefreshSql).run()}
export function reviewSessionDate(value:unknown){if(value instanceof Date&&!Number.isNaN(value.valueOf()))return value.toISOString().slice(0,10);const text=String(value??'');if(/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(text))return text.slice(0,10);throw Error('INVALID_REVIEW_SESSION_DATE')}
