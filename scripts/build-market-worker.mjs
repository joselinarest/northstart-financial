import {execFileSync} from 'node:child_process';
const commit=process.env.AWS_COMMIT_ID||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
import {build} from 'esbuild';
await build({define:{'process.env.NORTHSTAR_WORKER_COMMIT':JSON.stringify(commit)},entryPoints:['workers/market-worker.ts'],outfile:'dist/market-worker/index.js',bundle:true,platform:'node',target:'node22',format:'cjs',external:['pg-native'],tsconfig:'tsconfig.json',sourcemap:false,logLevel:'info'});
