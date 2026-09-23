/** Explicit industry-to-benchmark mapping; unknown industries remain a data gap. */
export function sectorBenchmarkForIndustry(industry:unknown):string|null{
  if(typeof industry!=="string")return null;
  const mapping:[RegExp,string][]=[[/semiconductor|software|technology|electronic|IT services/i,"XLK"],[/bank|insurance|financial|capital markets/i,"XLF"],[/pharma|biotech|health|medical/i,"XLV"],[/energy|oil|gas/i,"XLE"],[/utility|utilities/i,"XLU"],[/real estate|REIT/i,"XLRE"],[/aerospace|industrial|machinery|transport/i,"XLI"],[/telecom|communication|media|entertainment/i,"XLC"],[/food|beverage|household|tobacco/i,"XLP"],[/retail|automobile|hotel|restaurant|consumer discretionary/i,"XLY"],[/chemical|metal|mining|material/i,"XLB"]];
  return mapping.find(([pattern])=>pattern.test(industry))?.[1]||null;
}
