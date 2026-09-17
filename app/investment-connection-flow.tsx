"use client";

import { useState } from "react";

export type ManualInvestmentAccountDraft = { alias: string; accountType: string; purpose: string; owner: string; cashBalance: number };
type BusyProps = { busy: boolean };

export function InvestmentAccountConnectButton({ busy, onConnect }: BusyProps & { onConnect: () => void }) {
  return <button className="primary" type="button" disabled={busy} onClick={onConnect}>{busy ? "Connecting…" : "+ Investment Account"}</button>;
}

export function InvestmentConnectionFlow({ busy, onConnectBank, onConnectInvestment, onAddManual }: BusyProps & { onConnectBank: () => void; onConnectInvestment: () => void; onAddManual: () => void }) {
  return <div className="investment-connection-flow"><p><b>Connect investment accounts</b><span>Securely connect supported brokerage and retirement accounts through Plaid.</span></p><div className="plaid-connect-actions"><button type="button" disabled={busy} onClick={onConnectBank}>{busy ? "Connecting…" : "+ Bank, Card or Loan"}</button><InvestmentAccountConnectButton busy={busy} onConnect={onConnectInvestment}/><button type="button" disabled={busy} onClick={onAddManual}>Add Investment Account Manually</button></div></div>;
}

export function InvestmentConnectionRecoveryActions({ institutionName, busy, onRetry, onViewIssue, onAddManual }: BusyProps & { institutionName: string; onRetry: () => void; onViewIssue: () => void; onAddManual: () => void }) {
  return <div className="investment-recovery-actions"><button type="button" disabled={busy} onClick={onRetry}>Retry {institutionName}</button><button type="button" onClick={onViewIssue}>View connection issue</button><button type="button" onClick={onAddManual}>Add {institutionName} manually</button></div>;
}

export function InvestmentConnectionError({ institutionName, errorCode, supportReference, message, occurredAt, busy, onRetry, onAddManual }: BusyProps & { institutionName: string; errorCode?: string; supportReference?: string; message?: string; occurredAt?: string; onRetry: () => void; onAddManual: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return <section className="investment-connection-error" aria-live="polite"><div><span>INVESTMENT CONNECTION RECOVERY</span><h3>{institutionName} connection issue</h3><p>Plaid could not complete this {institutionName} investment connection.</p></div><InvestmentConnectionRecoveryActions institutionName={institutionName} busy={busy} onRetry={onRetry} onViewIssue={() => setExpanded(value => !value)} onAddManual={onAddManual}/>{expanded && <div className="investment-connection-error-detail"><p>{message || "The provider did not complete the investment connection."}</p><small>{errorCode ? `Error ${errorCode} · ` : ""}{occurredAt ? `Last attempt ${new Date(occurredAt).toLocaleString()} · ` : ""}support reference {supportReference || "not available"}</small></div>}</section>;
}

export function ManualInvestmentAccountForm({ institutionName, value, busy, onChange, onSubmit }: BusyProps & { institutionName?: string; value: ManualInvestmentAccountDraft; onChange: (value: ManualInvestmentAccountDraft) => void; onSubmit: () => void }) {
  const provider = institutionName?.trim(), update = (change: Partial<ManualInvestmentAccountDraft>) => onChange({ ...value, ...change });
  return <section className="manual-investment-account" id="manual-investment-account"><header><div><span>MANUAL INVESTMENT ACCOUNT · NOT PLAID-SYNCHRONIZED</span><h3>{provider ? `Add ${provider} manually` : "Add Investment Account Manually"}</h3><p>Use manual entry when an institution is unavailable. Northstar keeps investments separate from bank, credit, and loan activity.</p></div></header><div><label>Account alias<input value={value.alias} maxLength={80} placeholder="Example: Household Roth IRA" onChange={event => update({ alias: event.target.value })}/></label><label>Account type<select value={value.accountType} onChange={event => update({ accountType: event.target.value })}>{["Taxable brokerage","401(k)","Traditional IRA","Roth IRA","SEP IRA","Custodial investment","Other investment"].map(option => <option key={option}>{option}</option>)}</select></label><label>Owner<input value={value.owner} placeholder="Account owner" onChange={event => update({ owner: event.target.value })}/></label><label>Cash balance $<input type="number" min="0" step="0.01" value={value.cashBalance} onChange={event => update({ cashBalance: Number(event.target.value) })}/></label><label>What is it for?<select value={value.purpose} onChange={event => update({ purpose: event.target.value })}>{["Swing","Options","Long-term","Retirement","Dividend income","Mixed"].map(option => <option key={option}>{option}</option>)}</select></label><button type="button" disabled={busy || !value.alias.trim()} onClick={onSubmit}>{busy ? "Creating…" : provider ? `Add ${provider} manually` : "Add investment account"}</button></div><footer>Manual accounts depend on the balances and holdings you enter. Market prices can refresh, but quantities and transactions do not update automatically.</footer></section>;
}
