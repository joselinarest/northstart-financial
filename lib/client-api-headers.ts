export function authenticatedApiHeaders(accessToken:string,includeJson=false):HeadersInit{
 const householdId=typeof window!=="undefined"?window.localStorage.getItem("northstar-household-id"):null;
 return {
  ...(includeJson?{"Content-Type":"application/json"}:{}),
  ...(accessToken?{Authorization:`Bearer ${accessToken}`} : {}),
  ...(householdId?{"X-Household-ID":householdId}:{}),
 };
}
