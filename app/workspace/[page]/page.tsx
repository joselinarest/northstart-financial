import Home from "@/app/page";

const tabs: Record<string,string> = {
  dashboard:"Dashboard", accounts:"Accounts", markets:"Market Intel", portfolio:"Portfolio", "cash-flow":"Bills & cards",
  opportunities:"Scanner", debt:"Liabilities", household:"Household",
  assistant:"Ask Northstar", planner:"Prepare Trade", simulation:"Paper Simulator", journal:"Journal",
  academy:"Learn", settings:"Settings", help:"Help", charts:"Professional Charts",
  "market-news":"Market News", growth:"Growth Finder",
};

export default async function WorkspacePage({ params }: { params: Promise<{page:string}> }) {
  const { page } = await params;
  return <Home initialTab={tabs[page] || "Dashboard"} />;
}
