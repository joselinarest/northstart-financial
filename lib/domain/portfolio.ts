import type { StrategyType } from "@/lib/domain/investment-accounts";

export const allocationCategories = ["CORE","QUALITY","AGGRESSIVE","INCOME","BONDS","CASH"] as const;
export type AllocationCategory = (typeof allocationCategories)[number];

export type AllocationTarget = Record<AllocationCategory, number>;

const presets:Record<StrategyType,AllocationTarget>={
  SWING:{CORE:0,QUALITY:0,AGGRESSIVE:7500,INCOME:0,BONDS:0,CASH:2500},
  GROWTH_5_7:{CORE:6000,QUALITY:2500,AGGRESSIVE:1000,INCOME:0,BONDS:0,CASH:500},
  RETIREMENT:{CORE:5500,QUALITY:1500,AGGRESSIVE:500,INCOME:1500,BONDS:700,CASH:300},
  CHILD_GROWTH:{CORE:6500,QUALITY:2000,AGGRESSIVE:750,INCOME:250,BONDS:250,CASH:250},
  COLLEGE:{CORE:5000,QUALITY:1000,AGGRESSIVE:250,INCOME:500,BONDS:2500,CASH:750},
  AGGRESSIVE_GROWTH:{CORE:3500,QUALITY:3000,AGGRESSIVE:3000,INCOME:0,BONDS:0,CASH:500},
  DIVIDEND_INCOME:{CORE:3500,QUALITY:1500,AGGRESSIVE:0,INCOME:4000,BONDS:500,CASH:500},
  HOUSE_FUND:{CORE:2000,QUALITY:500,AGGRESSIVE:0,INCOME:500,BONDS:3500,CASH:3500},
  CAPITAL_PRESERVATION:{CORE:1000,QUALITY:0,AGGRESSIVE:0,INCOME:1000,BONDS:4000,CASH:4000},
  CUSTOM:{CORE:5000,QUALITY:2000,AGGRESSIVE:1000,INCOME:1000,BONDS:500,CASH:500},
};

export function strategyTarget(strategy:StrategyType,custom?:Partial<AllocationTarget>):AllocationTarget{
  const target={...presets[strategy],...custom};
  const total=allocationCategories.reduce((sum,key)=>sum+target[key],0);
  if(total!==10000)throw new Error(`Allocation target must total 100%; received ${(total/100).toFixed(2)}%`);
  return target;
}

export function classifyHolding(input:{securityType?:string|null;name?:string|null;ticker?:string|null}):AllocationCategory{
  const text=`${input.securityType||""} ${input.name||""} ${input.ticker||""}`.toLowerCase();
  if(/cash|money market|treasury bill|short.term/.test(text))return"CASH";
  if(/bond|fixed income|aggregate|treasury|municipal/.test(text))return"BONDS";
  if(/dividend|income|preferred|reit/.test(text))return"INCOME";
  if(/total market|s&p|index|large cap|broad market|etf|fund/.test(text))return"CORE";
  if(/small cap|innovation|emerging|leveraged|inverse|speculative/.test(text))return"AGGRESSIVE";
  return"QUALITY";
}

type HoldingInput={id:string;symbol:string;name:string;securityType:string|null;quantity:string;marketValueCents:bigint;priceCents:bigint;costBasisCents:bigint|null};

export function calculatePortfolio(input:{holdings:HoldingInput[];cashCents:bigint;target:AllocationTarget;shareMode:"WHOLE"|"FRACTIONAL";maximumPositionBps:number;safeInvestmentCapacityCents:bigint;goalTargetCents?:bigint|null;horizonMonths?:number|null;annualContributionCents?:bigint}){
  const holdingValue=input.holdings.reduce((sum,item)=>sum+item.marketValueCents,0n),total=holdingValue+input.cashCents;
  const values=Object.fromEntries(allocationCategories.map(key=>[key,0n])) as Record<AllocationCategory,bigint>;
  for(const holding of input.holdings)values[classifyHolding({securityType:holding.securityType,name:holding.name,ticker:holding.symbol})]+=holding.marketValueCents;
  values.CASH+=input.cashCents;
  const categories=allocationCategories.map(category=>{
    const currentBps=total>0n?Number(values[category]*10000n/total):0,targetBps=input.target[category],targetCents=total*BigInt(targetBps)/10000n,gapCents=targetCents-values[category];
    return{category,currentBps,targetBps,valueCents:values[category].toString(),gapCents:gapCents.toString(),status:gapCents>total/200n?"UNDERWEIGHT":gapCents<-(total/200n)?"OVERWEIGHT":"ON_TARGET"};
  });
  const positionRows=input.holdings.map(holding=>{const category=classifyHolding({securityType:holding.securityType,name:holding.name,ticker:holding.symbol}),weightBps=total>0n?Number(holding.marketValueCents*10000n/total):0,categoryGap=BigInt(categories.find(item=>item.category===category)!.gapCents),positionLimitCents=total*BigInt(input.maximumPositionBps)/10000n;let action:"BUY_MORE"|"HOLD"|"REDUCE"="HOLD",amount=0n;if(holding.marketValueCents>positionLimitCents){action="REDUCE";amount=holding.marketValueCents-positionLimitCents}else if(categoryGap>0n&&holding.marketValueCents<positionLimitCents){action="BUY_MORE";amount=[categoryGap,positionLimitCents-holding.marketValueCents,input.safeInvestmentCapacityCents].reduce((smallest,value)=>value<smallest?value:smallest)}else if(categoryGap<0n){action="REDUCE";amount=(-categoryGap)<holding.marketValueCents?-categoryGap:holding.marketValueCents}const quantityScale=input.shareMode==="WHOLE"?1n:1000n,suggestedQuantity=holding.priceCents>0n?(amount*quantityScale/holding.priceCents):0n;return{id:holding.id,symbol:holding.symbol,name:holding.name,category,weightBps,marketValueCents:holding.marketValueCents.toString(),costBasisCents:holding.costBasisCents?.toString()||null,unrealizedPnlCents:holding.costBasisCents===null?null:(holding.marketValueCents-holding.costBasisCents).toString(),action,amountCents:amount.toString(),suggestedQuantity:(Number(suggestedQuantity)/Number(quantityScale)).toFixed(input.shareMode==="WHOLE"?0:3)}});
  const maxWeight=positionRows.reduce((maximum,row)=>Math.max(maximum,row.weightBps),0),drift=categories.reduce((sum,row)=>sum+Math.abs(row.currentBps-row.targetBps),0)/2,diversificationScore=Math.min(100,input.holdings.length*12),concentrationScore=Math.max(0,100-Math.max(0,maxWeight-input.maximumPositionBps)/50),alignmentScore=Math.max(0,100-drift/50),cashScore=input.cashCents>=0n?100:0,health=Math.round(diversificationScore*.25+concentrationScore*.3+alignmentScore*.35+cashScore*.1);
  const months=Math.max(1,input.horizonMonths||60),annualContribution=input.annualContributionCents||0n,monthly=annualContribution/12n,scenario=(annualBps:number)=>{let value=total;for(let month=0;month<months;month++)value=value+monthly+(value*BigInt(annualBps)/10000n)/12n;return value};const projections={bearCents:scenario(-200).toString(),baseCents:scenario(650).toString(),bullCents:scenario(1050).toString()},goalTarget=input.goalTargetCents||null,base=BigInt(projections.baseCents),goalProgressBps=goalTarget&&goalTarget>0n?Number((base<goalTarget?base:goalTarget)*10000n/goalTarget):null;
  return{totalValueCents:total.toString(),holdingValueCents:holdingValue.toString(),cashCents:input.cashCents.toString(),healthScore:health,healthInputs:{diversificationScore,concentrationScore:Math.round(concentrationScore),alignmentScore:Math.round(alignmentScore),cashScore,maxPositionBps:maxWeight,totalDriftBps:drift},categories,holdings:positionRows,projections,goalProgressBps};
}

