import {providerSignal} from "@/lib/work-budget";
export type CatalystEvent = {
  kind: "EARNINGS" | "NEWS" | "MACRO" | "OTHER";
  label: string;
  date?: string | null;
  daysAway?: number | null;
  adverse?: boolean;
  material?: boolean;
};

export type CatalystContext = {
  available: boolean;
  provider: string;
  asOf: string | null;
  events: CatalystEvent[];
  recentNewsCount: number;
  adverseNewsCount: number;
};

const adversePattern = /cut|miss|downgrade|investigation|lawsuit|decline|weak|warning|delay|cancel|fraud|probe|guidance lowered|recall|bankrupt/i;
const materialPattern = /earnings|guidance|forecast|acquisition|merger|antitrust|lawsuit|investigation|recall|approval|contract|partnership|ceo|cfo|bankrupt|cyber|tariff|regulat|downgrade|upgrade|dividend|buyback/i;
const day = 86400000;
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const daysUntil = (value: string) => Math.ceil((new Date(`${value}T12:00:00Z`).getTime() - Date.now()) / day);

export async function loadCatalystContext(symbol: string): Promise<CatalystContext> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return { available: false, provider: "FINNHUB_NOT_CONFIGURED", asOf: null, events: [], recentNewsCount: 0, adverseNewsCount: 0 };
  const today = new Date(), from = new Date(Date.now() - 7 * day), to = new Date(Date.now() + 120 * day), base = "https://finnhub.io/api/v1";
  const get = async (path: string) => {
    const response = await fetch(`${base}${path}`, { headers: { "X-Finnhub-Token": token }, cache: "no-store", signal: providerSignal(10000) });
    if (!response.ok) throw new Error(`FINNHUB_${response.status}`);
    return response.json();
  };
  try {
    const [newsRaw, earningsRaw] = await Promise.all([
      get(`/company-news?symbol=${symbol}&from=${dateOnly(from)}&to=${dateOnly(today)}`),
      get(`/calendar/earnings?symbol=${symbol}&from=${dateOnly(today)}&to=${dateOnly(to)}`),
    ]);
    const news = Array.isArray(newsRaw) ? newsRaw : [], earnings = Array.isArray(earningsRaw?.earningsCalendar) ? earningsRaw.earningsCalendar : [];
    const recent = news.filter((item: Record<string, unknown>) => Number(item.datetime || 0) * 1000 >= Date.now() - 72 * 3600000);
    const events: CatalystEvent[] = [];
    for (const item of recent.slice(0, 12)) {
      const text = `${item.headline || ""} ${item.summary || ""}`;
      if (materialPattern.test(text)) events.push({ kind: "NEWS", label: String(item.headline || "Material company news"), date: Number(item.datetime || 0) ? new Date(Number(item.datetime) * 1000).toISOString() : null, daysAway: null, adverse: adversePattern.test(text), material: true });
    }
    for (const item of earnings.slice(0, 3)) {
      const date = String(item.date || "");
      if (date) events.push({ kind: "EARNINGS", label: `Earnings scheduled ${date}`, date, daysAway: daysUntil(date), material: true });
    }
    return { available: true, provider: "FINNHUB", asOf: new Date().toISOString(), events, recentNewsCount: recent.length, adverseNewsCount: events.filter(event => event.kind === "NEWS" && event.adverse).length };
  } catch (error) {
    return { available: false, provider: error instanceof Error ? error.message : "CATALYST_PROVIDER_ERROR", asOf: null, events: [], recentNewsCount: 0, adverseNewsCount: 0 };
  }
}

export function evaluateCatalystEntryGate(context: CatalystContext, input: { mode: "SHARES" | "OPTIONS"; contractDte?: number; allowEventTrade?: boolean }) {
  const blockers: string[] = [], confirmations: string[] = [];
  if (!context.available) blockers.push("Current company-news and earnings-calendar coverage is unavailable");
  if (context.adverseNewsCount) blockers.push(`${context.adverseNewsCount} recent adverse material news item${context.adverseNewsCount === 1 ? "" : "s"} require review`);
  const earnings = context.events.filter(event => event.kind === "EARNINGS" && event.daysAway != null && Number(event.daysAway) >= 0).sort((a, b) => Number(a.daysAway) - Number(b.daysAway))[0];
  if (earnings) {
    const days = Number(earnings.daysAway);
    if (input.mode === "SHARES" && days <= 2) blockers.push(`Earnings are in ${days} day${days === 1 ? "" : "s"}; wait for the report and price reaction`);
    if (input.mode === "OPTIONS" && days <= Number(input.contractDte || 0) && !input.allowEventTrade) blockers.push(`Earnings fall inside the option holding window (${days} days away); IV-crush and gap risk are not authorized`);
    confirmations.push(earnings.label);
  } else if (context.available) confirmations.push("No scheduled earnings were found in the provider window");
  if (context.available && !context.adverseNewsCount) confirmations.push("No recent adverse material company news was detected");
  const pass = blockers.length === 0;
  return { pass, status: pass ? "CLEAR" as const : context.available ? "BLOCKED" as const : "UNAVAILABLE" as const, blockers, confirmations, asOf: context.asOf, provider: context.provider, nextEvent: earnings || null, summary: pass ? "Catalyst risk was checked and no blocking event was found." : `WAIT FOR CATALYST — ${blockers.join("; ")}.` };
}