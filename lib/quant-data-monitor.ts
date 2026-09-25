import {createHash} from 'node:crypto';
import {id,type PostgresDatabase} from './db';
import {QuantDataProvider} from './providers/quant-data';
export async function scheduleQuantFlow(db:PostgresDatabase,bucket:string){
 if(!process.env.QUANT_DATA_API_KEY)return;
 const tickers=(await db.prepare("SELECT DISTINCT s.ticker FROM holdings h JOIN securities s ON s.id=h.security_id JOIN accounts a ON a.id=h.account_id WHERE a.hidden=0 AND h.quantity>0 AND s.ticker IS NOT NULL").all<{ticker:string}>()).results;
 for(const {ticker} of tickers)await db.prepare("INSERT INTO background_jobs(id,job_type,idempotency_key,payload_json) SELECT ?,'QUANT_FLOW',?,? WHERE NOT EXISTS(SELECT 1 FROM background_jobs WHERE job_type='QUANT_FLOW' AND payload_json->>'symbol'=? AND status IN ('QUEUED','RUNNING','FAILED')) ON CONFLICT(idempotency_key) DO NOTHING").bind(id('job'),'quant-flow:'+ticker+':'+bucket,JSON.stringify({symbol:ticker}),ticker).run();
}
export async function monitorQuantFlow(db:PostgresDatabase,symbol:string){
 const flow=await new QuantDataProvider(db).getEvidence(symbol);
 const material=flow.prints.filter(p=>p.time&&p.premium!==null&&p.premium>=100000&&p.conviction!==null&&p.conviction>=60);
 if(!material.length)return;
 const accounts=(await db.prepare("SELECT DISTINCT a.id,e.household_id FROM holdings h JOIN securities s ON s.id=h.security_id JOIN accounts a ON a.id=h.account_id JOIN entities e ON e.id=a.entity_id WHERE s.ticker=? AND a.hidden=0 AND h.quantity>0").bind(symbol).all<{id:string;household_id:string}>()).results;
 for(const account of accounts){
 // One event per provider print/account. Existing notification indexing enforces channel preferences.
 for(const print of material){const key=createHash('sha256').update(account.id+':quant:'+print.id).digest('hex');
 await db.transaction(async tx=>{
 const inserted=await tx.prepare("INSERT INTO alerts(id,household_id,severity,type,title,explanation,evidence_json) VALUES(?,?,'important','market_intelligence',?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id").bind('quant_'+key,account.household_id,symbol+' · notable options flow',print.kind+' at '+print.execution+'; review the thesis before acting. Flow alone is not an order.',JSON.stringify({accountId:account.id,symbol,eventClass:'THESIS_CHANGE',provider:'Quant Data',sourceAsOf:print.time,print,flowSnapshot:flow,canAuthorizeTrade:false})).first();
 if(inserted)await tx.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,'AI_EVENT_REVIEW',?,?) ON CONFLICT(idempotency_key) DO NOTHING").bind(id('job'),account.household_id,'quant-review:'+key,JSON.stringify({accountId:account.id,symbol,eventId:'quant_'+key})).run();
 });
 }
 }
}
