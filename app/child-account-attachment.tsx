"use client";

import { useEffect, useMemo, useState } from "react";

type Row = Record<string, any>;

const requestHeaders = (accessToken?: string) => ({
  "Content-Type": "application/json",
  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  ...(localStorage.getItem("northstar-household-id")
    ? { "X-Household-ID": localStorage.getItem("northstar-household-id")! }
    : {}),
});

function template(goal: Row, child: Row) {
  const year = new Date().getFullYear();
  const years =
    goal.goal_type === "EDUCATION"
      ? Math.max(0, Number(child.expected_college_start_year || year) - year)
      : Math.max(5, Number(goal.target_age || 30) - Number(child.age || 0));
  if (goal.goal_type === "FUTURE_WEALTH")
    return { name: "Long-term child growth", us: 65, international: 20, bonds: 10, cash: 5, years };
  if (years >= 12) return { name: "Education growth", us: 65, international: 15, bonds: 15, cash: 5, years };
  if (years >= 8) return { name: "Education balanced growth", us: 55, international: 15, bonds: 25, cash: 5, years };
  if (years >= 5) return { name: "Education transition", us: 40, international: 15, bonds: 30, cash: 15, years };
  if (years >= 3) return { name: "Education preservation", us: 25, international: 10, bonds: 45, cash: 20, years };
  return { name: "Near-term tuition reserve", us: 5, international: 0, bonds: 45, cash: 50, years };
}

export default function ChildAccountAttachment({ accessToken }: { accessToken?: string }) {
  const [children, setChildren] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [childId, setChildId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState("Loading child-designated accounts…");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setStatus("Loading child-designated accounts…");
    try {
      const headers = requestHeaders(accessToken);
      const [planResponse, financeResponse] = await Promise.all([
        fetch("/api/kids-planning", { headers, cache: "no-store", signal: AbortSignal.timeout(15000) }),
        fetch("/api/connections/plaid", { headers, cache: "no-store", signal: AbortSignal.timeout(15000) }),
      ]);
      const plan = await planResponse.json();
      const finance = await financeResponse.json();
      if (!planResponse.ok) throw new Error(plan.error || "Child plans unavailable");
      if (!financeResponse.ok) throw new Error(finance.error || "Investment accounts unavailable");
      const childRows = Array.isArray(plan.children) ? plan.children : [];
      const investmentRows = (Array.isArray(finance.accounts) ? finance.accounts : []).filter(
        (account: Row) =>
          account.type === "investment" ||
          /investment|brokerage|ira|529|custodial/i.test(`${account.type || ""} ${account.subtype || ""}`),
      );
      setChildren(childRows);
      setAccounts(investmentRows);
      const firstChild = childRows[0];
      const firstGoal = firstChild?.goals?.[0];
      setChildId((value) => value || firstChild?.id || "");
      setGoalId((value) => value || firstGoal?.id || "");
      setAccountId((value) => value || investmentRows[0]?.id || "");
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Child account attachment unavailable");
    }
  };

  useEffect(() => { void load(); }, [accessToken]);
  const child = children.find((item) => String(item.id) === childId) || children[0];
  const goals = child?.goals || [];
  const goal = goals.find((item: Row) => String(item.id) === goalId) || goals[0];
  const allocation = useMemo(() => (goal && child ? template(goal, child) : null), [goal, child]);

  const attach = async () => {
    if (!goal?.id || !accountId) return;
    const selectedAccount = accounts.find((item) => String(item.id) === accountId);
    const accountText = `${selectedAccount?.name || ""} ${selectedAccount?.subtype || ""}`.toLowerCase();
    const accountStructure = /529/.test(accountText)
      ? "529"
      : /utma|ugma|custodial/.test(accountText)
        ? "UTMA_UGMA"
        : /roth/.test(accountText)
          ? "CUSTODIAL_ROTH_IRA"
          : /saving|cash/.test(accountText)
            ? "SAVINGS"
            : "PARENT_TAXABLE";
    setBusy(true);
    setStatus("Attaching account and recalculating the child plan…");
    try {
      const response = await fetch("/api/kids-planning", {
        method: "POST",
        headers: requestHeaders(accessToken),
        body: JSON.stringify({
          action: "LINK_ACCOUNT",
          goalId: goal.id,
          accountId,
          accountStructure,
          allocationPercent: 100,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Account could not be attached");
      setStatus(`✓ Account attached to ${child.nickname} · ${goal.name}. Recommendations recalculated.`);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Account could not be attached");
    } finally {
      setBusy(false);
    }
  };

  if (!children.length)
    return <section className="child-account-attachment empty"><b>Create the first child profile below</b><span>After the child and goal exist, imported or manual long-term accounts can be attached here.</span></section>;

  return (
    <section className="child-account-attachment">
      <header><span>ATTACH A CHILD INVESTMENT ACCOUNT</span><h2>Use one imported or manual portfolio for one specific child goal</h2></header>
      <div className="child-account-fields">
        <label>Child<select value={child?.id || ""} onChange={(event) => { const id = event.target.value; const next = children.find((item) => String(item.id) === id); setChildId(id); setGoalId(next?.goals?.[0]?.id || ""); }}>{children.map((item) => <option key={item.id} value={item.id}>{item.nickname}</option>)}</select></label>
        <label>Goal<select value={goal?.id || ""} onChange={(event) => setGoalId(event.target.value)}>{goals.map((item: Row) => <option key={item.id} value={item.id}>{item.name} · {String(item.goal_type).replaceAll("_", " ")}</option>)}</select></label>
        <label>Imported or manual account<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Choose account…</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.nickname || item.name} · {item.subtype || item.type}</option>)}</select></label>
        <button type="button" disabled={busy || !goal?.id || !accountId} onClick={attach}>{busy ? "Attaching…" : "Attach to child goal"}</button>
      </div>
      {allocation && <section className="child-template-preview"><div><small>Suggested portfolio template</small><b>{allocation.name}</b><span>{allocation.years} years until modeled goal</span></div><dl><div><dt>U.S. equity</dt><dd>{allocation.us}%</dd></div><div><dt>International</dt><dd>{allocation.international}%</dd></div><div><dt>Bonds</dt><dd>{allocation.bonds}%</dd></div><div><dt>Cash / stable</dt><dd>{allocation.cash}%</dd></div></dl><p>Suggestion only. Northstar recalculates using this child, goal date, linked balance, contributions and household affordability; it never places trades.</p></section>}
      {status && <p className="child-account-status">{status}</p>}
    </section>
  );
}
