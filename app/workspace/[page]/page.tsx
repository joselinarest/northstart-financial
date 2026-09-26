import { NorthstarWorkspace } from "@/app/northstar-workspace";
import { redirect } from "next/navigation";

const tabs: Record<string,string> = {
  dashboard:"Dashboard", accounts:"Accounts", markets:"Trading", portfolio:"Portfolio", "cash-flow":"Bills & cards",
  opportunities:"Trading", debt:"Liabilities", household:"Household",
  assistant:"Ask Northstar", planner:"Prepare Trade", simulation:"Paper Simulator", journal:"Journal",
  trading:"Trading", "daily-action-plan":"Trading",
  academy:"Learn", settings:"Settings", help:"Help", charts:"Professional Charts",
  "market-news":"Market News", growth:"Growth Finder", "dividend-growth":"Growth Finder", "new-candidates":"New Candidates",
  "real-estate":"Real Estate", "investment-account":"Accounts", "security-detail":"Professional Charts",
  options:"Options Advisor", "options-detail":"Options Advisor", transactions:"Bills & cards", spending:"Bills & cards",
  budgets:"Bills & cards", notifications:"Alerts", "kids-goals":"Kids / Goals", "system-health":"Settings",
};

export default async function WorkspacePage({ params, searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>>; params: Promise<{page:string}> }) {
  const { page } = await params;

  if(page === 'daily-action-plan') { const query = new URLSearchParams(); for(const [key,value] of Object.entries(await searchParams)) { if(Array.isArray(value)) value.forEach(v=>query.append(key,v)); else if(value!==undefined) query.set(key,value); } redirect('/workspace/trading'+(query.size?'?'+query.toString():'')); }
  return <NorthstarWorkspace initialTab={tabs[page] || "Dashboard"} />;
}
