import {loadRuntimeSecrets} from "@/lib/runtime-secrets";
export const dynamic="force-dynamic";

const definitions=[
  {id:"DFF",label:"Effective Fed funds rate",unit:"%",group:"Rates"},
  {id:"DGS2",label:"2-year Treasury yield",unit:"%",group:"Rates"},
  {id:"DGS10",label:"10-year Treasury yield",unit:"%",group:"Rates"},
  {id:"T10Y2Y",label:"10Y–2Y yield spread",unit:"pp",group:"Curve"},
  {id:"CPIAUCSL",label:"Consumer inflation",unit:"% YoY",group:"Inflation",units:"pc1"},
  {id:"PCEPI",label:"PCE inflation",unit:"% YoY",group:"Inflation",units:"pc1"},
  {id:"UNRATE",label:"Unemployment rate",unit:"%",group:"Labor"},
  {id:"VIXCLS",label:"VIX close",unit:"",group:"Risk"},
  {id:"BAMLH0A0HYM2",label:"High-yield spread",unit:"%",group:"Credit"},
] as const;

export async function GET(){
 await loadRuntimeSecrets();
  const key=process.env.FRED_API_KEY;if(!key)return Response.json({status:"not_configured",error:"Configure FRED_API_KEY to enable macroeconomic context."},{status:503});
  const series=await Promise.all(definitions.map(async definition=>{const params=new URLSearchParams({series_id:definition.id,file_type:"json",sort_order:"desc",limit:"10",api_key:key,...("units" in definition&&definition.units?{units:definition.units}:{})});try{const response=await fetch(`https://api.stlouisfed.org/fred/series/observations?${params}`,{cache:"no-store"}),data=await response.json() as {error_message?:string;observations?:Array<{date:string;value:string}>};if(!response.ok)throw new Error(data.error_message||`FRED request failed (${response.status})`);const observations=(data.observations||[]).filter(item=>item.value!=="."&&Number.isFinite(Number(item.value))),latest=observations[0],previous=observations[1];return{...definition,status:latest?"available":"unavailable",value:latest?Number(latest.value):null,date:latest?.date||null,previous:previous?Number(previous.value):null,change:latest&&previous?Number(latest.value)-Number(previous.value):null}}catch(error){return{...definition,status:"unavailable",value:null,date:null,previous:null,change:null,error:error instanceof Error?error.message:"FRED request failed"}}}));
  return Response.json({status:"connected",provider:"FRED",asOf:new Date().toISOString(),series,disclaimer:"FRED series have different publication schedules and may be revised. Observation dates are shown individually."},{headers:{"Cache-Control":"private, max-age=900"}});
}
