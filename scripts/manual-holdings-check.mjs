import {build} from 'esbuild';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
await build({entryPoints:['lib/manual-holdings.ts','lib/db.ts'],outdir:'work/manual-test',bundle:true,platform:'node',format:'esm',packages:'external'});
const {saveManualHolding}=await import('../work/manual-test/manual-holdings.js'),{PostgresDatabase}=await import('../work/manual-test/db.js');
const sql=new PGlite();await sql.exec(`CREATE TABLE entities(id TEXT PRIMARY KEY,household_id TEXT);CREATE TABLE accounts(id TEXT PRIMARY KEY,entity_id TEXT,connection_id TEXT,type TEXT,available_balance_cents BIGINT,current_balance_cents BIGINT,updated_at TIMESTAMPTZ);CREATE TABLE securities(id TEXT PRIMARY KEY,ticker TEXT,name TEXT,type TEXT,currency TEXT,UNIQUE(ticker,type));CREATE TABLE holdings(id TEXT PRIMARY KEY,account_id TEXT,security_id TEXT,quantity NUMERIC,cost_basis_cents BIGINT,price_cents BIGINT,price_at TEXT,acquisition_date TEXT,UNIQUE(account_id,security_id));CREATE TABLE audit_log(id TEXT PRIMARY KEY,household_id TEXT,user_id TEXT,action TEXT,target_type TEXT,target_id TEXT,metadata_json TEXT);INSERT INTO entities VALUES('e','h'),('foreign','other');INSERT INTO accounts(id,entity_id,type,available_balance_cents) VALUES('a','e','investment',10000),('b','foreign','investment',0);`);
const client={query:async(s,v)=>{const r=await sql.query(s,v);return {rows:r.rows,rowCount:r.affectedRows}}};const db=new PostgresDatabase(client),scope={householdId:'h',userId:'u'};
for(const ticker of ['AAA','BBB','CCC'])await saveManualHolding(db,scope,{accountId:'a',ticker,quantity:2,averageCost:8,currentPrice:10});
assert.equal((await sql.query('SELECT COUNT(*)::int n FROM holdings')).rows[0].n,3);assert.equal(Number((await sql.query("SELECT current_balance_cents FROM accounts WHERE id='a'")).rows[0].current_balance_cents),16000);
await assert.rejects(()=>saveManualHolding(db,scope,{accountId:'a',ticker:'AAA',quantity:50}),/already exists/);
await saveManualHolding(db,scope,{accountId:'a',ticker:'AAA',quantity:1,averageCost:5,mode:'MERGE'});
let row=(await sql.query("SELECT * FROM holdings h JOIN securities s ON s.id=h.security_id WHERE s.ticker='AAA'")).rows[0];assert.equal(Number(row.quantity),3);assert.equal(Number(row.cost_basis_cents),2100);assert.equal(row.price_at,null);
await saveManualHolding(new PostgresDatabase(client),scope,{accountId:'a',ticker:'BBB',quantity:4,averageCost:7,acquisitionDate:'2026-09-01',mode:'REPLACE'});
assert.equal((await sql.query("SELECT acquisition_date FROM holdings h JOIN securities s ON s.id=h.security_id WHERE s.ticker='BBB'")).rows[0].acquisition_date,'2026-09-01');
await assert.rejects(()=>saveManualHolding(db,scope,{accountId:'b',ticker:'AAA',quantity:1}),/not found/);
await assert.rejects(()=>saveManualHolding(db,scope,{accountId:'a',ticker:'DDD',quantity:1,acquisitionDate:'2026-02-30'}),/Invalid purchase date/);
await saveManualHolding(db,scope,{accountId:'a',ticker:'CCC',mode:'DELETE'});assert.equal((await sql.query('SELECT COUNT(*)::int n FROM holdings')).rows[0].n,2);
await saveManualHolding(db,scope,{accountId:'a',ticker:'DDD',quantity:1});assert.equal((await sql.query("SELECT price_cents FROM holdings h JOIN securities s ON s.id=h.security_id WHERE s.ticker='DDD'")).rows[0].price_cents,null);
await sql.close();console.log('PASS three persisted holdings, reload read, duplicate rejection, merge basis, edit date, delete, totals, missing-price semantics, household isolation');

