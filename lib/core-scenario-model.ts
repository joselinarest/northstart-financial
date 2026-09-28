/** Explicit, bounded scenario assumptions. These weights are not calibrated win probabilities. */
export function coreScenarios(input:{price:number;bull:number;base:number;bear:number;horizonDays:number;positiveSignals:number;negativeSignals:number;asOf:string}){
  if(![input.price,input.bull,input.base,input.bear,input.horizonDays].every(n=>Number.isFinite(n)&&n>0)||input.bull<=input.price||input.bear>=input.price||input.bear>=input.base||input.base>=input.bull)return null;
  const balance=Math.max(-3,Math.min(3,input.positiveSignals-input.negativeSignals));
  const bull=35+balance*5,bear=35-balance*5,base=30;
  const expectedPrice=(bull*input.bull+base*input.base+bear*input.bear)/100;
  return {version:'core-scenarios-1',basis:'Explicit scenario weights adjusted by verified trend, valuation, catalyst and regime evidence; assumptions, not calibrated probabilities.',horizonDays:input.horizonDays,price:input.price,asOf:input.asOf,expectedReturn:expectedPrice/input.price-1,downside:(input.price-input.bear)/input.price,bull:{probability:bull,price:input.bull},base:{probability:base,price:input.base},bear:{probability:bear,price:input.bear}};
}
