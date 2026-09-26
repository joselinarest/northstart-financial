export type TradeStyle="SWING"|"DAY_TRADE"|"LONG_TERM";
export type TradingPolicy={version:"risk-1";label:"RECOMMENDED DEFAULTS"|"CUSTOM";swingEnabled:boolean;dayTradingEnabled:boolean;longTermEnabled:boolean;optionsEnabled:boolean;swingRiskBps:number;dayRiskBps:number;combinedRiskBps:number;maxPositionBps:number;maxSectorBps:number;dailyLossBps:number;weeklyDrawdownBps:number;maxDayTrades:number;optionsRiskBps:number;cashReserveBps:number;fridaySwing:"BLOCK"|"VERY_STRONG_ONLY";fridayConfidence:number;minimumConfidence:number;minimumRewardRisk:number;requireConfirmation:true;extendedHours:false;maxSwingDays:number;maxDayMinutes:number};
export function recommendedTradingPolicy(input:{accountType:string;value:number;cash:number;largestPositionBps:number;liquid:boolean;volatilityPct?:number;maxDrawdownBps?:number}):TradingPolicy{
  const mixed=/MIXED/i.test(input.accountType),swing=/SWING/i.test(input.accountType)||mixed,protectedAccount=/RETIRE|CHILD|COLLEGE|EDUCATION|HOUSE PURCHASE|FUTURE WEALTH|PRESERVATION/i.test(input.accountType),constrained=!input.liquid||input.value<=0||input.cash/input.value<.1||input.largestPositionBps>2500;
  const multiplier=input.volatilityPct==null?.75:input.volatilityPct>=5?.5:input.volatilityPct>=3?.75:1;
  const drawdown=Math.min(protectedAccount?150:constrained?150:300,input.maxDrawdownBps??10000);
  const risk=Math.min(Math.floor((protectedAccount?15:constrained?25:50)*multiplier),Math.floor(drawdown/6));
  return {version:"risk-1",label:"RECOMMENDED DEFAULTS",swingEnabled:swing,dayTradingEnabled:mixed,longTermEnabled:!swing,optionsEnabled:mixed||/^OPTIONS/i.test(input.accountType),swingRiskBps:risk,dayRiskBps:Math.min(risk,constrained?10:20),combinedRiskBps:Math.min(drawdown,protectedAccount?100:constrained?100:200),maxPositionBps:protectedAccount?800:constrained?1000:1500,maxSectorBps:protectedAccount?2000:2500,dailyLossBps:Math.min(drawdown,constrained?50:100),weeklyDrawdownBps:drawdown,maxDayTrades:constrained?1:3,optionsRiskBps:protectedAccount?0:Math.min(25,risk),cashReserveBps:protectedAccount?1000:constrained?2000:1000,fridaySwing:"VERY_STRONG_ONLY",fridayConfidence:90,minimumConfidence:75,minimumRewardRisk:2,requireConfirmation:true,extendedHours:false,maxSwingDays:14,maxDayMinutes:360};
}
export function validateTradingPolicy(value:unknown,recommended:TradingPolicy,capabilities:{intraday:boolean;options:boolean},acceptHigherRisk=false):TradingPolicy{
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Trading policy must be an object");
  const raw=value as Record<string,unknown>;if(Object.keys(raw).some(k=>!(k in recommended)))throw Error("Unknown trading policy setting");
  const p={...recommended,...raw,label:"CUSTOM",version:"risk-1"} as TradingPolicy;
  for(const key of ["swingEnabled","dayTradingEnabled","longTermEnabled","optionsEnabled"] as const)if(typeof p[key]!=="boolean")throw Error("Invalid toggle: "+key);
  for(const key of ["swingRiskBps","dayRiskBps","combinedRiskBps","maxPositionBps","maxSectorBps","dailyLossBps","weeklyDrawdownBps","optionsRiskBps","cashReserveBps"] as const){if(!Number.isInteger(p[key])||p[key]<0||p[key]>10000)throw Error("Invalid risk setting: "+key);if(p[key]>recommended[key]*1.5&&!acceptHigherRisk)throw Error("HIGHER_RISK_CONFIRMATION_REQUIRED: "+key);}
  if(p.dayTradingEnabled&&!capabilities.intraday)throw Error("DAY_TRADING_REQUIRES_VERIFIED_INTRADAY_PROVIDER");
  if(p.optionsEnabled&&!capabilities.options)throw Error("OPTIONS_REQUIRES_VERIFIED_OPTIONS_PROVIDER");
  if(p.swingRiskBps>p.combinedRiskBps||p.dayRiskBps>p.combinedRiskBps)throw Error("Per-trade risk cannot exceed combined open risk");
  if(!["BLOCK","VERY_STRONG_ONLY"].includes(p.fridaySwing)||p.requireConfirmation!==true||p.extendedHours!==false)throw Error("Unsupported entry or session policy");
  for(const key of ["minimumConfidence","fridayConfidence"] as const)if(!Number.isFinite(p[key])||p[key]<0||p[key]>100)throw Error("Invalid confidence");
  if(p.fridayConfidence<p.minimumConfidence||!Number.isFinite(p.minimumRewardRisk)||p.minimumRewardRisk<1||p.minimumRewardRisk>20)throw Error("Invalid setup thresholds");
  for(const key of ["maxDayTrades","maxSwingDays","maxDayMinutes"] as const)if(!Number.isInteger(p[key])||p[key]<1||p[key]>1000)throw Error("Invalid holding/concurrency limit");
  return p;
}
export function strategyRiskBudget(p:TradingPolicy,input:{style:TradeStyle;value:number;cash:number;openRisk:number;dailyDayLoss:number;weeklyDrawdown:number;dayTrades:number}){
  const v=Math.max(0,input.value),dailyHit=input.dailyDayLoss>=v*p.dailyLossBps/10000,weeklyHit=input.weeklyDrawdown>=v*p.weeklyDrawdownBps/10000,remainingCombined=Math.max(0,v*p.combinedRiskBps/10000-input.openRisk);
  const enabled=input.style==="DAY_TRADE"?p.dayTradingEnabled:input.style==="SWING"?p.swingEnabled:p.longTermEnabled;
  const blocked=!enabled||dailyHit||weeklyHit||(input.style==="DAY_TRADE"&&input.dayTrades>=p.maxDayTrades);
  return {blocked,reason:!enabled?"Strategy disabled":dailyHit?"Daily day-trade loss limit reached; wait for exchange-day reset":weeklyHit?"Weekly drawdown limit reached; review before adding risk":blocked?"Concurrent day-trade limit reached":"Risk available",remainingCombined,tradeRisk:blocked?0:Math.min(remainingCombined,v*(input.style==="DAY_TRADE"?p.dayRiskBps:p.swingRiskBps)/10000),deployableCash:Math.max(0,input.cash-v*p.cashReserveBps/10000)};
}
export function fridaySwingGate(date:Date,style:TradeStyle,p:TradingPolicy,e:{fundamentals:boolean;trend:boolean;market:boolean;sector:boolean;technical:boolean;liquid:boolean;weekendCatalystClear:boolean;rewardRisk:number;confidence:number}){
  const friday=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short"}).format(date)==="Fri";
  if(!friday||style!=="SWING")return {allowed:true,reason:"Standard strategy entry rules apply"};
  const strong=p.fridaySwing==="VERY_STRONG_ONLY"&&e.fundamentals&&e.trend&&e.market&&e.sector&&e.technical&&e.liquid&&e.weekendCatalystClear&&e.rewardRisk>=Math.max(3,p.minimumRewardRisk)&&e.confidence>=p.fridayConfidence;
  return {allowed:strong,reason:strong?"VERY STRONG OPPORTUNITY — independent Friday confirmations passed":"WAIT UNTIL NEXT SESSION — do not open new swing risk before the weekend"};
}

