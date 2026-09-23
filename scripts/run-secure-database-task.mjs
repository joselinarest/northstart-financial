import {execFileSync,spawnSync} from 'node:child_process';
const tasks={migrate:'scripts/run-migrations.mjs',check:'scripts/notification-clear-check.mjs'};
const task=tasks[process.argv[2]];if(!task)throw Error('Choose migrate or check');
const aws=process.env.NORTHSTAR_AWS_CLI||'C:/Users/josel/AppData/Local/Programs/Amazon/AWSCLIV2/aws.exe';
const response=JSON.parse(execFileSync(aws,['secretsmanager','get-secret-value','--secret-id','northstar/production','--region','us-west-2','--output','json','--no-cli-pager'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const values=JSON.parse(response.SecretString);
if(!values.DATABASE_URL)throw Error('DATABASE_URL_MISSING');
const result=spawnSync(process.execPath,[task],{env:{...process.env,DATABASE_URL:values.DATABASE_URL},encoding:'utf8',timeout:120000});
if(result.status!==0){console.error('DATABASE_TASK_FAILED',task,'exit',result.status);process.exitCode=1;}
else console.log(result.stdout);
