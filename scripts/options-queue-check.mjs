import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {currentOptionsResult} from '../lib/options-result-freshness.ts';
const pg=new PGlite();
await pg.exec(`CREATE TABLE entities(id text,household_id text);
CREATE TABLE accounts(id text,entity_id text,hidden int,type text);
CREATE TABLE account_risk_config(account_id text);
CREATE TABLE background_jobs(id text primary key,household_id text,job_type text,idempotency_key text unique,payload_json jsonb,status text default 'QUEUED',attempts int default 0,available_at timestamptz default current_timestamp,created_at timestamptz default current_timestamp,updated_at timestamptz default current_timestamp,locked_at timestamptz);
INSERT INTO entities VALUES('e','h'); INSERT INTO accounts VALUES('active','e',0,'investment'),('hidden','e',1,'investment'); INSERT INTO account_risk_config VALUES('active'),('hidden');`);
const discovery=readFileSync('lib/options-discovery.ts','utf8');
const sql=discovery.match(/db.prepare\(`(INSERT INTO background_jobs[\s\S]*?)`\)/)[1];
const bind=s=>{let i=0;return s.replace(/\?/g,()=>'$'+(++i));};
await pg.query(bind(sql),['test','key','CIEN','CIEN']);
await pg.query(bind(sql),['second','second','CIEN','CIEN']);
assert.deepEqual((await pg.query('SELECT payload_json FROM background_jobs')).rows,[{payload_json:{accountId:'active',symbol:'CIEN'}}]);
await pg.exec("INSERT INTO background_jobs(id,job_type) VALUES('ai','AI_EVENT_REVIEW'),('discovery','MARKET_DISCOVERY')");
const worker=readFileSync('lib/notification-worker.ts','utf8');
const claim=worker.match(/db.prepare\(`(WITH claimable AS[\s\S]*?RETURNING j\.\*)`\)/)[1];
assert.equal((await pg.query(bind(claim),[true,'OPTIONS_ACCOUNT_REVIEW','OPTIONS_ACCOUNT_REVIEW'])).rows[0].id,'testactive');
assert.equal((await pg.query(bind(claim),[true,'MARKET_DISCOVERY','MARKET_DISCOVERY'])).rows[0].id,'discovery');
assert.equal((await pg.query(bind(claim),[false,'MARKET_DISCOVERY','MARKET_DISCOVERY'])).rows[0].id,'ai');
const fresh={asOf:new Date().toISOString(),contract:{symbol:'CIEN'},decision:{action:'BUY_NOW'}};
assert.equal(currentOptionsResult(fresh),fresh);
for(const asOf of [null,'invalid',new Date(Date.now()-121000).toISOString(),new Date(Date.now()+10000).toISOString()]){
 const stale=currentOptionsResult({...fresh,asOf});assert.equal(stale.contract,fresh.contract);assert.equal(stale.executionReady,false);assert.equal(stale.decision.action,'WAIT');assert.equal(stale.decision.shares,0);
}
await pg.close();console.log('PASS: production queue SQL, account exclusion, deduplication, fair atomic claims and stale/future option entry blocking.');
