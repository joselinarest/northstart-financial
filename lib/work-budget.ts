import {AsyncLocalStorage} from 'node:async_hooks';
const deadlines=new AsyncLocalStorage<number>();
export class WorkBudgetExceeded extends Error{constructor(){super('WORK_BUDGET_EXCEEDED');}}
export function remainingWorkMs(){return Math.max(0,(deadlines.getStore()??Infinity)-Date.now());}
export function checkWorkBudget(){if(remainingWorkMs()<=0)throw new WorkBudgetExceeded();}
export function providerSignal(timeoutMs:number){checkWorkBudget();return AbortSignal.timeout(Math.max(1,Math.floor(Math.min(timeoutMs,remainingWorkMs()))));}
export function withWorkBudget<T>(milliseconds:number,work:()=>Promise<T>){return deadlines.run(Date.now()+milliseconds,work);}
