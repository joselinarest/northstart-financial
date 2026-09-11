import { NorthstarWorkspace } from "@/app/northstar-workspace";

export default async function InvestmentResearchPage({ params }: { params: Promise<{symbol:string}> }) {
  const { symbol } = await params;
  const investmentId = decodeURIComponent(symbol).toUpperCase();
  return <NorthstarWorkspace initialTab="Market Intel" initialInvestmentId={investmentId} focusInvestmentAnalysis />;
}
