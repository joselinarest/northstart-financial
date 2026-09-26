export function parseOptionContract(value:unknown){
 const symbol=String(value||'').toUpperCase().replace(/^O:/,'').replace(/^-/, '').replace(/\s/g,'');
 const match=symbol.match(/^([A-Z.]{1,6}\d?)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
 if(!match)return null;
 const expiration=`20${match[2]}-${match[3]}-${match[4]}`;
 const parsed=new Date(expiration+'T00:00:00Z');
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==expiration)return null;
 return {symbol,underlying:match[1].replace(/\d$/,''),type:match[5]==='C'?'CALL':'PUT',expiration,strike:Number(match[6])/1000,multiplier:/\d$/.test(match[1])?null:100};
}
export function optionPositionValues(position:Record<string,any>,snapshot:Record<string,any>|undefined){
 const quote=snapshot?.latestQuote,bid=quote?.bp==null?NaN:Number(quote.bp),ask=quote?.ap==null?NaN:Number(quote.ap),time=Date.parse(quote?.t||'');
 const quoted=Number.isFinite(bid)&&Number.isFinite(ask)&&bid>=0&&ask>0&&ask>=bid&&Number.isFinite(time);
 const premium=quoted?(bid+ask)/2:position.savedPremium??null,asOf=quoted?new Date(time).toISOString():position.savedAsOf||null;
 const quantity=Number(position.quantity),multiplier=position.multiplier,cost=position.costBasis==null?null:Number(position.costBasis);
 const value=premium!=null&&multiplier!=null?quantity*multiplier*premium:null;
 return {...position,premium,asOf,quoteStatus:quoted?'QUOTE_MIDPOINT':premium!=null?'SAVED_PRICE':'UNAVAILABLE',bid:quoted?bid:null,ask:quoted?ask:null,value,pnl:value!=null&&cost!=null?value-cost:null,average:cost!=null&&quantity!==0&&multiplier!=null?Math.abs(cost/(quantity*multiplier)):null,greeks:snapshot?.greeks||position.greeks||null};
}
