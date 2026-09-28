/** Explicit industry-to-benchmark mapping; unknown industries remain a data gap. */
export function sectorBenchmarkForIndustry(industry:unknown):string|null{
  if(typeof industry!=="string")return null;
  const mapping:[RegExp,string][]=[[/semiconductor|software|technology|electronic|IT services/i,"XLK"],[/bank|insurance|financial|capital markets/i,"XLF"],[/pharma|biotech|health|medical|life sciences/i,"XLV"],[/energy|oil|gas/i,"XLE"],[/utility|utilities/i,"XLU"],[/real estate|REIT/i,"XLRE"],[/aerospace|industrial|machinery|transport|airlines|road & rail|marine|electrical equipment|construction|building|professional services|commercial services|trading companies/i,"XLI"],[/telecom|communication|media|entertainment/i,"XLC"],[/food|beverage|household|tobacco/i,"XLP"],[/retail|automobile|auto components|hotel|restaurant|consumer discretionary|textiles|apparel|luxury|leisure|diversified consumer services|^distributors$/i,"XLY"],[/chemical|metal|mining|material|packaging/i,"XLB"]];
  return mapping.find(([pattern])=>pattern.test(industry))?.[1]||null;
}

/** Exposure comparators are classification metadata, not a discovery candidate list.
 * A diversified/bond/commodity fund has no corporate sector. Never invent one. */
export function researchBenchmark(symbol:string,industry:unknown,assetName=''){
 const funds:Record<string,[string,string]>={
  VTI:['SPY','Broad US equities'],VOO:['SPY','Broad US equities'],SPY:['VTI','Broad US equities'],VT:['ACWI','Global equities'],VXUS:['ACWX','International equities'],
  QQQ:['QQQM','Nasdaq-100 equities'],QQQM:['QQQ','Nasdaq-100 equities'],SCHD:['VYM','US dividend equities'],
  BND:['AGG','Aggregate US bonds'],AGG:['BND','Aggregate US bonds'],SPHY:['HYG','High-yield corporate bonds'],SGOV:['BIL','Short-term US Treasury bills'],
  IAU:['GLD','Gold'],GLD:['IAU','Gold'],DRAM:['SOXX','Semiconductor equities'],
  XLK:['VGT','Technology equities'],XLF:['VFH','Financial equities'],XLV:['VHT','Health-care equities'],XLE:['VDE','Energy equities'],
  XLU:['VPU','Utility equities'],XLRE:['VNQ','Real-estate equities'],XLI:['VIS','Industrial equities'],XLC:['VOX','Communication equities'],
  XLP:['VDC','Consumer-staples equities'],XLY:['VCR','Consumer-discretionary equities'],XLB:['VAW','Materials equities'],
 };
 const fund=funds[symbol.toUpperCase()];
 if(fund)return {symbol:fund[0],kind:'ASSET_EXPOSURE',classification:fund[1],source:'Explicit fund exposure classification'};
 const sector=sectorBenchmarkForIndustry(industry);
 if(sector)return {symbol:sector,kind:'SECTOR',classification:String(industry),source:'Company profile industry'};
 // Only unambiguous exposure in the supplied asset identity is accepted.
 if(/\b(etf|fund)\b/i.test(assetName)){
  const match:[RegExp,string,string][]=[[/\bS&P 500\b/i,'SPY','S&P 500 equities'],[/\btotal stock market\b/i,'VTI','Broad US equities'],[/\bsemiconductor/i,'SOXX','Semiconductor equities']];
  const found=match.find(([pattern])=>pattern.test(assetName));if(found)return {symbol:found[1],kind:'ASSET_EXPOSURE',classification:found[2],source:'Provider asset name'};
 }
 return null;
}
