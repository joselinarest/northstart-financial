import type {PostgresDatabase} from './db';
/** Called inside the schedule-save transaction, after locking the goal. */
export async function syncGoalMonthlyContribution(db:PostgresDatabase,goalId:string){
 const total=await db.prepare(`SELECT COALESCE(SUM(amount_cents),0)::text amount FROM child_contribution_schedules WHERE goal_id=? AND active=TRUE`).bind(goalId).first<{amount:string}>();
 const amount=Number(total?.amount||0);
 await db.prepare('UPDATE child_goals SET monthly_contribution_cents=? WHERE id=?').bind(amount,goalId).run();
 // Refresh outstanding reminders, but never rewrite a completed transfer.
 await db.prepare(`UPDATE child_contributions cc SET amount_cents=s.amount_cents,expected_cents=s.amount_cents FROM child_contribution_schedules s WHERE cc.goal_id=? AND s.goal_id=cc.goal_id AND s.account_id=cc.account_id AND s.active=TRUE AND cc.source='TRANSFER' AND cc.status='EXPECTED' AND cc.contribution_date>=date_trunc('month',CURRENT_DATE)::date`).bind(goalId).run();
 return amount;
}
