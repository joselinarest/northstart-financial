# Northstar UI inventory — before restructuring

Source audit: 2026-09-25. This is a code inventory, not an authenticated production walkthrough.

## Routes and ownership

| Area | Existing routes | Primary job | Current problem |
|---|---|---|---|
| Today | dashboard, daily-action-plan, markets, opportunities | Summary and next actions | Home duplicates candidates, portfolio and news; markets aliases Today; multiple decision producers |
| Portfolio | portfolio, accounts, investment-account, account transactions | Allocation, positions, growth, goals | Watchlist and discovery repeat research; repeated account summaries |
| Markets / Research | charts, security-detail, growth, dividend-growth, new-candidates, market-news | Discover and research selected securities | Two charts in one screen; quote/cost/plan repeats; static indicator numbers; news leaves workspace |
| Trading | planner, options, options-detail, journal, simulation | Plan, monitor and review trades | Planner redirects to Today; separate computed action competes with authoritative recommendation |
| Finance | household, cash-flow, transactions, spending, budgets, debt, real-estate, kids-goals, bill details | Household cash, obligations and goals | Legacy panels mounted alongside newer centers; navigation mixes investing and household finance |
| Alerts | notifications | Event triage and deep links | Aliases Settings; notifications embedded in global UI |
| Settings | settings, system-health, help, academy, assistant | Configuration, health and support | Too many top-level secondary tools |

## Data sources

Account context: connectedFinance, analysisScope, advisorAccountId. Recommendations: /api/recommendations/authoritative and action-guidance. Quotes: market quote service. Candles: /api/market/bars. News/fundamentals: /api/market/research. Planned trades: /api/planned-actions. Existing chart-local multi-timeframe calculations and ATR-derived probabilities are not authoritative recommendations or calibrated forecasts.

## Chart implementations

IntegratedResearchChart: interactive canvas, provider bars, pattern coordinates, fullscreen, manual plan. Inline northstar-workspace chart: competing SVG/canvas presentation, static RSI, scenario overlays and cycle summaries. AdvancedStudyChart/StudyChart/ChartPredictionLab: learning tools; preserve simulation distinction. AccountGrowthChart and portfolio trajectory charts: account performance, not security candlestick alternatives.

## Mounted content inventory

Many entries are currently hidden by CSS instead of owned by routes. Before moving them, use explicit route conditions and preserve deep links.

| Original line | Section / mounting condition |
|---|---|
| 6517 | {pageDataLoading && ( <div className="workspace-route-skeleton" role="status" aria-live="polite" aria-label="Loading Northstar data" > <span className="sr-only">Loading complete page data</s |
| 6542 | {actionNotice && ( <div className="action-toast" role="status"> {actionNotice} </div> )} |
| 6547 | <nav className="workspace-breadcrumb" aria-label="Page navigation"> <div className="history-controls" aria-label="Navigation history"> <button type="button" onClick={() => window.history.len |
| 6648 | {showInvestmentContext && !!investmentAccounts.length && ( <AccountScopeDashboard accounts={investmentAccounts} holdings={connectedFinance.holdings} selectedScope={analysisScope} onSelect={s |
| 6663 | {showInvestmentContext && !investmentAccounts.length && ( <section className="analysis-scope-empty"> {!financeDataReady ? ( <> <b>Loading investment accounts…</b> <span> Northstar is reconci |
| 6694 | <div className={`hero ${tab === "Options Advisor" ? "options-workspace-hero" : ""}`} id="dashboard-top"> <div> <p className="kicker"> {tab === "Daily Action Plan" ? "LIVE MARKET DATA · DAILY |
| 6789 | {tab === "Options Advisor" && ( <section className="options-advisor-entry options-advisor-route"> <header> <div> <span>OPTIONS · CALLS AND PUTS</span> <h2>Account-specific options suggestion |
| 6829 | {isLongTermInvestmentPage && !longTermAccounts.length && ( <section className="purpose-empty card"> <b> No Long-Term or Retirement investment account is configured. </b> <span> Growth Finder |
| 6843 | {isPortfolioPage && !investmentAccounts.length && ( <section className="purpose-empty card"> <b>No investment portfolio is configured.</b> <span> Connect or create a retirement, brokerage, S |
| 6855 | {tab === "Dashboard" && ( <section className="command-center home-command-center"> <header className="home-status-strip"> <article> <small>Selected portfolio</small> <b> {analysisScope === A |
| 7262 | {tab === "Kids / Goals" && ( <KidsGoalsErrorBoundary> <section className="kids-workspace"> <ChildAccountAttachment accessToken={accessToken} /> <KidsGoalsCenter accessToken={accessToken} />  |
| 7270 | {tab === "Household" && ( <HouseholdMoneyCenter accounts={connectedFinance.accounts} transactions={familyTransactions} mode="household" /> )} |
| 7277 | {tab === "Bills & cards" && ( <HouseholdMoneyCenter accounts={connectedFinance.accounts} transactions={familyTransactions} mode="cashflow" /> )} |
| 7284 | {tab === "Bill Transactions" && ( <BillTransactionHistory name={selectedBillName} accountId={selectedFinanceAccountId} accounts={connectedFinance.accounts} transactions={familyTransactions}  |
| 7299 | {tab === "Liabilities" && ( <DebtLiabilityCenter accounts={connectedFinance.accounts} onOpenAccount={(id) => navigatePath( `/workspace/accounts/${encodeURIComponent(id)}/transactions`, ) } / |
| 7309 | {tab === "Real Estate" && ( <RealEstateCommandCenter accessToken={accessToken} /> )} |
| 7312 | {tab === "Daily Action Plan" && <CapitalRotationPanel accountId={advisorAccount ? String(advisorAccount.id) : ""} />} |
| 7313 | {tab === "Daily Action Plan" && ( <section className="daily-plan-intro card"> <header> <span>{marketPhase === "open" ? "MARKET OPEN · LIVE MONITORING" : "NEXT-SESSION PREPARATION"}</span> <h |
| 7329 | {tab === "Daily Action Plan" && advisorStrategy === "swing" && ( <section className="options-advisor-entry card"> <header> <div> <span>OPTIONS · CALLS AND PUTS</span> <h2>Account-specific op |
| 7370 | {tab === "Daily Action Plan" && ( <details id="today-recommendations" className="daily-account-action-plans selected-account-only"><summary style={{padding:16,cursor:"pointer",fontWeight:700 |
| 7400 | {tab === "Daily Action Plan" && ( <SectionAccordion title="Market session report"><MarketSessionReport marketOpen={marketPhase === "open"} /></SectionAccordion> )} |
| 7403 | {tab === "Daily Action Plan" && ( <SectionAccordion title="Daily close review">{marketPhase !== "open" && investmentAccounts.filter(account => analysisScope === ALL_ACCOUNTS_SCOPE &#124;&#124; String( |
| 7413 | {tab === "Daily Action Plan" && advisorAccountId && <SectionAccordion title="Trade lifecycle and saved plans"><TradeLifecyclePanel accountId={advisorAccountId} accessToken={accessToken} /></ |
| 7414 | {tab === "Daily Action Plan" && <AIHealthPanel accessToken={accessToken} />} |
| 7417 | {tab === "Daily Action Plan" && ( <AutomaticMarketCopilot key={`today-copilot:${advisorAccountId}:${advisorStrategy}`} accessToken={accessToken} initialStrategy={advisorStrategy} marketPhase |
| 7459 | {tab === "Daily Action Plan" && advisorHoldings.length > 0 && ( <details className="daily-swing-holdings card"><summary style={{padding:16,cursor:"pointer",fontWeight:700}}>Current holdings  |
| 7487 | {tab === "Prepare Trade" && advisorStrategy === "swing" && ( <AutomaticMarketCopilot accessToken={accessToken} initialStrategy="swing" marketPhase={marketPhase} refreshMinutes={intradayRefre |
| 7520 | {tab === "New Candidates" && ( <NewCandidateDiscovery accountId={advisorAccountId} accountName={advisorAccountName} accountStrategy={advisorStrategy} onOpen={(symbol) => navigatePath( `/work |
| 7532 | {[ "Market Intel", "Growth Finder", "Professional Charts", "Prepare Trade", "Portfolio", ].includes(tab) && ( <MarketWatchlist accessToken={accessToken} marketOpen={marketPhase === "open"} o |
| 7549 | <nav className="market-subnav" aria-label="Market tools"> <button className={tab === "Professional Charts" ? "active" : ""} onClick={() => navigate("Professional Charts")} > <b>⌁</b> <span>  |
| 7580 | {tab === "Prepare Trade" && ( <section className="purpose-account-review card"> <header> <div> <span>PLAID ACCOUNTS · SWING & OPTIONS</span> <h2>Your purpose-matched trading accounts</h2> <p |
| 7698 | {tab === "Prepare Trade" && advisorHoldings.length > 0 && ( <ConnectedHoldingsAnalysis key={`prepare-holdings:${advisorAccountId}:${advisorStrategy}`} marketOpen={marketPhase === "open"} hol |
| 7712 | {tab === "Account Transactions" && ( <section className="account-transactions-page route-page"> <nav> <a href="/workspace/accounts">← Back to all accounts</a> <span>ACCOUNT TRANSACTIONS</spa |
| 7901 | {tab === "Accounts" && ( <section className="connected-accounts card"> <div className="accounts-head"> <div> <span>▣ READ-ONLY FINANCIAL CONNECTIONS</span> <h2>Banking and investment account |
| 8416 | {tab === "Accounts" && ( <InvestmentAccountManager accessToken={accessToken} onChanged={() => { loadConnectedFinance(true); setRealtimeTick((value) => value + 1); }} /> )} |
| 8425 | {tab === "Portfolio" && analysisScope !== ALL_ACCOUNTS_SCOPE && advisorAccountId && ( <PortfolioBuilderWizard key={`builder:${advisorAccountId}`} accountId={advisorAccountId} accountName={ad |
| 8435 | {tab === "Portfolio" && analysisScope !== ALL_ACCOUNTS_SCOPE && advisorAccountId && advisorStrategy === "long-term" && ( <LongTermBalanceCard key={`balance:${advisorAccountId}`} accountId={a |
| 8445 | {tab === "Portfolio" && analysisScope !== ALL_ACCOUNTS_SCOPE && ( <PortfolioIntelligenceLoader key={advisorAccountId &#124;&#124; "unselected"} accountId={advisorAccountId} accessToken={accessToken} / |
| 8452 | {tab === "Portfolio" && analysisScope !== ALL_ACCOUNTS_SCOPE && advisorAccount && advisorStrategy === "long-term" && ( <LongTermPortfolioPlan key={`portfolio-plan:${advisorAccountId}:${advis |
| 8482 | {tab === "Portfolio" && investmentAccounts.filter(account=>analysisScope===ALL_ACCOUNTS_SCOPE&#124;&#124;String(account.id)===advisorAccountId).map(account=><section key={`growth:${account.id}`} class |
| 8483 | <section className={`portfolio-builder card ${tab === "Portfolio" && analysisScope !== ALL_ACCOUNTS_SCOPE ? "" : "account-scope-hidden"}`} > {tab === "Portfolio" && ( <ActionGuidancePanel ke |
| 9175 | {tab === "Portfolio" && analysisScope !== ALL_ACCOUNTS_SCOPE && ( <section className="portfolio-growth-opportunities"> <header> <span> {advisorStrategy === "swing" ? "LIVE SWING PORTFOLIO SY |
| 9225 | <section className="focus-bar"> {backendOverview && ( <div> <span>PERSISTENT DATA</span> <b> {backendOverview.entities} entities ·{" "} {backendOverview.transactions} transactions </b> <smal |
| 9255 | <section className="growth-finder card" id="growth-finder"> <div className="screener-head"> <div> <p>AFFORDABLE GROWTH RESEARCH</p> <h2> Find emerging companies without confusing price with  |
| 9369 | <div className="regime"> <div> <p>MARKET CONDITION</p> <b> <i /> Constructively bullish </b> <span> Trend is positive, but breadth is narrowing. Favor quality setups; avoid chasing extended  |
| 9393 | <section className="chart-workspace card" id="market-charts"> <LinkedChartSetup symbol={chartSymbol}/> <div className="chart-head"> <div> <p>PROFESSIONAL MARKET CHARTS</p> <h2>{chartSymbol}  |
| 10401 | <section className="asset-screener card" id="asset-search"> <div className="screener-head"> <div> <p>PROFESSIONAL INVESTMENT DISCOVERY & DECISION ENGINE</p> <h2>Find investments by purpose—n |
| 11466 | <section className="intel card" id="market-intel"> <div className="intel-top"> <div> <p>LIVE MARKET INTELLIGENCE</p> <h2>Events that may change risk or opportunity</h2> <span> <i /> {newsSta |
| 11590 | <div className="intel-grid"> <section className="card causal"> <div className="title"> <div> <p>CAUSAL CHAIN · FEATURED EVENT</p> <h2>Who may benefit—and who may lose</h2> </div> <span class |
| 11729 | <section className="themes card"> <div className="title"> <div> <p>THEME DISCOVERY ENGINE</p> <h2>Multiple events are converging</h2> </div> <button onClick={() => navigate("Market News")}>  |
| 11777 | <div className="main-grid" id="scanner"> <section className="card scanner"> <div className="title"> <div> <p>AI OPPORTUNITY SCANNER</p> <h2> {tab === "Scanner" ? "Full ranked setup list" : " |
| 11940 | {preparedAction ? ( <section className="prepared-action-summary card"> <div> <span>LOADED PREPARED ACTION</span> <h2> {preparedAction.symbol} · {preparedAction.action} </h2> <p>{preparedActi |
| 11964 | <section className="card planner" id="trade-planner"> <div className="title"> <div> <p>MANDATORY RISK CHECK</p> <h2>Trade size and risk plan</h2> <small> Uses the selected action, current ma |
| 12125 | <PaperTradingSimulator initialSymbol={pick.ticker} initialCash={100000} accessToken={accessToken} /> |
| 12130 | <div className="lower-grid"> <section className="card ask" id="ask-northstar"> <div className="title"> <div> <p>SHOULD I ENTER?</p> <h2>Challenge your trade idea</h2> </div> </div> <textarea |
| 12202 | <section className="cash-command card" id="bills-cards"> <div className="title"> <div> <p>HOUSEHOLD CASH-FLOW COMMAND CENTER</p> <h2>Everything due, before you invest</h2> </div> <button onC |
| 12248 | <div className="bills-grid"> <section className="card bill-center"> <div className="title"> <div> <p>UPCOMING BILLS</p> <h2> ${monthlyBills.toLocaleString()} predicted in the next 30 days </ |
| 12400 | <section className="cards-center card"> <div className="title"> <div> <p>CREDIT CARD CONTROL</p> <h2>Pay expensive revolving debt first</h2> </div> <span className="warn">1 HIGH-RISK CARD</s |
| 12500 | <section className="debt-health card" id="liabilities"> <div className="title"> <div> <p>PERSONAL FINANCE · LIABILITIES</p> <h2>Household debt dashboard</h2> </div> <button onClick={() => na |
| 12557 | <div className="finance-grid"> <section className="card mortgage"> <div className="title"> <div> <p>MORTGAGE INTELLIGENCE</p> <h2>What if I pay extra?</h2> </div> <span className="pass">4.12 |
| 12657 | <section className="household card" id="household"> <div className="title"> <div> <p>HOUSEHOLD & PERMISSIONS</p> <h2>Your shared financial team</h2> </div> {["owner", "co_owner"].includes(ho |
| 12925 | <section className="attention card" id="attention-settings"> <div className="title"> <div> <p>MOBILE, TIMEZONE & BEHAVIOR GUARDRAILS</p> <h2>Stay informed without living in the market</h2> < |
| 13191 | <section className="decision-journal card" id="decision-journal"> <div className="journal-head"> <div> <span>▤ SYNCHRONIZED DECISION JOURNAL</span> <h2>Record the evidence before you act</h2 |
| 13400 | <section className="help-guide card" id="help-guide"> <div className="title"> <div> <p>HELP & APP GUIDE</p> <h2>How to use Northstar safely and effectively</h2> </div> <span className="guide |
| 13515 | <section className="academy-hub card" id="academy-course"> <div className="academy-banner"> <div> <p>NORTHSTAR ACADEMY · 20-WEEK GUIDE</p> <h2>Read, practice, test, and improve your decision |
| 13885 | <section className="learn-strip" id="learning"> <div> <p>YOUR LEARNING PATH</p> <h2>Build skill before increasing risk</h2> </div> {modules.slice(0, 4).map((m, i) => ( <span key={m}> <i>{i < |
| 13908 | <footer> {["Learn", "Paper Simulator"].includes(tab) ? "Training and simulation environment. No live order is submitted, and simulated results do not guarantee future performance." : "Profes |

## Regression gates

Before replacement: chart-axis, chart-link-selection, today-visibility, account-growth. New gates: five required viewport widths; one chart engine; selected ticker/account reset; keyboard tabs; fullscreen state; X/Y gestures; no invented forecast; event relevance; route ownership. Authenticated production coverage requires a signed-in session and must not be claimed from fixtures.
