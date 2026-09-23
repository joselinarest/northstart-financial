export const GLOBAL_DEFAULTS={currency:"USD",locale:"en-US",timezone:"America/New_York",marketTimezone:"America/New_York",timeFormat:"12h",theme:"system",landingPage:"daily-action-plan",accountSelection:"last",defaultAccountId:"",showPremarket:true,showAfterHours:true,holidayCalendar:"EXCHANGE",morningReview:"08:30",preCloseReview:"15:30",afterCloseReview:"16:05",quoteFreshnessSeconds:60,fundamentalFreshnessDays:7,newsLookbackDays:7,chartTimeframe:"1D",chartIndicators:"SMA,Volume",refreshOnMaterialEvents:true};
export type GlobalSettings=typeof GLOBAL_DEFAULTS;
export function validateGlobalSettings(raw:unknown):GlobalSettings{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Settings must be an object");
  if(Object.keys(raw).some(k=>!(k in GLOBAL_DEFAULTS)))throw Error("Unknown setting");
  const result={...GLOBAL_DEFAULTS,...raw} as GlobalSettings;
  for(const key of Object.keys(GLOBAL_DEFAULTS) as (keyof GlobalSettings)[])if(typeof result[key]!==typeof GLOBAL_DEFAULTS[key])throw Error("Invalid setting: "+key);
  new Intl.DateTimeFormat(result.locale,{timeZone:result.timezone});
  if(result.marketTimezone!=="America/New_York"||result.holidayCalendar!=="EXCHANGE"||result.currency!=="USD")throw Error("U.S. exchange timezone/calendar and USD are required by this market engine");
  if(!["12h","24h"].includes(result.timeFormat)||!["system","light","dark"].includes(result.theme)||!["last","all","default"].includes(result.accountSelection))throw Error("Invalid display preference");
  if(!["daily-action-plan","portfolio","accounts","notifications"].includes(result.landingPage))throw Error("Invalid landing page");
  for(const key of ["morningReview","preCloseReview","afterCloseReview"] as const)if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(result[key]))throw Error("Invalid review time");
  if([result.quoteFreshnessSeconds,result.fundamentalFreshnessDays,result.newsLookbackDays].some(v=>!Number.isFinite(v)))throw Error("Freshness settings must be finite numbers");
  if(result.quoteFreshnessSeconds<1||result.quoteFreshnessSeconds>300||result.fundamentalFreshnessDays<1||result.fundamentalFreshnessDays>90||result.newsLookbackDays<1||result.newsLookbackDays>30)throw Error("Freshness settings outside supported bounds");
  return result;
}
