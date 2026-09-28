import {classifyHolding,strategyTarget,type AllocationCategory} from '@/lib/domain/portfolio';
import type {StrategyType} from '@/lib/domain/investment-accounts';

export const isLongTermStrategy=(strategy:string)=>!/SWING|MIXED|OPTIONS|DAY_TRADE/.test(strategy);
export function strategyResearchScore(strategy:string,row:Record<string,any>){
 const seed=row.seed_json?.seed||{},m=seed.metrics||{};
 if(strategy==='OPTIONS')return Number(seed.buckets?.oversold||0)*.2+Number(seed.buckets?.swing||0)*.2+Math.min(30,Math.abs(Number(m.dayChange||0))*4)+Math.min(30,Number(m.relativeVolume||0)*10);
 if(isLongTermStrategy(strategy))return Number(seed.buckets?.quiet||0)*.3+Number(row.business_quality||0)*.4+Number(row.valuation||0)*.3;
 return Number(seed.buckets?.swing||seed.seed||0)*.5+Math.min(40,Number(m.relativeVolume||0)*10)+Math.min(20,Math.abs(Number(m.dayChange||0))*2);
}
/** Allocation capacity, not a buy authorization. Long-term contributions are not
 * sized from a swing ATR stop. Quality, valuation and fresh evidence still gate entry. */
export function longTermCapacity(input:{strategy:string;value:number;cash:number;positionRoom:number;price:number;name:string;symbol:string;fractional:boolean;targets:Partial<Record<AllocationCategory,number>>;holdings:Record<string,any>[]}){
 const target=strategyTarget(input.strategy as StrategyType,Object.keys(input.targets).length?input.targets:undefined);
 const category=classifyHolding({name:input.name,ticker:input.symbol});
 const current=input.holdings.filter(h=>classifyHolding({name:h.name,ticker:h.symbol,securityType:h.type})===category).reduce((sum,h)=>sum+Number(h.value||0),0);
 const gap=input.value*target[category]/10000-current;
 const budget=Math.max(0,Math.min(input.cash,input.positionRoom,gap)),scale=input.fractional?10000:1;
 return {category,targetBps:target[category],currentValue:current,gap,capacity:budget,shares:input.price>0?Math.floor(budget/input.price*scale)/scale:0,basis:'Target allocation gap, current holdings, available cash and position limit; subject to independent valuation/thesis confirmation'};
}
