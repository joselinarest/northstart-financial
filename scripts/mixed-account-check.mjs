import assert from 'node:assert/strict';
import {recommendedTradingPolicy,strategyRiskBudget} from '../lib/trading-policy.ts';
const inputs={value:10000,cash:5000,largestPositionBps:1000,liquid:true};
const mixed=recommendedTradingPolicy({...inputs,accountType:'MIXED'});
for(const key of ['swingEnabled','dayTradingEnabled','longTermEnabled','optionsEnabled'])assert.equal(mixed[key],true,key);
for(const style of ['SWING','DAY_TRADE','LONG_TERM']){const result=strategyRiskBudget(mixed,{...inputs,style,openRisk:0,dailyDayLoss:0,weeklyDrawdown:0,dayTrades:0});assert.equal(result.blocked,false);assert(result.tradeRisk>0&&result.tradeRisk<=inputs.value*mixed.combinedRiskBps/10000);assert.equal(strategyRiskBudget(mixed,{...inputs,style,openRisk:0,dailyDayLoss:10000,weeklyDrawdown:0,dayTrades:0}).blocked,true);}
for(const accountType of ['RETIREMENT','CHILD_GROWTH','COLLEGE']){const p=recommendedTradingPolicy({...inputs,accountType});assert.equal(p.optionsEnabled,false);assert.equal(p.dayTradingEnabled,false);}
console.log('PASS: Mixed enables all four strategies; shared risk/loss caps remain enforced; protected account defaults unchanged');
