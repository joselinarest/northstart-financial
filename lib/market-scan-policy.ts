/** Scheduling and screening policy; these scores never authorize orders. */
export function screeningPolicy(priority:number,seed:{seed:number;metrics:{relativeVolume:number;dayChange:number;return20:number;averageDollarVolume:number}}|null){
 if(!seed)return {stage:'RESEARCH_INCOMPLETE',reason:'Insufficient price history',minutes:60};
 const liquid=seed.metrics.averageDollarVolume>=750000;
 const anomaly=seed.metrics.relativeVolume>=1.5||Math.abs(seed.metrics.dayChange)>=3||Math.abs(seed.metrics.return20)>=12;
 const research=priority>=100||(liquid&&(anomaly||seed.seed>=70));
 return {stage:research?'RESEARCH_PENDING':'NEAR_MISS',reason:research?'Priority coverage or liquid technical anomaly requires deep research':!liquid?'Dollar liquidity below broad-screen threshold':'No qualifying anomaly yet; scheduled for another lightweight scan',minutes:priority>=150?5:priority>=100?15:research?60:240};
}
export type MonitoringTier='ACTIVE'|'OWNED'|'WATCHLIST'|'CANDIDATE';
export function researchCadence(tier:MonitoringTier,session:string){const base={ACTIVE:5,OWNED:10,WATCHLIST:30,CANDIDATE:60}[tier];return session==='REGULAR'?base:session==='CLOSED'?Math.max(60,base*4):Math.max(15,base*2);}
export function eligibleMarketAsset(asset:{tradable:boolean;exchange:string;name:string}){return asset.tradable&&['NASDAQ','NYSE','AMEX','ARCA','BATS'].includes(asset.exchange)&&!/\b(warrants?|units?|rights?)\b/i.test(asset.name||'');}
