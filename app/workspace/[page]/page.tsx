import { NorthstarWorkspace } from "@/app/northstar-workspace";
import { redirect } from "next/navigation";

const tabs: Record<string,string> = {
  dashboard:"Dashboard", accounts:"Accounts", markets:"Daily Action Plan", portfolio:"Portfolio", "cash-flow":"Bills & cards",
  opportunities:"Daily Action Plan", debt:"Liabilities", household:"Household",
  assistant:"Ask Northstar", planner:"Prepare Trade", simulation:"Paper Simulator", journal:"Journal",
  "daily-action-plan":"Daily Action Plan",
  academy:"Learn", settings:"Settings", help:"Help", charts:"Professional Charts",
  "market-news":"Market News", growth:"Growth Finder", "dividend-growth":"Growth Finder", "new-candidates":"New Candidates",
  "real-estate":"Real Estate", "investment-account":"Accounts", "security-detail":"Professional Charts",
  options:"Daily Action Plan", "options-detail":"Daily Action Plan", transactions:"Bills & cards", spending:"Bills & cards",
  budgets:"Bills & cards", notifications:"Settings", "kids-goals":"Kids / Goals", "system-health":"Settings",
};

export default async function WorkspacePage({ params }: { params: Promise<{page:string}> }) {
  const { page } = await params;
  if(page === "planner") redirect("/workspace/daily-action-plan");
  return <NorthstarWorkspace initialTab={tabs[page] || "Dashboard"} />;
}
