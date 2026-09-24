"use client";
import { useEffect, useMemo, useState } from "react";
import { analyzeProperty, PropertyAssumptions } from "@/lib/domain/real-estate";
import PropertyAccountManager from "@/app/property-account-manager";
import GoogleAddressAutocomplete from "@/app/google-address-autocomplete";
import { authenticatedApiHeaders } from "@/lib/client-api-headers";
import { useRealEstateAccessToken } from "@/app/real-estate-auth-context";
import { CurrencyInput } from "@/app/ui/currency-input";
const usd = (n: number) =>
    n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }),
  fields: Array<[keyof PropertyAssumptions, string, string]> = [
    ["price", "Purchase / asking price", "$"],
    ["closingCosts", "Closing costs", "$"],
    ["renovation", "Initial repairs", "$"],
    ["downPaymentPct", "Down payment", "%"],
    ["interestRatePct", "Interest rate", "%"],
    ["loanYears", "Loan term", "years"],
    ["monthlyRent", "Monthly rent", "$"],
    ["taxAnnual", "Annual taxes", "$"],
    ["insuranceAnnual", "Annual insurance", "$"],
    ["hoaMonthly", "Monthly HOA", "$"],
    ["utilitiesMonthly", "Owner-paid utilities", "$"],
    ["maintenancePct", "Maintenance reserve", "% rent"],
    ["managementPct", "Management", "% rent"],
    ["vacancyPct", "Vacancy", "%"],
    ["appreciationPct", "Appreciation model", "%"],
    ["targetCashOnCashPct", "Target cash return", "%"],
  ];
type Row = Record<string, any> & {
  id: string;
  entity_name?: string;
  address?: string;
  purchase_price_cents?: number;
  estimated_value_cents?: number;
  monthly_rent_cents?: number;
  monthly_expenses_cents?: number;
  property_type?: string;
};
type Tab = "My Properties" | "Opportunity Analyzer";
type PropertyInsight = {
  propertyId: string;
  estimatedValueCents: number;
  estimatedValueLowCents: number;
  estimatedValueHighCents: number;
  valuationSource: string;
  valuationConfidence: string;
  annualModelPct: number;
  monthlyPaymentCents: number;
  monthlyOperatingCents: number;
  monthlyRentCents: number;
  netHousingCostCents: number;
  paymentToIncomePct: number | null;
  projectedFreeCashCents: number;
  protectedReserveCents: number;
  liquidCashCents: number;
  debtCents: number;
  debtAvailable: boolean;
  status: "HEALTHY" | "WATCH" | "WARNING" | "CRITICAL";
  reason: string;
};
type PropertyForm = {
  name: string;
  address: string;
  propertyType: string;
  purchasePrice: number;
  estimatedValue: number;
  monthlyRent: number;
  monthlyExpenses: number;
  acquisitionDate: string;
  mortgageBalance: number;
  monthlyMortgagePayment: number;
};
export default function RealEstateWorkspace() {
  const [tab, setTab] = useState<Tab>("My Properties"),
    [properties, setProperties] = useState<Row[]>([]),
    [insights, setInsights] = useState<Record<string, PropertyInsight>>({}),
    [status, setStatus] = useState("Loading owned properties…"),
    [saving, setSaving] = useState(false),
    [form, setForm] = useState<PropertyForm>({
      name: "",
      address: "",
      propertyType: "PRIMARY_HOME",
      purchasePrice: 0,
      estimatedValue: 0,
      monthlyRent: 0,
      monthlyExpenses: 0,
      acquisitionDate: "",
      mortgageBalance: 0,
      monthlyMortgagePayment: 0,
    }),
    [editingId, setEditingId] = useState(""),
    [editForm, setEditForm] = useState<PropertyForm | null>(null),
    [p, setP] = useState<PropertyAssumptions>({
      price: 425000,
      closingCosts: 10000,
      renovation: 15000,
      downPaymentPct: 25,
      interestRatePct: 6.5,
      loanYears: 30,
      monthlyRent: 2850,
      taxAnnual: 4200,
      insuranceAnnual: 1800,
      hoaMonthly: 0,
      utilitiesMonthly: 0,
      maintenancePct: 8,
      managementPct: 8,
      vacancyPct: 6,
      appreciationPct: 3,
      targetCashOnCashPct: 8,
    }),
    a = useMemo(() => analyzeProperty(p), [p]);
  const accessToken = useRealEstateAccessToken();
  const load = async () => {
    try {
      const headers = authenticatedApiHeaders(accessToken),
        [r, insightResponse] = await Promise.all([
          fetch("/api/properties", { headers, cache: "no-store" }),
          fetch("/api/properties/insights", { headers }),
        ]),
        data = await r.json(),
        insightData = await insightResponse.json();
      if (!r.ok) throw new Error(data.error || "Properties unavailable");
      setProperties(Array.isArray(data) ? data : []);
      if (insightResponse.ok)
        setInsights(
          Object.fromEntries(
            (insightData.insights || []).map((item: PropertyInsight) => [
              item.propertyId,
              item,
            ]),
          ),
        );
      setStatus(
        data.length
          ? `${data.length} owned propert${data.length === 1 ? "y" : "ies"}`
          : "No property has been added yet.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Properties unavailable");
    }
  };
  useEffect(() => {
    void load();
  }, [accessToken]);
  const save = async () => {
    if (!form.name.trim()) return setStatus("Enter a property name.");
    if (!form.address.trim())
      return setStatus("Select or enter the complete property address.");
    setSaving(true);
    setStatus("Saving property…");
    try {
      const r = await fetch("/api/properties", {
          method: "POST",
          headers: authenticatedApiHeaders(accessToken, true),
          body: JSON.stringify({
            name: form.name,
            address: form.address,
            propertyType: form.propertyType,
            purchasePriceCents: Math.round(form.purchasePrice * 100),
            estimatedValueCents: Math.round(form.estimatedValue * 100),
            monthlyRentCents: Math.round(form.monthlyRent * 100),
            monthlyExpensesCents: Math.round(form.monthlyExpenses * 100),
            acquisitionDate: form.acquisitionDate || null,
            mortgageBalanceCents: Math.round(form.mortgageBalance * 100),
            monthlyMortgagePaymentCents: Math.round(form.monthlyMortgagePayment * 100),
          }),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error || "Property could not be saved");
      setForm({ ...form, name: "", address: "" });
      await load();
      setStatus("✓ Property added to the household portfolio.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Property could not be saved");
    } finally {
      setSaving(false);
    }
  };
  const beginEdit = (property: Row) => {
    setEditingId(property.id);
    setEditForm({
      name: String(property.entity_name || ""),
      address: String(property.address || ""),
      propertyType: String(property.property_type || "OTHER"),
      purchasePrice: Number(property.purchase_price_cents || 0) / 100,
      estimatedValue: Number(property.estimated_value_cents || 0) / 100,
      monthlyRent: Number(property.monthly_rent_cents || 0) / 100,
      monthlyExpenses: Number(property.monthly_expenses_cents || 0) / 100,
      acquisitionDate: String(property.acquisition_date || "").slice(0,10),
      mortgageBalance: Number(insights[property.id]?.debtCents || 0) / 100,
      monthlyMortgagePayment: Number(insights[property.id]?.monthlyPaymentCents || 0) / 100,
    });
  };
  const updateProperty = async () => {
    if (!editingId || !editForm) return;
    if (!editForm.name.trim()) return setStatus("Enter a property name.");
    if (!editForm.address.trim())
      return setStatus("Select or enter the complete property address.");
    setSaving(true);
    setStatus("Updating property…");
    try {
      const response = await fetch("/api/properties", {
          method: "PATCH",
          headers: authenticatedApiHeaders(accessToken, true),
          body: JSON.stringify({
            propertyId: editingId,
            ...editForm,
            purchasePriceCents: Math.round(editForm.purchasePrice * 100),
            estimatedValueCents: Math.round(editForm.estimatedValue * 100),
            monthlyRentCents: Math.round(editForm.monthlyRent * 100),
            monthlyExpensesCents: Math.round(editForm.monthlyExpenses * 100),
            acquisitionDate: editForm.acquisitionDate || null,
            mortgageBalanceCents: Math.round(editForm.mortgageBalance * 100),
            monthlyMortgagePaymentCents: Math.round(editForm.monthlyMortgagePayment * 100),
          }),
        }),
        result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Property could not be updated");
      setEditingId("");
      setEditForm(null);
      await load();
      setStatus("✓ Property details updated.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Property could not be updated",
      );
    } finally {
      setSaving(false);
    }
  };
  const portfolio = useMemo(
      () =>
        properties.map((x) => {
          const purchase = Number(x.purchase_price_cents || 0) / 100,
            value =
              Number(
                insights[x.id]?.estimatedValueCents ||
                  x.estimated_value_cents ||
                  x.purchase_price_cents ||
                  0,
              ) / 100,
            rent = Number(x.monthly_rent_cents || 0) / 100,
            expenses = Number(x.monthly_expenses_cents || 0) / 100,
            purpose = String(x.property_type || "OTHER").toUpperCase(),
            debt = Number(insights[x.id]?.debtCents || 0) / 100,
            equity = value - debt,
            equityChange = value - purchase,
            netRent = rent - expenses,
            grossYield = value ? ((rent * 12) / value) * 100 : 0;
          let action = "HOLD & MAINTAIN",
            reason =
              "Keep valuation, insurance, taxes, condition, and household affordability current.";
          if (/RENT|AIRBNB|VACATION_RENTAL/.test(purpose)) {
            if (netRent < 0) {
              action = "IMPROVE OR SELL REVIEW";
              reason = `Recorded rent is ${usd(Math.abs(netRent))}/mo below recorded operating expenses before financing. Verify occupancy, debt service, tax impact, and market value.`;
            } else if (grossYield >= 6) {
              action = "HOLD · RENTAL PERFORMING";
              reason = `Positive recorded operating spread of ${usd(netRent)}/mo and ${grossYield.toFixed(1)}% gross yield. Review lease, reserves, maintenance, and local market quarterly.`;
            } else {
              action = "HOLD · RETURN REVIEW";
              reason = `Positive operating spread, but ${grossYield.toFixed(1)}% gross yield may be modest relative to concentration and illiquidity. Compare after-tax return with alternatives.`;
            }
          } else if (/PRIMARY|LIVE/.test(purpose)) {
            action = "HOLD · HOME PLAN";
            reason = `This is a home, not a rental trade. Review housing affordability, mortgage, insurance, maintenance reserve, relocation horizon, and estimated ${equityChange >= 0 ? "gain" : "decline"} of ${usd(Math.abs(equityChange))}.`;
          } else if (value > 0 && purchase > 0 && value < purchase * 0.85) {
            action = "REVIEW PURPOSE & EXIT OPTIONS";
            reason =
              "Estimated value is materially below recorded purchase price. Verify the valuation before considering any sale or change of use.";
            return {
              ...x,
              purchase,
              value,
              rent,
              expenses,
              purpose,
              debt,
              equity,
              equityChange,
              netRent,
              grossYield,
              action,
              reason,
            };
          }
          return {
            ...x,
            purchase,
            value,
            rent,
            expenses,
            purpose,
            debt,
            equity,
            equityChange,
            netRent,
            grossYield,
            action,
            reason,
          };
        }),
    [properties, insights],
    ),
    totalValue = portfolio.reduce((s, x) => s + x.value, 0),
    totalRent = portfolio.reduce((s, x) => s + x.rent, 0),
    totalExpenses = portfolio.reduce((s, x) => s + x.expenses, 0);
  return (
    <section className="real-estate-workspace">
      <header className="card">
        <div>
          <span>REAL ESTATE · OWNED PROPERTY + OPPORTUNITIES</span>
          <h2>Property portfolio and decision center</h2>
          <p>
            Manage homes, rentals, vacation properties, and other real assets
            separately. Suggestions never submit offers, listings, loans, or
            transfers.
          </p>
        </div>
        <strong>
          {usd(totalValue)}
          <small>recorded property value</small>
        </strong>
      </header>
      <nav className="real-estate-tabs">
        {(["My Properties", "Opportunity Analyzer"] as Tab[]).map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </nav>
      {tab === "My Properties" && (
        <>
          <div className="property-kpis">
            <article>
              <small>Properties</small>
              <b>{portfolio.length}</b>
            </article>
            <article>
              <small>Monthly rent</small>
              <b>{usd(totalRent)}</b>
            </article>
            <article>
              <small>Recorded expenses</small>
              <b>{usd(totalExpenses)}</b>
            </article>
            <article>
              <small>Operating spread</small>
              <b
                className={
                  totalRent - totalExpenses >= 0 ? "positive" : "negative"
                }
              >
                {usd(totalRent - totalExpenses)}
              </b>
            </article>
          </div>
          <section className="property-portfolio">
            {portfolio.map((x) => (
              <details  key={x.id}>
                <summary>
                  <span>
                    <em>{x.purpose.replaceAll("_", " ")}</em>
                    <b>{x.entity_name || x.address || "Property"}</b>
                    <small>{x.address || "Address not recorded"}</small>
                  </span>
                  <strong>
                    {x.action}
                    <small>{x.value > 0 ? `${usd(x.value)} estimated current value` : "Current value unavailable"}</small>
                    <small>{x.value > 0 ? `${usd(x.equity)} estimated equity` : "Add a purchase price or verified valuation"}</small>
                    <button
                      type="button"
                      className="property-edit-trigger"
                      onClick={(event) => {
                        event.preventDefault();
                        beginEdit(x);
                      }}
                    >
                      Edit property
                    </button>
                  </strong>
                </summary>
                {editingId === x.id && editForm && (
                  <section className="property-edit-form">
                    <label>
                      Property name
                      <input
                        value={editForm.name}
                        onChange={(event) =>
                          setEditForm({ ...editForm, name: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Purpose
                      <select
                        value={editForm.propertyType}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            propertyType: event.target.value,
                          })
                        }
                      >
                        <option value="PRIMARY_HOME">Primary home</option>
                        <option value="LONG_TERM_RENTAL">Long-term rental</option>
                        <option value="SHORT_TERM_RENTAL">Short-term rental</option>
                        <option value="VACATION_HOME">Vacation home</option>
                        <option value="LAND">Land</option>
                        <option value="COMMERCIAL">Commercial</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </label>
                    <GoogleAddressAutocomplete
                      value={editForm.address}
                      required
                      onChange={(address) =>
                        setEditForm((current) =>
                          current ? { ...current, address } : current,
                        )
                      }
                    />
                    <label>
                      Purchase price
                      <CurrencyInput
                        value={editForm.purchasePrice}
                        onChange={(purchasePrice) =>
                          setEditForm({ ...editForm, purchasePrice })
                        }
                      />
                    </label>
                    <label>
                      Estimated value
                      <CurrencyInput
                        value={editForm.estimatedValue}
                        onChange={(estimatedValue) =>
                          setEditForm({ ...editForm, estimatedValue })
                        }
                      />
                    </label>
                    <label>Purchase date<input type="date" value={editForm.acquisitionDate} onChange={(event)=>setEditForm({...editForm,acquisitionDate:event.target.value})}/></label>
                    <label>Mortgage / loan payoff balance<CurrencyInput value={editForm.mortgageBalance} onChange={(mortgageBalance)=>setEditForm({...editForm,mortgageBalance})}/></label>
                    <label>Monthly mortgage / loan payment<CurrencyInput value={editForm.monthlyMortgagePayment} onChange={(monthlyMortgagePayment)=>setEditForm({...editForm,monthlyMortgagePayment})}/></label>
                    <label>
                      Monthly rent
                      <CurrencyInput
                        value={editForm.monthlyRent}
                        onChange={(monthlyRent) =>
                          setEditForm({ ...editForm, monthlyRent })
                        }
                      />
                    </label>
                    <label>
                      Monthly operating expenses
                      <CurrencyInput
                        value={editForm.monthlyExpenses}
                        onChange={(monthlyExpenses) =>
                          setEditForm({ ...editForm, monthlyExpenses })
                        }
                      />
                    </label>
                    <div className="property-edit-actions">
                      <button type="button" disabled={saving} onClick={updateProperty}>
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={saving}
                        onClick={() => {
                          setEditingId("");
                          setEditForm(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </section>
                )}
                <div>
                  <article>
                    <small>Purchase price</small>
                    <b>{usd(x.purchase)}</b>
                  </article>
                  <article>
                    <small>Estimated current value</small>
                    <b>{x.value > 0 ? usd(x.value) : "Needs valuation data"}</b>
                  </article>
                  <article>
                    <small>Mortgage / loan balance</small>
                    <b>{insights[x.id]?.debtAvailable ? usd(x.debt) : "Needs loan balance"}</b>
                  </article>
                  <article>
                    <small>Estimated equity</small>
                    <b className={x.equity > 0 ? "positive" : ""}>
                      {x.value > 0 && insights[x.id]?.debtAvailable ? usd(x.equity) : "Unavailable"}
                    </b>
                  </article>
                  <article>
                    <small>Value change since purchase</small>
                    <b
                      className={x.equityChange >= 0 ? "positive" : "negative"}
                    >
                      {usd(x.equityChange)}
                    </b>
                  </article>
                  <article>
                    <small>Monthly rent</small>
                    <b>{usd(x.rent)}</b>
                  </article>
                  <article>
                    <small>Operating expenses</small>
                    <b>{usd(x.expenses)}</b>
                  </article>
                  <article>
                    <small>Operating spread</small>
                    <b>{usd(x.netRent)}</b>
                  </article>
                  <article>
                    <small>Gross rental yield</small>
                    <b>{x.grossYield.toFixed(1)}%</b>
                  </article>
                </div>
                {insights[x.id] && (() => {
                  const insight = insights[x.id];
                  return <section className={`property-financial-insight ${insight.status.toLowerCase()}`}>
                    <header><div><span>AUTOMATIC VALUE + HOUSEHOLD PAYMENT CHECK</span><h3>{insight.status} · Current finances {insight.status === "HEALTHY" ? "support" : "require review of"} this property</h3></div><strong>{insight.estimatedValueCents > 0 ? usd(insight.estimatedValueCents / 100) : "Value unavailable"}<small>modeled current value</small></strong></header>
                    <div><article><small>Estimated value range</small><b>{insight.estimatedValueCents > 0 ? `${usd(insight.estimatedValueLowCents / 100)}–${usd(insight.estimatedValueHighCents / 100)}` : "Add purchase price or verified value"}</b><em>{insight.valuationSource} · {insight.valuationConfidence.toLowerCase()} confidence{insight.annualModelPct > 0 ? ` · ${insight.annualModelPct.toFixed(1)}% annual planning model` : ""}</em></article><article><small>Estimated equity</small><b>{insight.estimatedValueCents > 0&&insight.debtAvailable ? usd((insight.estimatedValueCents - insight.debtCents) / 100) : "Needs value and loan payoff"}</b><em>Current value minus linked or recorded mortgage payoff balance; negative equity is preserved</em></article><article><small>Current property debt</small><b>{insight.debtAvailable?usd(insight.debtCents / 100):"Loan balance not connected"}</b><em>Linked mortgage account balance takes priority over manually recorded debt</em></article><article><small>Monthly mortgage / loan payment</small><b>{insight.monthlyPaymentCents>0?usd(insight.monthlyPaymentCents / 100):"Payment not identified"}</b><em>Recorded loan schedule or observed linked mortgage payments</em></article><article><small>Net monthly property cost</small><b>{usd(insight.netHousingCostCents / 100)}</b><em>Payment + operating costs − recorded rent</em></article><article><small>Payment-to-income</small><b>{insight.paymentToIncomePct === null ? "Income history required" : `${insight.paymentToIncomePct.toFixed(1)}%`}</b><em>Uses the latest three months of household transactions</em></article><article><small>Projected household free cash</small><b>{usd(insight.projectedFreeCashCents / 100)}</b><em>After observed household outflow</em></article><article><small>Protected reserve / liquid cash</small><b>{usd(insight.protectedReserveCents / 100)} / {usd(insight.liquidCashCents / 100)}</b><em>Three-month spending reserve compared with connected cash</em></article></div>
                    <p><b>Why:</b> {insight.reason}</p><footer>The value is a planning model—not an appraisal or licensed AVM. Connect a property valuation provider or save a verified appraisal/snapshot to improve confidence. Payment analysis updates from synchronized household accounts and property-linked mortgage accounts.</footer>
                  </section>;
                })()}
                <p>
                  <b>Current suggestion:</b> {x.reason}
                </p>
                <footer>
                  Before BUY or SELL: verify current appraisal/comparables,
                  mortgage payoff, taxes, transaction costs, inspection,
                  insurance, lease/occupancy, local law, household cash
                  reserves, and intended holding period.
                </footer>
              </details>
            ))}
            {!portfolio.length && (
              <div className="property-empty">
                <b>Add the properties your household owns</b>
                <p>
                  Primary homes will be evaluated for household fit and
                  equity—not forced through rental rules. Rentals will include
                  cash-flow and return monitoring.
                </p>
              </div>
            )}
          </section>
          <section className="card property-add">
            <header>
              <span>ADD OWNED PROPERTY</span>
              <h3>Track a home, rental, or other property</h3>
              <p>{status}</p>
            </header>
            <div>
              <label>
                Name
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Phoenix home"
                />
              </label>
              <label>
                Purpose
                <select
                  value={form.propertyType}
                  onChange={(e) =>
                    setForm({ ...form, propertyType: e.target.value })
                  }
                >
                  <option value="PRIMARY_HOME">Primary home</option>
                  <option value="LONG_TERM_RENTAL">Long-term rental</option>
                  <option value="SHORT_TERM_RENTAL">Short-term rental</option>
                  <option value="VACATION_HOME">Vacation home</option>
                  <option value="LAND">Land</option>
                  <option value="COMMERCIAL">Commercial</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <GoogleAddressAutocomplete
                value={form.address}
                required
                onChange={(address) =>
                  setForm((current) => ({ ...current, address }))
                }
              />
              <label>
                Purchase price
                <CurrencyInput
                  value={form.purchasePrice}
                  onChange={(purchasePrice) =>
                    setForm({ ...form, purchasePrice })
                  }
                />
              </label>
              <label>
                Estimated value
                <CurrencyInput
                  value={form.estimatedValue}
                  onChange={(estimatedValue) =>
                    setForm({ ...form, estimatedValue })
                  }
                />
              </label>
              <label>Purchase date<input type="date" value={form.acquisitionDate} onChange={(event)=>setForm({...form,acquisitionDate:event.target.value})}/></label>
              <label>Mortgage / loan payoff balance<CurrencyInput value={form.mortgageBalance} onChange={(mortgageBalance)=>setForm({...form,mortgageBalance})}/></label>
              <label>Monthly mortgage / loan payment<CurrencyInput value={form.monthlyMortgagePayment} onChange={(monthlyMortgagePayment)=>setForm({...form,monthlyMortgagePayment})}/></label>
              <label>
                Monthly rent
                <CurrencyInput
                  value={form.monthlyRent}
                  onChange={(monthlyRent) =>
                    setForm({ ...form, monthlyRent })
                  }
                />
              </label>
              <label>
                Monthly operating expenses
                <CurrencyInput
                  value={form.monthlyExpenses}
                  onChange={(monthlyExpenses) =>
                    setForm({ ...form, monthlyExpenses })
                  }
                />
              </label>
              <button disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Add property"}
              </button>
            </div>
          </section>
        </>
      )}
      {tab === "My Properties" && (
        <PropertyAccountManager properties={properties} />
      )}
      {tab === "Opportunity Analyzer" && (
        <>
          <div className="real-estate-grid">
            <section className="card deal-inputs">
              <h3>Purchase assumptions</h3>
              <div>
                {fields.map(([key, title, suffix]) => (
                  <label key={key}>
                    {title}
                    <span>
                      {suffix === "$" ? (
                        <CurrencyInput
                          value={p[key]}
                          onChange={(value) => setP({ ...p, [key]: value })}
                          ariaLabel={title}
                        />
                      ) : (
                        <input
                          type="number"
                          value={p[key]}
                          onChange={(e) =>
                            setP({ ...p, [key]: Number(e.target.value) })
                          }
                        />
                      )}
                      {suffix !== "$" && <i>{suffix}</i>}
                    </span>
                  </label>
                ))}
              </div>
            </section>
            <section className="card deal-decision">
              <span>CONCISE PURCHASE DECISION</span>
              <h3>PROPERTY — {a.action}</h3>
              <dl>
                <div>
                  <dt>Maximum modeled offer</dt>
                  <dd>{usd(a.maxOffer)}</dd>
                </div>
                <div>
                  <dt>Monthly cash flow</dt>
                  <dd
                    className={a.monthlyCashFlow >= 0 ? "positive" : "negative"}
                  >
                    {usd(a.monthlyCashFlow)}
                  </dd>
                </div>
                <div>
                  <dt>Cap rate</dt>
                  <dd>{a.capRate.toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>Cash-on-cash</dt>
                  <dd>{a.cashOnCash.toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>DSCR</dt>
                  <dd>{a.dscr.toFixed(2)}×</dd>
                </div>
                <div>
                  <dt>Cash required</dt>
                  <dd>{usd(a.cashRequired)}</dd>
                </div>
              </dl>
              <p>
                <b>Timing:</b>{" "}
                {a.action === "BUY CANDIDATE"
                  ? "Prepare due diligence now; buy only if verified property, financing, reserves, and household checks still pass."
                  : a.action === "NEGOTIATE"
                    ? `Wait for a price near ${usd(a.maxOffer)} or stronger verified rent.`
                    : "Do not force a purchase under these assumptions."}
              </p>
            </section>
          </div>
          <section className="card real-estate-scenarios">
            <header>
              <span>DOWNSIDE FIRST</span>
              <h3>Bear, Base, and Bull sensitivity</h3>
            </header>
            <div>
              {a.scenarios.map((s) => (
                <article className={s.name.toLowerCase()} key={s.name}>
                  <b>{s.name}</b>
                  <span>{usd(s.monthlyCashFlow)}/mo cash flow</span>
                  <strong>
                    {usd(s.equity5)}
                    <small>modeled equity · year 5</small>
                  </strong>
                  <strong>
                    {usd(s.equity10)}
                    <small>modeled equity · year 10</small>
                  </strong>
                </article>
              ))}
            </div>
            <footer>
              Modeled results are uncertain. Verify local comparables,
              inspection, title, insurance, financing, taxes, permits, HOA and
              rental law immediately before acting.
            </footer>
          </section>
        </>
      )}
    </section>
  );
}
