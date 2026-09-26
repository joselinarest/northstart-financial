export function exitScenarioDefaults(input:{owned:number;average:number|null;price:number;recommendation?:Record<string,any>;policy?:Record<string,any>;fractional?:boolean}){
 const {owned,average,price,recommendation:r,policy={}}=input;
 const isExit=/^(SELL|TRIM|REDUCE|TAKE_PROFIT|TACTICAL_EXIT_REENTRY|TRIM_REBUY)$/.test(String(r?.action));
 const requested=isExit?Number(r?.suggested_quantity??r?.quantity):0;
 const proposed=requested>0?requested:owned*.25;
 const quantity=Math.min(owned,input.fractional?Number(proposed.toFixed(6)):Math.max(Math.min(1,owned),Math.floor(proposed)));
 const orderPrice=isExit?Number(r?.order_price_cents??r?.entry_low_cents)/100:0;
 return {quantity:Number.isFinite(quantity)&&quantity>0?quantity:null,price:orderPrice>0?orderPrice:price>0?price:null,quantityBasis:requested>0?'Saved exit recommendation':'25% partial-trim comparison, not a sell recommendation',commission:policy.commissionCents==null?null:Math.max(0,Number(policy.commissionCents)/100),slippageBps:policy.slippageBps==null?null:Math.max(0,Number(policy.slippageBps)),taxRate:policy.taxRatePct==null&&policy.tacticalTaxRatePct==null?null:Math.max(0,Math.min(100,Number(policy.taxRatePct??policy.tacticalTaxRatePct)))/100};
}
