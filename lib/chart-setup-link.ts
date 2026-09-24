export type ChartSetup={symbol:string;accountId:string;trigger:number;high:number;pullback:number;stop:number;target1:number;target2:number};
export function chartSetupLink(setup:ChartSetup){
 const query=new URLSearchParams({symbol:setup.symbol,accountId:setup.accountId,timeframe:'5m',view:'validation'});
 for(const key of ['trigger','high','pullback','stop','target1','target2'] as const)if(Number.isFinite(setup[key])&&setup[key]>0)query.set(key,setup[key].toFixed(2));
 return `/workspace/charts?${query.toString()}#market-charts`;
}
export function readChartSetup(search:string):ChartSetup|null{
 const q=new URLSearchParams(search),symbol=(q.get('symbol')||'').toUpperCase();
 if(q.get('view')!=='validation'||!/^[A-Z0-9.\-]{1,15}$/.test(symbol))return null;
 const price=(key:string)=>{const value=Number(q.get(key));return Number.isFinite(value)&&value>0&&value<1e8?value:0};
 return {symbol,accountId:q.get('accountId')||'',trigger:price('trigger'),high:price('high'),pullback:price('pullback'),stop:price('stop'),target1:price('target1'),target2:price('target2')};
}
