import {build} from 'esbuild';
await build({entryPoints:['workers/market-worker.ts'],outfile:'dist/market-worker/index.js',bundle:true,platform:'node',target:'node22',format:'cjs',external:['pg-native'],tsconfig:'tsconfig.json',sourcemap:false,logLevel:'info'});
