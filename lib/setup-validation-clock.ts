type Bar={time:string;close:number;low:number;volume:number};
export function setupValidationClock(bars:Bar[],trigger:number,stop:number,feed:string,now:number){
 const complete=bars.filter(b=>Date.parse(b.time)+300000<=now).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)),last=complete.at(-1);
 const closeAt=last?Date.parse(last.time)+300000:NaN,age=now-closeAt;
 const prior=complete.slice(-21,-1),baseline=prior.length===20?prior.reduce((s,b)=>s+b.volume,0)/20:0,rvol=last&&baseline>0?last.volume/baseline:null;
 const fresh=Number.isFinite(age)&&age>=0&&age<=360000&&!/delayed|indicative/i.test(feed);
 const state=!last?'WAITING FOR DATA':!fresh?'STALE — CANNOT VALIDATE':stop>0&&last.low<=stop?'INVALIDATION OBSERVED':trigger>0&&last.close>trigger&&rvol!==null&&rvol>=1.5?'PRICE / VOLUME PASSED — OTHER CHECKS REQUIRED':'WAITING FOR CONFIRMATION';
 return {state,closeAt:Number.isFinite(closeAt)?closeAt:null,rvol,fresh,secondsToClose:fresh?Math.ceil((300000-now%300000)/1000):null};
}
