import Home from "@/app/page";

export default async function InvestmentResearchPage({ params }: { params: Promise<{symbol:string}> }) {
  const { symbol } = await params;
  const investmentId = decodeURIComponent(symbol).toUpperCase();
  return <Home initialTab="Market Intel" initialInvestmentId={investmentId} focusInvestmentAnalysis />;
}
