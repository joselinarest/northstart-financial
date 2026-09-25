/** Deliberate operator release; never invoked by a worker or automatic retraining. */
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import pg from 'pg';
const model=process.env.OPENAI_MODEL,version=process.env.NORTHSTAR_RELEASE_VERSION;
if(!model||!version||!process.env.DATABASE_URL||!process.env.OPENAI_API_KEY)throw Error('Explicit model, release version, database and provider configuration required.');
const checks=['scripts/trade-lifecycle-check.mjs','scripts/trade-lifecycle-integration-check.mjs','scripts/options-queue-check.mjs'];
for(const script of checks)execFileSync(process.execPath,[script],{stdio:'inherit'});
const temp=mkdtempSync(join(tmpdir(),'northstar-model-check-'));
let probe;
try{
 const outfile=join(temp,'provider.cjs');await build({entryPoints:['lib/ai-provider.ts'],outfile,bundle:true,platform:'node',format:'cjs',tsconfig:'tsconfig.json'});
 const {OpenAIProvider,validateAIReasoning}=await import(pathToFileURL(outfile).href);
 const request={model,snapshotId:'release-validation',schemaVersion:'decision-reasoning-1',candidateIds:['hold'],evidenceIds:['technical','fundamentals'],snapshot:{synthetic:true,technical:{trend:'sideways'},fundamentals:{thesis:'intact'},candidates:[{id:'hold',action:'HOLD',instrument:'SHARES',eligible:true,reason:'No confirmed entry or exit.'}]}};
 const started=Date.now(),response=await new OpenAIProvider(process.env.OPENAI_API_KEY).analyze(request);validateAIReasoning(response.output,request);
 probe={requestId:response.requestId,latencyMs:Date.now()-started,model,checks,passedAt:new Date().toISOString(),scope:'Functional safety and provider schema validation; investment performance is not validated.'};
}finally{rmSync(join(temp,'provider.cjs'),{force:true});rmdirSync(temp);}
console.log(JSON.stringify({probe,activate:process.argv.includes('--activate')}));
if(!process.argv.includes('--activate'))process.exit(0);
const url=new URL(process.env.DATABASE_URL);for(const k of ['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(k);
const response=await fetch('https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem');if(!response.ok)throw Error('RDS CA unavailable');
const db=new pg.Client({connectionString:url.toString(),ssl:{ca:await response.text(),rejectUnauthorized:true}});await db.connect();
try{await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtext('northstar_model_release'))");
 const existing=await db.query('SELECT prompt_hash,provider_model FROM ai_model_versions WHERE version=$1',[version]);
 const requestedHash=createHash('sha256').update(readFileSync('lib/ai-provider.ts')).digest('hex');
 if(existing.rows.some(row=>row.prompt_hash!==requestedHash||row.provider_model!==model))throw Error('Release versions are immutable; choose a new version for a changed prompt or model');
 const policy=await db.query("UPDATE ai_strategy_versions SET status='APPROVED',approved_at=CURRENT_TIMESTAMP WHERE version='lifecycle-1.0.0' RETURNING version");if(!policy.rowCount)throw Error('Expected tested strategy version is missing');
 const hash=createHash('sha256').update(readFileSync('lib/ai-provider.ts')).digest('hex');
 for(const strategy of ['SWING_SHARES','LONG_TERM_SHARES','OPTIONS']){
  await db.query("UPDATE ai_model_versions SET status='RETIRED' WHERE strategy=$1 AND status='CHAMPION' AND version<>$2",[strategy,version]);
  await db.query(`INSERT INTO ai_model_versions(version,strategy,status,provider,prompt_hash,strategy_version,provider_model,validation_results_json,safety_gates_json,calibration_factor,released_at) VALUES($1,$2,'CHAMPION','OPENAI',$3,'lifecycle-1.0.0',$4,$5::jsonb,$6::jsonb,0.85,CURRENT_TIMESTAMP) ON CONFLICT(version,strategy) DO UPDATE SET status='CHAMPION',validation_results_json=EXCLUDED.validation_results_json,released_at=CURRENT_TIMESTAMP`,[version,strategy,hash,model,JSON.stringify(probe),JSON.stringify({executionAllowed:false,deterministicCandidatesOnly:true,missingDataBlocks:true,automaticRetraining:false,performanceValidated:false})]);
 }
 await db.query('COMMIT');console.log(JSON.stringify({released:version,model,strategies:['SWING_SHARES','LONG_TERM_SHARES','OPTIONS']}));
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}
