export type PropertyAssumptions={price:number;closingCosts:number;renovation:number;downPaymentPct:number;interestRatePct:number;loanYears:number;monthlyRent:number;taxAnnual:number;insuranceAnnual:number;hoaMonthly:number;utilitiesMonthly:number;maintenancePct:number;managementPct:number;vacancyPct:number;appreciationPct:number;targetCashOnCashPct:number};
export function analyzeProperty(p:PropertyAssumptions){
 const cashPrice=Math.max(0,p.price),down=cashPrice*p.downPaymentPct/100,loan=Math.max(0,cashPrice-down),months=Math.max(1,p.loanYears*12),rate=p.interestRatePct/1200;
 const mortgage=rate?loan*rate*Math.pow(1+rate,months)/(Math.pow(1+rate,months)-1):loan/months;
 const effectiveRent=p.monthlyRent*(1-p.vacancyPct/100),operating=effectiveRent*(p.maintenancePct+p.managementPct)/100+p.taxAnnual/12+p.insuranceAnnual/12+p.hoaMonthly+p.utilitiesMonthly;
 const noi=effectiveRent-operating,monthlyCashFlow=noi-mortgage,annualCashFlow=monthlyCashFlow*12,cashRequired=down+p.closingCosts+p.renovation;
 const capRate=cashPrice?noi*12/cashPrice*100:0,cashOnCash=cashRequired?annualCashFlow/cashRequired*100:0,dscr=mortgage?noi/mortgage:Infinity,breakEvenOccupancy=p.monthlyRent?Math.min(100,(operating+mortgage)/p.monthlyRent*100):100;
 const score=Math.max(0,Math.min(100,Math.round(45+cashOnCash*3+(dscr-1)*20+(capRate-5)*2))),action=cashOnCash>=p.targetCashOnCashPct&&dscr>=1.2?"BUY CANDIDATE":cashOnCash>=p.targetCashOnCashPct*.75&&dscr>=1?"NEGOTIATE":monthlyCashFlow>=0?"WATCH":"PASS";
 const maxOffer=cashOnCash>0?cashPrice*Math.max(.4,Math.min(1.2,cashOnCash/p.targetCashOnCashPct)):0;
 const scenarios=[{name:"Bear",rentFactor:.9,appreciation:0},{name:"Base",rentFactor:1,appreciation:p.appreciationPct},{name:"Bull",rentFactor:1.1,appreciation:p.appreciationPct+2}].map(s=>({name:s.name,monthlyCashFlow:monthlyCashFlow+p.monthlyRent*(s.rentFactor-1),equity5:cashPrice*Math.pow(1+s.appreciation/100,5)-loan,equity10:cashPrice*Math.pow(1+s.appreciation/100,10)-loan}));
 return{down,loan,mortgage,effectiveRent,operating,noi,monthlyCashFlow,annualCashFlow,cashRequired,capRate,cashOnCash,dscr,breakEvenOccupancy,score,action,maxOffer,scenarios};
}
