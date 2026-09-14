export const metadata = { title: "Offline — Northstar" };

export default function OfflinePage() {
  return <main className="northstar-offline"><section><div aria-hidden="true">N</div><span>NORTHSTAR</span><h1>You’re offline</h1><p>Live balances, transactions, property data, alerts, and market prices require a secure connection. Northstar has not stored private financial data for offline use.</p><a href="/">Reconnect, then reload</a><small>Your authenticated session remains protected.</small></section></main>;
}
