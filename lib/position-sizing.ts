/** All amounts use one consistent currency unit. Missing capacity is not unlimited. */
export type SizingInput={entry:number;stop:number;equity:number;cash:number;reservedCash:number;cashReserveBps:number;riskBps:number;positionBps:number;existingPosition:number;sectorRoom:number|null;remainingOpenRisk:number|null;liquidityShares:number|null;fractional?:boolean};
export function positionSizing(i:SizingInput){
 const values=[i.entry,i.stop,i.equity,i.cash,i.reservedCash,i.cashReserveBps,i.riskBps,i.positionBps,i.existingPosition,...[i.sectorRoom,i.remainingOpenRisk,i.liquidityShares].filter((n):n is number=>n!=null)];
 const invalid=!values.every(Number.isFinite)||i.entry<=0||i.stop<=0||i.stop>=i.entry||values.slice(2).some(n=>n<0);
 const missing=i.sectorRoom==null||i.remainingOpenRisk==null||i.liquidityShares==null;
 if(invalid||missing)return {shares:0,plannedLoss:0,cost:0,reason:invalid?'NO TRADE — INVALID RISK INPUTS':'NO TRADE — SECTOR, OPEN RISK OR LIQUIDITY CAPACITY UNAVAILABLE'};
 const risk=Math.min(i.equity*i.riskBps/10000,Math.max(0,i.remainingOpenRisk!)),cash=Math.max(0,i.cash-i.reservedCash-i.equity*i.cashReserveBps/10000),position=Math.max(0,i.equity*i.positionBps/10000-i.existingPosition);
 const raw=Math.min(risk/(i.entry-i.stop),cash/i.entry,position/i.entry,Math.max(0,i.sectorRoom!)/i.entry,Math.max(0,i.liquidityShares!));
 const step=i.fractional?10000:1,shares=Math.floor(Math.max(0,raw)*step)/step;
 return {shares,plannedLoss:shares*(i.entry-i.stop),cost:shares*i.entry,reason:shares>0?'SIZED WITH ACCOUNT LIMITS':'NO TRADE — POSITION TOO LARGE'};
}
