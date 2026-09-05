import {loadRuntimeSecrets} from "@/lib/runtime-secrets";
export const dynamic="force-dynamic";

type AlpacaBar={t:string;o:number;h:number;l:number;c:number;v:number};
const swingUniverse=["SPY","QQQ","IWM","DIA","AAPL","MSFT","NVDA","AMZN","GOOGL","META","AVGO","AMD","JPM","V","MA","XOM","CVX","LLY","UNH","COST","WMT","HD","CAT","CRM","ORCL","NFLX","CEG","VST","CCJ","LEU","BWXT","OKLO","SMR","URA","NLR"];
const longTermUniverse=["VTI","VOO","SCHD","VXUS","BND","QQQ","IWM","AAPL","MSFT","NVDA","AMZN","GOOGL","META","AVGO","AMD","CRM","ORCL","PLTR","CRWD","DDOG","NET","SHOP","UBER","ABNB","MELI","CAVA","DUOL","SOFI","CEG","VST","NEE","CCJ","LEU","BWXT","OKLO","SMR","URA","NLR"];
const fundSymbols=new Set(["VTI","VOO","SCHD","VXUS","BND","QQQ","IWM","URA","NLR"]);
const speculativeNuclearSymbols=new Set(["OKLO","SMR","LEU"]);
const nuclearSymbols=new Set(["CEG","VST","NEE","CCJ","LEU","BWXT","OKLO","SMR","URA","NLR"]);
const classifyLongTermCandidate=(symbol:string,marketCap:number|null)=>{
  if(fundSymbols.has(symbol))return{companyStage:"DIVERSIFIED EXCHANGE-TRADED FUND",portfolioRole:"Core or diversifier",setup:"Diversified fund—verify fees, holdings, overlap and plan availability"};
  if(speculativeNuclearSymbols.has(symbol))return{companyStage:"SPECULATIVE NUCLEAR / FUEL CYCLE",portfolioRole:"High-risk thematic satellite only",setup:"Nuclear-policy and commercialization candidate—verify cash runway, contracts, dilution, regulation and execution"};
  if(marketCap===null)return{companyStage:"COMPANY STAGE DATA UNAVAILABLE",portfolioRole:"Do not assign until market capitalization is verified",setup:"Fundamentals incomplete—classification not assigned"};
  if(marketCap!==null&&marketCap>=200000)return{companyStage:"ESTABLISHED MEGA-CAP GROWTH",portfolioRole:"Growth allocation / concentrated satellite",setup:"Established market leader—review valuation and concentration"};
  if(marketCap!==null&&marketCap>=10000)return{companyStage:"ESTABLISHED GROWTH COMPANY",portfolioRole:"Diversified growth satellite",setup:"Established company—validate quality, valuation and portfolio fit"};
  if(marketCap!==null&&marketCap>=2000)return{companyStage:"EMERGING / MID-CAP GROWTH CANDIDATE",portfolioRole:"Small growth satellite",setup:"Emerging-growth candidate—strict fundamental and valuation review"};
  return{companyStage:"SMALL / EARLY-STAGE CANDIDATE",portfolioRole:"High-risk satellite only",setup:"Early-stage candidate—liquidity, dilution and survival checks required"};
};
const avg=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const ema=(values:number[],period:number)=>{const k=2/(period+1);return values.reduce((value,close,index)=>index?close*k+value*(1-k):close,values[0]||0)};

export async function GET(request:Request){
 await loadRuntimeSecrets();
  const strategy=new URL(request.url).searchParams.get("strategy")==="long-term"?"long-term":"swing",universe=strategy==="long-term"?longTermUniverse:swingUniverse;
  const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret)return Response.json({status:"not_configured",error:"Connect Alpaca market data to generate the automatic market shortlist."},{status:503});
  const start=new Date(Date.now()-360*86400000).toISOString(),feed=process.env.ALPACA_DATA_FEED||"iex";
  const response=await fetch(`https://data.alpaca.markets/v2/stocks/bars?symbols=${universe.join(",")}&timeframe=1Day&start=${encodeURIComponent(start)}&limit=10000&adjustment=all&feed=${encodeURIComponent(feed)}`,{headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret},cache:"no-store"});
  if(!response.ok)return Response.json({status:"provider_error",error:"The automatic market scan could not load historical bars.",providerStatus:response.status},{status:502});
  const data=await response.json() as {bars?:Record<string,AlpacaBar[]>};
  const technicalCandidates=Object.entries(data.bars||{}).flatMap(([symbol,bars])=>{
    if(bars.length<55)return[];const recent=bars.slice(-60),last=recent.at(-1)!,previous=recent.at(-2)!,closes=recent.map(x=>x.c),allCloses=bars.map(x=>x.c),volumes=recent.map(x=>x.v),sma20=avg(closes.slice(-20)),sma50=avg(closes.slice(-50)),sma100=allCloses.length>=100?avg(allCloses.slice(-100)):null,sma200=allCloses.length>=200?avg(allCloses.slice(-200)):null,ema20=ema(closes.slice(-40),20),avgVolume=avg(volumes.slice(-21,-1)),relVol=avgVolume?last.v/avgVolume:0;
    const changes=closes.slice(-15).map((value,index,array)=>index?value-array[index-1]:0).slice(1),gains=avg(changes.map(x=>Math.max(0,x))),losses=avg(changes.map(x=>Math.max(0,-x))),rsi=losses===0?100:100-(100/(1+gains/losses));
    const atr=avg(recent.slice(-14).map((bar,index,array)=>{const prev=index?array[index-1].c:bar.o;return Math.max(bar.h-bar.l,Math.abs(bar.h-prev),Math.abs(bar.l-prev))})),high20=Math.max(...recent.slice(-21,-1).map(x=>x.h)),low20=Math.min(...recent.slice(-20).map(x=>x.l)),dayChange=(last.c-previous.c)/previous.c*100;
    const liquid=avgVolume>=500000&&last.c>=5;if(!liquid)return[];
    let score=50;if(strategy==="swing"){score+=last.c>sma50?10:-10;score+=ema20>sma50?9:-7;score+=last.c>sma20?7:-5;score+=rsi>=48&&rsi<=68?7:rsi>78?-8:0;score+=relVol>=1.15&&dayChange>0?7:relVol<.55?-4:0;score+=last.c>high20?8:0}else{score+=last.c>sma50?14:-14;score+=ema20>sma50?10:-9;score+=last.c>sma20?5:-3;score+=rsi>=40&&rsi<=72?5:rsi>82?-7:0;score+=avgVolume>=2000000?5:0;score+=symbol==="VTI"||symbol==="VOO"||symbol==="SCHD"||symbol==="VXUS"||symbol==="BND"?8:0}score=Math.max(15,Math.min(95,Math.round(score)));
    const setup=strategy==="long-term"?(fundSymbols.has(symbol)?"Diversified fund—fund-specific review required":"Company stage not assigned until fundamentals are verified"):last.c>high20?`Breakout detected · require a close above $${high20.toFixed(2)} with supporting volume`:last.c>=ema20&&last.c<=ema20*1.025?`Controlled pullback near EMA 20 ($${ema20.toFixed(2)})`:last.c>sma50?`Uptrend intact · current price is not at a low-risk entry zone; monitor $${ema20.toFixed(2)} or breakout $${high20.toFixed(2)}`:`Trend damaged below SMA 50 ($${sma50.toFixed(2)}) · no new long until reclaimed`;
    const action=score>=76?"Prepare conditional buy":score>=62?"No entry — monitor trigger":"Avoid — conditions failed";
    const invalidation=Math.max(low20,last.c-2*atr),riskPct=(last.c-invalidation)/last.c*100;
    return[{symbol,price:last.c,dayChange,score,setup,action,trend:last.c>sma50?(ema20>sma50?"Bullish":"Mixed"):"Bearish",ema20,sma50,sma100,sma200,rsi,relVol,avgVolume,support:low20,resistance:high20,invalidation,riskPct,asOf:last.t}];
  }).sort((a,b)=>b.score-a.score).slice(0,strategy==="long-term"?40:16);
  let candidates:Record<string,unknown>[]=technicalCandidates;
  if(strategy==="long-term"&&process.env.FINNHUB_API_KEY){
    const finnhubKey=process.env.FINNHUB_API_KEY;
    candidates=await Promise.all(technicalCandidates.map(async candidate=>{try{
      const [metricResponse,profileResponse]=await Promise.all([
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${candidate.symbol}&metric=all`,{headers:{"X-Finnhub-Token":finnhubKey},cache:"no-store"}),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${candidate.symbol}`,{headers:{"X-Finnhub-Token":finnhubKey},cache:"no-store"}),
      ]);const metrics=(await metricResponse.json() as {metric?:Record<string,number>}).metric||{},profile=await profileResponse.json() as {marketCapitalization?:number;name?:string};
      const revenueGrowth3Y=metrics.revenueGrowth3Y??null,revenueGrowth5Y=metrics.revenueGrowth5Y??null,epsGrowth3Y=metrics.epsGrowth3Y??null,epsGrowth5Y=metrics.epsGrowth5Y??null,pe=metrics.peTTM??null,forwardPE=metrics.forwardPE??null,peg=metrics.forwardPEG??null,grossMargin=metrics.grossMarginTTM??null,operatingMargin=metrics.operatingMarginTTM??null;
      let fundamentalAdjustment=0;if(revenueGrowth3Y!==null)fundamentalAdjustment+=revenueGrowth3Y>=20?10:revenueGrowth3Y>8?4:-5;if(epsGrowth3Y!==null)fundamentalAdjustment+=epsGrowth3Y>=15?7:epsGrowth3Y<0?-6:0;if(operatingMargin!==null)fundamentalAdjustment+=operatingMargin>=15?5:operatingMargin<0?-7:0;if(forwardPE!==null)fundamentalAdjustment+=forwardPE>70?-8:forwardPE<35?4:0;
      const score=Math.max(15,Math.min(95,Number(candidate.score)+fundamentalAdjustment)),coverage=[revenueGrowth3Y,epsGrowth3Y,forwardPE,grossMargin,operatingMargin,profile.marketCapitalization].filter(value=>value!==null&&value!==undefined).length;
      const tier=coverage<4?"Promising · incomplete data":score>=78?"Qualified for full research":score>=62?"Promising · validate further":"Watch / avoid";
      const epsTTM=metrics.epsTTM??metrics.epsBasicExclExtraItemsTTM??null,cashFlowPerShare=metrics.cashFlowPerShareTTM??null,normalizedGrowth=[revenueGrowth3Y,epsGrowth3Y].filter((value):value is number=>value!==null&&Number.isFinite(value)).map(value=>Math.max(0,Math.min(30,value))),growthAnchor=normalizedGrowth.length?avg(normalizedGrowth):null,targetPe=growthAnchor===null?null:Math.max(14,Math.min(35,15+growthAnchor*.65)),earningsValue=epsTTM&&epsTTM>0&&targetPe?epsTTM*targetPe:null,targetCashFlowMultiple=growthAnchor===null?null:Math.max(12,Math.min(28,13+growthAnchor*.5)),cashFlowValue=cashFlowPerShare&&cashFlowPerShare>0&&targetCashFlowMultiple?cashFlowPerShare*targetCashFlowMultiple:null,relativeMultipleValue=forwardPE&&forwardPE>0&&targetPe?candidate.price*(targetPe/forwardPE):pe&&pe>0&&targetPe?candidate.price*(targetPe/pe):null,valuationInputs=[earningsValue,cashFlowValue,relativeMultipleValue].filter((value):value is number=>value!==null&&Number.isFinite(value)&&value>0),fairValue=valuationInputs.length?avg(valuationInputs):null,fairValueLow=fairValue?fairValue*.75:null,fairValueHigh=fairValue?fairValue*1.25:null,fairValueSource=fairValue?`Northstar blended valuation using ${earningsValue?"EPS, ":""}${cashFlowValue?"cash flow, ":""}${relativeMultipleValue?"current-vs-growth-adjusted multiple, ":""}with ${targetPe?.toFixed(1)??"—"}x target P/E and ±25% uncertainty`:"Unavailable — positive earnings, cash flow, or a usable current valuation multiple is missing";
      const classification=classifyLongTermCandidate(candidate.symbol,profile.marketCapitalization??null);
      return{...candidate,...classification,name:profile.name||candidate.symbol,score,tier,fundamentals:{revenueGrowth3Y,revenueGrowth5Y,epsGrowth3Y,epsGrowth5Y,pe,forwardPE,peg,grossMargin,operatingMargin,marketCap:profile.marketCapitalization??null},fairValue,fairValueLow,fairValueHigh,fairValueSource,fairValueAsOf:new Date().toISOString(),news:[],missingData:fundSymbols.has(candidate.symbol)?false:coverage<4,analysisCoverage:`${coverage}/6 core company fields received`,valuationConfidence:valuationInputs.length>=2?"medium":valuationInputs.length===1?"low":"unavailable",forecast:"Continuation is plausible only if multi-year growth, margins and cash generation persist without excessive valuation or dilution."};
    }catch{return{...candidate,companyStage:"COMPANY STAGE DATA UNAVAILABLE",portfolioRole:"Do not assign until fundamentals are restored",setup:"Fundamental provider unavailable—classification not assigned",tier:"Technical candidate · incomplete data",missingData:true,forecast:"Technical evidence is available, but company growth and maturity have not been verified."}}}));
    const ranked=candidates.sort((a,b)=>Number(b.score)-Number(a.score)),nuclear=ranked.filter(item=>nuclearSymbols.has(String(item.symbol))),general=ranked.filter(item=>!nuclearSymbols.has(String(item.symbol))).slice(0,8);candidates=[...general,...nuclear.slice(0,4)].sort((a,b)=>Number(b.score)-Number(a.score));
  }
  if(strategy==="long-term"&&!process.env.FINNHUB_API_KEY){
    candidates=candidates.map(candidate=>({...candidate,companyStage:fundSymbols.has(String(candidate.symbol))?"DIVERSIFIED EXCHANGE-TRADED FUND":"COMPANY STAGE DATA UNAVAILABLE",portfolioRole:fundSymbols.has(String(candidate.symbol))?"Core or diversifier":"Do not assign until fundamentals are connected",missingData:true}));
  }
  return Response.json({status:"connected",provider:"Alpaca",feed,strategy,asOf:new Date().toISOString(),universeSize:universe.length,method:strategy==="swing"?"Liquid securities ranked for swing timing using structure, EMA20/SMA50, RSI, relative volume, breakout state and invalidation.":"Separate long-term discovery universe ranked for liquid technical health and portfolio role. Individual-company candidates still require revenue, EPS, free-cash-flow, ROIC, debt, dilution, valuation, moat and filing validation before inclusion.",candidates},{headers:{"Cache-Control":"private, no-store"}});
}
