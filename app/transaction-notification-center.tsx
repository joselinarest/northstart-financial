"use client";
import { useEffect, useState } from "react";
type Props = { accessToken: string };
type Account = Record<string, any> & { id: string; name: string };
const headers = (token: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});
const parse = (value: any) =>
  typeof value === "string"
    ? (() => {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      })()
    : value || {};
export default function TransactionNotificationCenter({ accessToken }: Props) {
  const [data, setData] = useState<any>(null),
    [history, setHistory] = useState<any[]>([]),
    [notice, setNotice] = useState(
      "Loading transaction notification controls…",
    );
  const load = async () => {
    try {
      const [p, h] = await Promise.all([
          fetch("/api/notifications/preferences", {
            headers: headers(accessToken),
            cache: "no-store",
          }),
          fetch("/api/notifications/history?limit=50", {
            headers: headers(accessToken),
            cache: "no-store",
          }),
        ]),
        preferences = await p.json(),
        events = await h.json();
      if (!p.ok)
        throw new Error(preferences.error || "Preferences unavailable");
      setData(preferences);
      setHistory(h.ok ? events.notifications || [] : []);
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Notification controls unavailable",
      );
    }
  };
  useEffect(() => {
    load();
  }, [accessToken]);
  const save = async (body: Record<string, unknown>) => {
    setNotice("Saving…");
    try {
      const response = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: headers(accessToken),
          body: JSON.stringify(body),
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error || "Save failed");
      await load();
      setNotice("✓ Notification preferences saved");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Preferences could not be saved",
      );
    }
  };
  const updateHistory = async (
    alertId: string,
    action: "READ" | "DISMISSED",
  ) => {
    await fetch("/api/notifications/history", {
      method: "PATCH",
      headers: headers(accessToken),
      body: JSON.stringify({ alertId, action }),
    });
    await load();
  };
  if (!data)
    return (
      <section className="transaction-notification-center">
        <p>{notice}</p>
      </section>
    );
  const global = data.global || {},
    filters = parse(global.transaction_filters_json),
    quiet = parse(global.quiet_hours_json),
    fallback = parse(global.fallback_json),
    globalBody = (patch: Record<string, unknown>) => ({
      inAppEnabled: global.in_app_enabled !== false,
      pushEnabled: Boolean(global.browser_push_enabled),
      emailEnabled: Boolean(global.email_enabled),
      transactionMode: global.transaction_mode || "MATERIAL",
      minimumAmountCents: Number(global.minimum_amount_cents || 0),
      timezone:
        global.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      filters,
      quietHours: quiet,
      suspiciousOverride: global.suspicious_override !== false,
      fallback,
      ...patch,
    });
  return (
    <section className="transaction-notification-center">
      <header>
        <div>
          <span>REAL-TIME TRANSACTION NOTIFICATIONS</span>
          <h3>Know when money moves</h3>
          <p>
            Immediate, deduplicated transaction events with account controls,
            quiet hours and safety overrides.
          </p>
        </div>
        <b>
          {history.length}
          <small>recent delivery records</small>
        </b>
      </header>
      <div className="notification-config-health">
        {Object.entries(data.configuration || {}).map(([key, value]) => (
          <span className={value ? "ready" : "missing"} key={key}>
            {value ? "✓" : "!"} {key} {value ? "ready" : "needs configuration"}
          </span>
        ))}
      </div>
      <div className="transaction-notification-global">
        <label>
          Alert mode
          <select
            value={global.transaction_mode || "MATERIAL"}
            onChange={(e) =>
              save(globalBody({ transactionMode: e.target.value }))
            }
          >
            <option value="EVERY_TRANSACTION">
              Every transaction · immediate
            </option>
            <option value="MATERIAL">Filtered/material events</option>
            <option value="OFF">Off except suspicious override</option>
          </select>
        </label>
        <label>
          Minimum amount
          <input
            type="number"
            min="0"
            step="1"
            value={Number(global.minimum_amount_cents || 0) / 100}
            onChange={(e) =>
              setData({
                ...data,
                global: {
                  ...global,
                  minimum_amount_cents: Math.round(
                    Number(e.target.value || 0) * 100,
                  ),
                },
              })
            }
            onBlur={(e) =>
              save(
                globalBody({
                  minimumAmountCents: Math.round(
                    Number(e.target.value || 0) * 100,
                  ),
                }),
              )
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={global.in_app_enabled !== false}
            onChange={(e) =>
              save(globalBody({ inAppEnabled: e.target.checked }))
            }
          />{" "}
          In-app
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(global.browser_push_enabled)}
            disabled={!data.configuration?.push}
            onChange={(e) =>
              save(globalBody({ pushEnabled: e.target.checked }))
            }
          />{" "}
          Push
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(global.email_enabled)}
            disabled={!data.configuration?.email}
            onChange={(e) =>
              save(globalBody({ emailEnabled: e.target.checked }))
            }
          />{" "}
          Email
        </label>
        <label>
          <input
            type="checkbox"
            checked={global.suspicious_override !== false}
            onChange={(e) =>
              save(globalBody({ suspiciousOverride: e.target.checked }))
            }
          />{" "}
          Suspicious alerts override quiet/off
        </label>
      </div>
      <div className="transaction-filter-grid">
        <b>Filtered mode</b>
        {[
          ["expensesOnly", "Expenses only"],
          ["depositsOnly", "Deposits only"],
          ["foreignOnly", "Foreign only"],
          ["newMerchantsOnly", "New merchants only"],
          ["suspiciousOnly", "Suspicious only"],
          ["largeOnly", "Large transactions only"],
          ["recurringOnly", "Recurring/subscription changes only"],
          ["atmOnly", "ATM withdrawals only"],
          ["feesOnly", "Fees only"],
          ["duplicatesOnly", "Possible duplicates only"],
        ].map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={Boolean(filters[key])}
              onChange={(e) =>
                save(
                  globalBody({
                    filters: { ...filters, [key]: e.target.checked },
                  }),
                )
              }
            />
            {label}
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={Boolean(quiet.enabled)}
            onChange={(e) =>
              save(
                globalBody({
                  quietHours: { ...quiet, enabled: e.target.checked },
                }),
              )
            }
          />{" "}
          Quiet hours
        </label>
        <label>
          From
          <input
            type="time"
            value={quiet.start || "22:00"}
            onChange={(e) =>
              save(
                globalBody({ quietHours: { ...quiet, start: e.target.value } }),
              )
            }
          />
        </label>
        <label>
          Until
          <input
            type="time"
            value={quiet.end || "07:00"}
            onChange={(e) =>
              save(
                globalBody({ quietHours: { ...quiet, end: e.target.value } }),
              )
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(fallback.pushToEmail)}
            onChange={(e) =>
              save(
                globalBody({
                  fallback: { ...fallback, pushToEmail: e.target.checked },
                }),
              )
            }
          />{" "}
          Push failure → email
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(fallback.emailToInApp)}
            onChange={(e) =>
              save(
                globalBody({
                  fallback: { ...fallback, emailToInApp: e.target.checked },
                }),
              )
            }
          />{" "}
          Email failure → in-app
        </label>
      </div>
      <div className="transaction-account-preferences">
        {(data.accounts || []).map((account: Account) => {
          const channels = parse(account.channels_json),
            accountFilters = parse(account.filters_json);
          return (
            <article key={account.id}>
              <span>
                <b>
                  {account.institution_name || "Manual"} · {account.name}
                </b>
                <small>
                  {account.mask
                    ? `•••• ${account.mask}`
                    : "No account number displayed"}
                </small>
              </span>
              <select
                aria-label={`${account.name} notification mode`}
                value={account.transaction_mode || "INHERIT"}
                onChange={(e) =>
                  save({
                    accountId: account.id,
                    enabled: account.enabled !== false,
                    transactionMode: e.target.value,
                    channels,
                    minimumAmountCents: account.minimum_amount_cents,
                    filters: accountFilters,
                  })
                }
              >
                <option value="INHERIT">Use global setting</option>
                <option value="EVERY_TRANSACTION">Every transaction</option>
                <option value="MATERIAL">Filtered/material only</option>
                <option value="OFF">Off</option>
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={account.enabled !== false}
                  onChange={(e) =>
                    save({
                      accountId: account.id,
                      enabled: e.target.checked,
                      transactionMode: account.transaction_mode || "INHERIT",
                      channels,
                      minimumAmountCents: account.minimum_amount_cents,
                      filters: accountFilters,
                    })
                  }
                />
                Enabled
              </label>
              <details className="account-notification-options">
                <summary>Account channels and filters</summary>
                <div>
                  <label>
                    Minimum amount
                    <input
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={
                        Number(account.minimum_amount_cents || 0) / 100
                      }
                      onBlur={(e) =>
                        save({
                          accountId: account.id,
                          enabled: account.enabled !== false,
                          transactionMode:
                            account.transaction_mode || "INHERIT",
                          channels,
                          minimumAmountCents: Math.round(
                            Number(e.target.value || 0) * 100,
                          ),
                          filters: accountFilters,
                        })
                      }
                    />
                  </label>
                  {[
                    ["inApp", "In-app"],
                    ["push", "Push"],
                    ["email", "Email"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={channels[key] !== false}
                        onChange={(e) =>
                          save({
                            accountId: account.id,
                            enabled: account.enabled !== false,
                            transactionMode:
                              account.transaction_mode || "INHERIT",
                            channels: { ...channels, [key]: e.target.checked },
                            minimumAmountCents: account.minimum_amount_cents,
                            filters: accountFilters,
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                  {[
                    ["expensesOnly", "Expenses"],
                    ["depositsOnly", "Deposits"],
                    ["foreignOnly", "Foreign"],
                    ["newMerchantsOnly", "New merchants"],
                    ["suspiciousOnly", "Suspicious"],
                    ["largeOnly", "Large transactions"],
                    ["recurringOnly", "Recurring/subscription changes"],
                    ["atmOnly", "ATM withdrawals"],
                    ["feesOnly", "Fees"],
                    ["duplicatesOnly", "Possible duplicates"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={Boolean(accountFilters[key])}
                        onChange={(e) =>
                          save({
                            accountId: account.id,
                            enabled: account.enabled !== false,
                            transactionMode:
                              account.transaction_mode || "INHERIT",
                            channels,
                            minimumAmountCents: account.minimum_amount_cents,
                            filters: {
                              ...accountFilters,
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                      {label} only
                    </label>
                  ))}
                </div>
              </details>
            </article>
          );
        })}
      </div>
      <div className="transaction-notification-history">
        <h4>Notification history</h4>
        {history.map((row) => {
          const snapshot = parse(row.snapshot_json);
          return (
            <article key={`${row.event_id}-${row.channel || "alert"}`}>
              <a
                href={snapshot.deepLink || "/workspace/accounts"}
                onClick={() => updateHistory(row.alert_id, "READ")}
              >
                <span>
                  <b>{row.title}</b>
                  <small>
                    {new Date(row.created_at).toLocaleString()} ·{" "}
                    {row.event_type.replaceAll("_", " ")} ·{" "}
                    {snapshot.institution}{" "}
                    {snapshot.mask ? `•••• ${snapshot.mask}` : ""}
                  </small>
                </span>
                <em>
                  {row.channel || "IN-APP"} · {row.delivery_status || "QUEUED"}
                </em>
              </a>
              <button
                onClick={() => updateHistory(row.alert_id, "DISMISSED")}
                aria-label={`Dismiss ${row.title}`}
              >
                Dismiss
              </button>
            </article>
          );
        })}
        {!history.length && (
          <p>No transaction notification has been generated yet.</p>
        )}
      </div>
      {notice && (
        <p className="transaction-notification-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
