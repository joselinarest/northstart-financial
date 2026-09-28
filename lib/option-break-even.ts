export type OptionModel={type:'CALL'|'PUT';strike:number;iv:number;days:number;rate:number;dividend:number};
/** American CRR tree, continuous dividend yield. Prices per underlying share. */
export function modeledOptionPrice(spot:number,m:OptionModel){
 if(![spot,m.strike,m.iv,m.days,m.rate,m.dividend].every(Number.isFinite)||spot<=0||m.strike<=0||m.iv<=0||m.days<0)return NaN;
 const intrinsic=(s:number)=>Math.max(0,m.type==='CALL'?s-m.strike:m.strike-s);
 if(m.days===0)return intrinsic(spot);
 const n=160,dt=m.days/365/n,u=Math.exp(m.iv*Math.sqrt(dt)),d=1/u,p=(Math.exp((m.rate-m.dividend)*dt)-d)/(u-d),discount=Math.exp(-m.rate*dt);
 if(p<0||p>1)return NaN;
 const values=Array.from({length:n+1},(_,j)=>intrinsic(spot*Math.pow(u,j)*Math.pow(d,n-j)));
 for(let i=n-1;i>=0;i--)for(let j=0;j<=i;j++)values[j]=Math.max(intrinsic(spot*Math.pow(u,j)*Math.pow(d,i-j)),discount*(p*values[j+1]+(1-p)*values[j]));
 return values[0];
}
export function optionBreakEven(m:OptionModel,entry:number,contracts:number,fees:number,exitDiscount:number){
 if(![entry,contracts,fees,exitDiscount].every(Number.isFinite)||entry<=0||!Number.isInteger(contracts)||contracts<1||fees<0||exitDiscount<0)return null;
 const requiredPremium=entry+fees/(contracts*100),target=requiredPremium+exitDiscount;
 if(m.type==='PUT'&&target>=m.strike)return {stockPrice:null,requiredPremium,reason:'Required proceeds exceed the maximum put value at a positive stock price.'};
 let low=.000001,high=Math.max(m.strike*2,target*2+m.strike);
 if(m.type==='CALL')while(modeledOptionPrice(high,m)<target&&high<1e9)high*=2;
 if(!Number.isFinite(modeledOptionPrice(high,m))||!Number.isFinite(modeledOptionPrice(low,m)))return null;
 for(let i=0;i<45;i++){const middle=(low+high)/2,price=modeledOptionPrice(middle,m);if((m.type==='CALL'&&price<target)||(m.type==='PUT'&&price>target))low=middle;else high=middle;}
 return {stockPrice:(low+high)/2,requiredPremium,reason:null};
}
