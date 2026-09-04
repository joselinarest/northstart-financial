"use client";

import { useEffect, useMemo, useState } from "react";
import { getCognitoSession, isCognitoConfigured, signOutCognito, startCognitoLogin } from "@/lib/cognito-client";
import { patternLibrary, probabilityEngine, type Bar } from "@/lib/technical-analysis";
import AcademyLab from "@/app/academy-lab";
import AdvancedStudyChart from "@/app/advanced-study-chart";
import ScenarioGallery from "@/app/scenario-gallery";
import BuySellGuide from "@/app/buy-sell-guide";
import ChartPredictionLab from "@/app/chart-prediction-lab";
import AutomaticMarketCopilot from "@/app/automatic-market-copilot";
import PaperTradingSimulator from "@/app/paper-trading-simulator";
import MarketWatchlist from "@/app/market-watchlist";
import RealtimeSync from "@/app/realtime-sync";
import HelpVideoGuides from "@/app/help-video-guides";
import InvestmentAccountProfile from "@/app/investment-account-profile";
import ConnectedHoldingsAnalysis from "@/app/connected-holdings-analysis";

const opportunities = [
  {
    ticker: "NVDA",
    name: "NVIDIA",
    score: 84,
    setup: "Pullback + confirmation",
    price: 181.46,
    trend: "Bullish",
    support: "176–179",
    resistance: "188",
    volume: "1.3×",
    catalyst: "Earnings in 18 days",
  },
  {
    ticker: "SPY",
    name: "S&P 500 ETF",
    score: 78,
    setup: "Breakout retest",
    price: 644.82,
    trend: "Bullish",
    support: "638–641",
    resistance: "648",
    volume: "1.1×",
    catalyst: "Jobs report Friday",
  },
  {
    ticker: "CRWD",
    name: "CrowdStrike",
    score: 71,
    setup: "Base breakout watch",
    price: 426.12,
    trend: "Neutral",
    support: "411–416",
    resistance: "432",
    volume: "0.9×",
    catalyst: "No near catalyst",
  },
];
const scannerOpportunities = [
  ...opportunities,
  {ticker:"GOOGL",name:"Alphabet",score:86,setup:"Trend continuation watch",price:201.34,trend:"Bullish",support:"194–198",resistance:"205",volume:"1.2×",catalyst:"Cloud and AI demand"},
  {ticker:"JPM",name:"JPMorgan Chase",score:82,setup:"Relative-strength pullback",price:296.41,trend:"Bullish",support:"286–290",resistance:"301",volume:"1.1×",catalyst:"Rate and credit sensitivity"},
  {ticker:"META",name:"Meta Platforms",score:80,setup:"Support reclaim watch",price:748.20,trend:"Bullish",support:"720–732",resistance:"760",volume:"1.0×",catalyst:"Advertising and AI capex"},
  {ticker:"AMZN",name:"Amazon",score:77,setup:"Range breakout watch",price:231.09,trend:"Neutral",support:"220–224",resistance:"234",volume:"0.9×",catalyst:"AWS growth expectations"},
  {ticker:"XOM",name:"Exxon Mobil",score:74,setup:"Commodity confirmation",price:112.88,trend:"Neutral",support:"108–110",resistance:"116",volume:"1.0×",catalyst:"Oil-price sensitivity"},
  {ticker:"AAPL",name:"Apple",score:70,setup:"Base recovery watch",price:228.74,trend:"Neutral",support:"218–222",resistance:"233",volume:"0.8×",catalyst:"Product and services cycle"},
  {ticker:"LLY",name:"Eli Lilly",score:68,setup:"High-valuation pullback",price:732.55,trend:"Neutral",support:"690–705",resistance:"755",volume:"1.2×",catalyst:"Drug-trial and regulatory risk"},
  {ticker:"COST",name:"Costco",score:61,setup:"Valuation reset required",price:982.15,trend:"Bullish",support:"910–930",resistance:"1,000",volume:"0.9×",catalyst:"Premium valuation limits margin of safety"},
  {ticker:"QQQ",name:"Nasdaq-100 ETF",score:75,setup:"Index trend retest",price:578.26,trend:"Bullish",support:"565–570",resistance:"584",volume:"1.0×",catalyst:"Technology concentration and rates"},
];

const modules = [
  "Market basics",
  "Candles & structure",
  "Risk & position size",
  "Entries & invalidation",
  "Fundamentals",
  "Trading psychology",
];

const candles: Bar[] = [
  [177.2,179.4,176.4,178.8,42],[178.8,180.1,177.6,179.2,51],[179.2,180.4,177.9,178.3,38],[178.3,181.2,177.8,180.7,63],
  [180.7,182.4,179.8,181.9,58],[181.9,182.7,180.2,180.9,45],[180.9,183.1,180.4,182.6,74],[182.6,184.2,181.6,183.4,66],
  [183.4,184.0,181.1,181.8,59],[181.8,183.0,180.5,182.4,48],[182.4,185.1,182.0,184.6,82],[184.6,186.2,183.5,185.4,77],
  [185.4,186.0,183.2,184.0,54],[184.0,184.8,181.9,182.7,69],[182.7,184.1,181.7,183.8,50],[183.8,186.3,183.1,185.9,87],
  [185.9,187.0,184.4,186.4,73],[186.4,187.2,184.8,185.2,61],[185.2,186.5,183.9,184.7,55],[184.7,187.8,184.2,187.1,94],
  [187.1,188.4,186.0,186.6,71],[186.6,188.1,185.6,187.5,64],[187.5,188.8,186.2,188.2,79],[188.2,189.1,186.8,187.4,68],
];
const fiveYearSeries = Array.from({ length: 60 }, (_, month) => {
  const cycle = Math.sin(month / 5.2) * 9 + Math.sin(month / 2.1) * 3;
  const shock = month >= 19 && month <= 24 ? -(24 - Math.abs(22 - month) * 4) : 0;
  return Math.round((100 + month * 1.42 + cycle + shock) * 10) / 10;
});
const cycleYears = [
  { year: "2021", phase: "Expansion", portfolio: 22.4, benchmark: 26.9, drawdown: -5.2 },
  { year: "2022", phase: "Contraction", portfolio: -14.8, benchmark: -19.4, drawdown: -22.1 },
  { year: "2023", phase: "Recovery", portfolio: 28.1, benchmark: 24.2, drawdown: -9.6 },
  { year: "2024", phase: "Expansion", portfolio: 24.7, benchmark: 23.3, drawdown: -7.4 },
  { year: "2025", phase: "Late cycle", portfolio: 12.8, benchmark: 9.4, drawdown: -11.2 },
];
const academyWeeks = ["What investing means","How the stock market works","How to read a chart","Trend, support and resistance","Japanese candlesticks","Moving averages","Volume and confirmation","Bollinger Bands and volatility","Multiple timeframe analysis","Momentum: RSI and MACD","Breakouts, retests and fakeouts","Risk/reward and position size","Financial statements","Business valuation","ETFs and diversification","Economy, rates and indexes","Advanced market structure","Options from zero","Psychology and discipline","Build and test your system"];
const academyLessons = [
  {simple:"Saving preserves a seed; investing plants it with risk and time.",professional:"Compare stocks, ETFs, bonds and indexes using return, inflation, compounding and time horizon.",assignment:"Calculate the return from $2,000 to $2,300 and explain why diversification matters.",question:"If $1,000 becomes $1,100, what is the return?",options:["1%","10%","100%"],correct:1,reading:"The Little Book of Common Sense Investing"},
  {simple:"The market is an electronic auction connecting buyers and sellers.",professional:"Use bid, ask, spread, liquidity and slippage to choose between market and limit orders.",assignment:"Compare a liquid ETF spread with a small stock spread; do not place a real order.",question:"A limit order does what?",options:["Guarantees execution","Controls price but may not execute","Guarantees profit"],correct:1,reading:"Broker education: order types"},
  {simple:"Each candle tells where price opened, traveled and closed.",professional:"Declare timeframe and read OHLC, gaps, daily range and volume before adding indicators.",assignment:"Describe the same ticker on 15m, 1H and 1D charts.",question:"On a 1D chart, one candle usually represents?",options:["One minute","One session day","One year"],correct:1,reading:"Japanese Candlestick Charting Techniques"},
  {simple:"Support is a floor area and resistance is a ceiling area, but either can break.",professional:"Classify HH/HL, LH/LL or range and write a falsifiable invalidation condition.",assignment:"Mark one support zone, one resistance zone and the condition that invalidates your idea.",question:"HH plus HL usually describes?",options:["Uptrend","Downtrend","No liquidity"],correct:0,reading:"Technical Analysis of the Financial Markets"},
  {simple:"Bodies and wicks show a struggle between buyers and sellers.",professional:"Interpret doji, hammer, shooting star and engulfing patterns only with trend, location and volume.",assignment:"Find five long-wick candles and describe their context.",question:"A hammer by itself is?",options:["An automatic buy","Contextual information","A guaranteed reversal"],correct:1,reading:"Japanese Candlestick Charting Techniques"},
  {simple:"A moving average smooths noisy prices.",professional:"Compare SMA and EMA speed, slope and whipsaw risk; averages summarize the past.",assignment:"Add 20- and 50-period averages and describe—not predict—the structure.",question:"Which average weights recent prices more?",options:["SMA","EMA","Neither uses prices"],correct:1,reading:"Technical Analysis of the Financial Markets"},
  {simple:"Volume shows how much participation accompanied a move.",professional:"Use relative volume to evaluate confirmation, exhaustion and false-breakout risk.",assignment:"Compare volume on three successful and three failed breakouts.",question:"High volume guarantees continuation?",options:["Yes","No","Only for ETFs"],correct:1,reading:"A Complete Guide to Volume Price Analysis"},
  {simple:"Bollinger Bands expand and contract as price becomes more or less volatile.",professional:"Treat a squeeze as compression, not a directional prediction; demand price confirmation.",assignment:"Find one squeeze and document both bullish and bearish expansion scenarios.",question:"A Bollinger squeeze predicts direction?",options:["Always up","Always down","No, only compression"],correct:2,reading:"Bollinger on Bollinger Bands"},
  {simple:"Zoom out for the map, then zoom in for execution.",professional:"Use top-down 1D → 1H → 15m analysis to align context, setup, trigger and risk.",assignment:"Create a three-timeframe decision sheet for one ticker.",question:"Which timeframe should define broad context first?",options:["1D","1m","Tick chart"],correct:0,reading:"Trading in the Zone"},
  {simple:"Momentum measures how forcefully price is moving.",professional:"Interpret RSI and MACD with structure; overbought is not an automatic sell signal.",assignment:"Find an example where RSI stayed above 70 during a strong trend.",question:"RSI above 70 means?",options:["Sell automatically","Strong momentum that needs context","Guaranteed crash"],correct:1,reading:"Technical Analysis of the Financial Markets"},
  {simple:"A breakout must prove it can stay outside the old boundary.",professional:"Separate breakout, confirmation, retest and fakeout using closes, participation and acceptance.",assignment:"Annotate one valid breakout and one false breakout.",question:"A failed breakout usually does what?",options:["Returns into the range","Guarantees continuation","Removes volatility"],correct:0,reading:"How to Make Money in Stocks"},
  {simple:"Decide how much you can lose before deciding how much to buy.",professional:"Position size equals allowed monetary risk divided by entry-to-stop risk per unit.",assignment:"For a $10,000 account at 0.5% risk and $2 risk/share, calculate size.",question:"The correct size in that example is?",options:["25 shares","50 shares","500 shares"],correct:0,reading:"Trade Your Way to Financial Freedom"},
  {simple:"Financial statements tell how a business earns, owns, owes and moves cash.",professional:"Connect income statement, balance sheet and cash flow; calculate free cash flow.",assignment:"Review one annual filing and record revenue, net income, debt and operating cash flow.",question:"Free cash flow is commonly approximated as?",options:["Revenue minus tax","Operating cash flow minus CapEx","Assets plus debt"],correct:1,reading:"Warren Buffett and the Interpretation of Financial Statements"},
  {simple:"A wonderful company can still be a poor investment at an extreme price.",professional:"Compare P/E, growth, margins, balance sheet, quality and expectations with suitable peers.",assignment:"Compare the valuation of three companies in the same industry.",question:"A low P/E always means cheap?",options:["Yes","No, risk or falling earnings may explain it","Only above $1B market cap"],correct:1,reading:"The Little Book of Valuation"},
  {simple:"Diversification avoids depending on a single seed.",professional:"Evaluate allocation, correlation, costs, tracking and rebalancing—not only the number of holdings.",assignment:"Design a hypothetical diversified allocation and identify remaining correlated risks.",question:"Diversification eliminates all market risk?",options:["Yes","No","Only with ten stocks"],correct:1,reading:"The Intelligent Asset Allocator"},
  {simple:"Rates change the price of borrowing and the value of future money.",professional:"Trace inflation, Fed expectations, yields, currencies and discount rates into sectors and valuations.",assignment:"Explain one CPI surprise through a complete cause-and-effect chain.",question:"Higher discount rates generally do what to distant cash flows?",options:["Raise present value","Lower present value","Have no relationship"],correct:1,reading:"A Random Walk Down Wall Street"},
  {simple:"Strong assets often behave better than their market even on difficult days.",professional:"Study relative strength, prior highs/lows, gaps, VWAP and index/sector confirmation.",assignment:"Find one stock outperforming its sector and write what would invalidate leadership.",question:"Relative strength compares an asset with?",options:["A benchmark","Its employee count","Only its dividend"],correct:0,reading:"Market Wizards"},
  {simple:"Options are contracts whose value depends on price, time and volatility.",professional:"Understand calls, puts, strike, expiration, premium, Delta, Theta, Vega and maximum loss.",assignment:"Calculate the cost and expiration breakeven of one hypothetical call; use no real money.",question:"A standard equity option commonly represents?",options:["1 share","100 shares","1,000 shares"],correct:1,reading:"Options as a Strategic Investment"},
  {simple:"A good outcome can come from a bad decision, and a loss can follow a good process.",professional:"Recognize FOMO, revenge trading, recency bias and outcome bias; grade rule compliance separately.",assignment:"Write a cooling-off rule and review three past emotional decisions.",question:"After a loss, increasing size to recover quickly is?",options:["Risk management","Revenge trading","Diversification"],correct:1,reading:"The Psychology of Money"},
  {simple:"A system is a checklist you can test, follow and improve.",professional:"Define market, setup, entry, invalidation, size, exit, costs, expectancy, drawdown and review cadence.",assignment:"Write your complete system and test it on a meaningful paper-trade sample.",question:"When no setup meets the written rules, the correct action is?",options:["Force one trade","No trade","Increase leverage"],correct:1,reading:"Trading in the Zone"},
];
const candleExam = [
  ["A long lower wick after a decline is most useful when…",["It appears anywhere","Support, volume and follow-through confirm rejection","The candle is green"],1],
  ["A doji proves that price will reverse.",["True","False—indecision still needs context","Only on a 1-minute chart"],1],
  ["A bullish engulfing pattern requires…",["A body that engulfs the prior bearish body","A higher nominal share price","No volume"],0],
  ["A shooting star is strongest when it forms…",["Near resistance after an advance","At random in a range","After the market closes"],0],
  ["A liquidity sweep above a prior high closes…",["Back below the swept level","At any price","Exactly at VWAP"],0],
  ["Pattern Quality should include…",["Only the candle name","Trend, location, volume and confirmation","Social sentiment only"],1],
  ["A breakout candle is validated by…",["Intrabar excitement","Close, acceptance, participation and follow-through","A guarantee of profit"],1],
  ["When higher and lower timeframes disagree…",["Increase size","Lower confidence and wait for confirmation","Ignore the higher timeframe"],1],
] as const;
const marketAssets = [
  {symbol:"NVDA",name:"NVIDIA",sector:"Technology",price:181.46,pe:52.8,marketCap:4460,growth5y:1950,score:88,risk:"High"},{symbol:"MSFT",name:"Microsoft",sector:"Technology",price:506.12,pe:37.4,marketCap:3760,growth5y:142,score:84,risk:"Medium"},{symbol:"GOOGL",name:"Alphabet",sector:"Communication",price:201.34,pe:21.7,marketCap:2480,growth5y:118,score:86,risk:"Medium"},{symbol:"AMZN",name:"Amazon",sector:"Consumer",price:231.09,pe:34.8,marketCap:2460,growth5y:89,score:81,risk:"Medium"},{symbol:"META",name:"Meta Platforms",sector:"Communication",price:748.20,pe:27.1,marketCap:1880,growth5y:220,score:85,risk:"Medium"},{symbol:"AAPL",name:"Apple",sector:"Technology",price:228.74,pe:34.2,marketCap:3400,growth5y:97,score:73,risk:"Medium"},{symbol:"JPM",name:"JPMorgan Chase",sector:"Financials",price:296.41,pe:15.3,marketCap:815,growth5y:168,score:82,risk:"Medium"},{symbol:"LLY",name:"Eli Lilly",sector:"Healthcare",price:732.55,pe:48.9,marketCap:694,growth5y:510,score:78,risk:"High"},{symbol:"XOM",name:"Exxon Mobil",sector:"Energy",price:112.88,pe:14.9,marketCap:486,growth5y:171,score:76,risk:"Medium"},{symbol:"COST",name:"Costco",sector:"Consumer",price:982.15,pe:55.1,marketCap:436,growth5y:210,score:75,risk:"Medium"},{symbol:"SPY",name:"S&P 500 ETF",sector:"ETF",price:644.82,pe:26.4,marketCap:593,growth5y:92,score:80,risk:"Lower"},{symbol:"QQQ",name:"Nasdaq-100 ETF",sector:"ETF",price:578.26,pe:32.2,marketCap:351,growth5y:112,score:79,risk:"Medium"},
];
// Illustrative model outputs until a live fundamentals/valuation provider is connected.
const modelFairValues: Record<string,number> = {NVDA:142,MSFT:390,GOOGL:188,AMZN:205,META:690,AAPL:190,JPM:270,LLY:545,XOM:118,COST:720,SPY:570,QQQ:485};
const indicatedDividendYields: Record<string,number> = {NVDA:.02,MSFT:.65,GOOGL:.41,AMZN:0,META:.29,AAPL:.44,JPM:1.9,LLY:.7,XOM:3.4,COST:.5,SPY:1.2,QQQ:.5};
const investmentCatalog = [
  {id:"SPY",symbol:"SPY",name:"SPDR S&P 500 ETF",category:"Stocks & ETFs",subcategory:"Broad market ETF",score:88,risk:"Medium",cost:"0.09% expense",metric:"500 large U.S. companies",horizon:"5+ years",minimum:"1 share or fractional",fit:["Balanced","Growth","Active"],why:"Low-cost access to profitable large U.S. companies with strong liquidity.",caution:"Concentrated in U.S. large caps and can decline sharply during bear markets.",next:"Compare valuation, breadth, earnings trend and your existing U.S. exposure."},
  {id:"VTI",symbol:"VTI",name:"Vanguard Total Stock Market ETF",category:"Stocks & ETFs",subcategory:"Total market ETF",score:91,risk:"Medium",cost:"0.03% expense",metric:"Broad U.S. equity market",horizon:"7+ years",minimum:"1 share or fractional",fit:["Balanced","Growth"],why:"Very broad U.S. diversification at a low ongoing cost.",caution:"Still carries full equity-market risk and meaningful mega-cap exposure.",next:"Review whether international stocks and bonds are needed beside it."},
  {id:"VXUS",symbol:"VXUS",name:"Vanguard Total International Stock ETF",category:"Stocks & ETFs",subcategory:"International ETF",score:82,risk:"Medium",cost:"0.05% expense",metric:"Developed + emerging markets",horizon:"7+ years",minimum:"1 share or fractional",fit:["Balanced","Growth"],why:"Diversifies a portfolio that is overly dependent on the United States.",caution:"Currency, geopolitical and country-governance risks can increase volatility.",next:"Measure current international allocation before adding it."},
  {id:"MSFT",symbol:"MSFT",name:"Microsoft",category:"Stocks & ETFs",subcategory:"Individual stock",score:79,risk:"Medium",cost:"No fund expense",metric:"Large-cap technology",horizon:"5+ years",minimum:"1 share or fractional",fit:["Growth","Active"],why:"High-quality recurring revenue and strong balance-sheet characteristics.",caution:"Single-company concentration and valuation risk require a smaller position.",next:"Analyze valuation, cloud growth, margins, competition and portfolio concentration."},
  {id:"GOOGL",symbol:"GOOGL",name:"Alphabet",category:"Stocks & ETFs",subcategory:"Individual stock",score:86,risk:"Medium",cost:"No fund expense",metric:"Digital advertising + cloud",horizon:"5+ years",minimum:"1 share or fractional",fit:["Balanced","Growth","Active"],why:"Strong cash generation, leading digital platforms and a comparatively moderate earnings multiple.",caution:"Advertising cyclicality, regulation and AI competition can weaken the thesis.",next:"Compare search durability, cloud margins, AI spending and valuation with peers."},
  {id:"AMZN",symbol:"AMZN",name:"Amazon",category:"Stocks & ETFs",subcategory:"Individual stock",score:80,risk:"Medium",cost:"No fund expense",metric:"Commerce + cloud",horizon:"5+ years",minimum:"1 share or fractional",fit:["Growth","Active"],why:"Multiple growth engines and improving operating leverage can support long-term compounding.",caution:"High investment needs, retail margins and valuation create execution risk.",next:"Analyze AWS growth, retail margins, free cash flow and capital spending."},
  {id:"META",symbol:"META",name:"Meta Platforms",category:"Stocks & ETFs",subcategory:"Individual stock",score:83,risk:"Medium",cost:"No fund expense",metric:"Digital advertising",horizon:"5+ years",minimum:"1 share or fractional",fit:["Growth","Active"],why:"High margins and strong cash flow support investment and shareholder returns.",caution:"Regulation, platform shifts and heavy AI spending can pressure returns.",next:"Review engagement, ad pricing, capex, margins and regulatory exposure."},
  {id:"AAPL",symbol:"AAPL",name:"Apple",category:"Stocks & ETFs",subcategory:"Individual stock",score:72,risk:"Medium",cost:"No fund expense",metric:"Devices + services",horizon:"5+ years",minimum:"1 share or fractional",fit:["Balanced","Growth"],why:"Durable ecosystem, brand strength and recurring services revenue support quality.",caution:"Premium valuation, hardware cycles and geographic supply-chain exposure matter.",next:"Compare unit growth, services margins, China exposure and valuation history."},
  {id:"JPM",symbol:"JPM",name:"JPMorgan Chase",category:"Stocks & ETFs",subcategory:"Individual stock",score:84,risk:"Medium",cost:"No fund expense",metric:"Diversified banking",horizon:"5+ years",minimum:"1 share or fractional",fit:["Balanced","Growth"],why:"Diversified earnings, scale and capital strength can support resilience across cycles.",caution:"Credit losses, regulation and interest-rate shifts can reduce profitability.",next:"Review credit quality, capital ratios, net interest income and economic sensitivity."},
  {id:"XOM",symbol:"XOM",name:"Exxon Mobil",category:"Stocks & ETFs",subcategory:"Individual stock",score:78,risk:"Medium",cost:"No fund expense",metric:"Integrated energy",horizon:"3–7 years",minimum:"1 share or fractional",fit:["Balanced","Growth","Active"],why:"Cash generation and dividends can benefit from disciplined energy-market exposure.",caution:"Commodity prices, cyclicality and transition risks can reverse results quickly.",next:"Analyze oil assumptions, breakeven costs, capital returns and balance sheet."},
  {id:"COST",symbol:"COST",name:"Costco",category:"Stocks & ETFs",subcategory:"Individual stock",score:68,risk:"Medium",cost:"No fund expense",metric:"Membership retail",horizon:"5+ years",minimum:"1 share or fractional",fit:["Growth"],why:"Membership loyalty and execution quality make the business attractive.",caution:"The market price is far above the illustrative fair-value estimate, creating valuation risk.",next:"Wait for valuation support or stronger earnings that justify the premium."},
  {id:"NVDA",symbol:"NVDA",name:"NVIDIA",category:"Stocks & ETFs",subcategory:"Individual stock",score:74,risk:"High",cost:"No fund expense",metric:"AI semiconductors",horizon:"5+ years",minimum:"1 share or fractional",fit:["Growth","Active"],why:"AI infrastructure leadership creates exceptional growth potential.",caution:"Very high expectations, competition and a greater-than-25% illustrative valuation premium demand caution.",next:"Verify data-center growth, margins, supply, competition and fair-value assumptions."},
  {id:"QQQ",symbol:"QQQ",name:"Invesco QQQ ETF",category:"Stocks & ETFs",subcategory:"Growth ETF",score:76,risk:"Medium",cost:"0.20% expense",metric:"Nasdaq-100",horizon:"7+ years",minimum:"1 share or fractional",fit:["Growth","Active"],why:"Provides diversified access to large innovative growth companies.",caution:"Technology concentration and an elevated valuation can amplify drawdowns.",next:"Compare concentration, valuation and overlap with current holdings."},
  {id:"FXAIX",symbol:"FXAIX",name:"Fidelity 500 Index Fund",category:"Mutual Funds",subcategory:"Index mutual fund",score:89,risk:"Medium",cost:"0.015% expense",metric:"S&P 500 index",horizon:"5+ years",minimum:"Provider dependent",fit:["Balanced","Growth"],why:"Low-cost index exposure with automatic contribution support at many brokers.",caution:"End-of-day pricing only and the same large-cap concentration as an S&P 500 ETF.",next:"Confirm account availability, minimums, fees and tax location."},
  {id:"VTSAX",symbol:"VTSAX",name:"Vanguard Total Stock Market Index Fund",category:"Mutual Funds",subcategory:"Index mutual fund",score:90,risk:"Medium",cost:"0.04% expense",metric:"Broad U.S. equity market",horizon:"7+ years",minimum:"Often $3,000",fit:["Balanced","Growth"],why:"Broad diversification and simple recurring purchases for long-term portfolios.",caution:"Minimum investment and availability vary; equity drawdowns still apply.",next:"Compare VTSAX with an ETF share class and account-specific transaction fees."},
  {id:"VBTLX",symbol:"VBTLX",name:"Vanguard Total Bond Market Index Fund",category:"Mutual Funds",subcategory:"Bond mutual fund",score:81,risk:"Lower",cost:"0.05% expense",metric:"Investment-grade U.S. bonds",horizon:"3+ years",minimum:"Often $3,000",fit:["Conservative","Balanced"],why:"Can reduce total portfolio volatility and provide diversified bond exposure.",caution:"Prices can fall when yields rise, and income may not outpace inflation.",next:"Match duration and credit exposure to the date the money will be needed."},
  {id:"SPY-PUT",symbol:"SPY PUT",name:"SPY Protective Put · 30–60 DTE",category:"Options",subcategory:"Portfolio hedge",score:62,risk:"High",cost:"Premium + spread",metric:"Defined premium loss",horizon:"Short term",minimum:"100-share hedge unit",fit:["Active"],why:"Can define downside protection for an existing equity position.",caution:"Premium decays and repeated hedging can materially reduce long-term returns.",next:"A live option chain, implied volatility, Greeks and exact portfolio exposure are required."},
  {id:"COVERED-CALL",symbol:"CALL",name:"Covered Call · quality holding",category:"Options",subcategory:"Income strategy",score:66,risk:"High",cost:"Spread + assignment risk",metric:"100 shares per contract",horizon:"30–60 days",minimum:"100 shares",fit:["Active"],why:"May generate premium on shares you are already willing to sell.",caution:"Caps upside, does not remove downside and can create tax or assignment consequences.",next:"Evaluate strike, expiration, implied volatility, earnings dates and willingness to sell."},
  {id:"TBILL-13W",symbol:"13W T-BILL",name:"13-Week U.S. Treasury Bill",category:"Fixed Income",subcategory:"Treasury",score:92,risk:"Lower",cost:"Auction/broker terms",metric:"Short duration",horizon:"3 months",minimum:"Platform dependent",fit:["Conservative","Balanced","Growth","Active"],why:"Useful for near-term reserves where capital stability matters more than growth.",caution:"Reinvestment rates can fall and selling before maturity can change the result.",next:"Compare current after-tax yield with insured cash and the exact liquidity date."},
  {id:"TREASURY-10Y",symbol:"10Y UST",name:"10-Year U.S. Treasury Note",category:"Fixed Income",subcategory:"Treasury",score:73,risk:"Medium",cost:"Auction/broker terms",metric:"Longer rate duration",horizon:"7–10 years",minimum:"Platform dependent",fit:["Conservative","Balanced"],why:"Can provide income and diversification when matched to a long horizon.",caution:"Price is sensitive to inflation and interest-rate changes.",next:"Stress-test price sensitivity and compare after-tax income with shorter maturities."},
  {id:"BND",symbol:"BND",name:"Vanguard Total Bond Market ETF",category:"Fixed Income",subcategory:"Bond ETF",score:83,risk:"Lower",cost:"0.03% expense",metric:"Diversified investment-grade bonds",horizon:"3+ years",minimum:"1 share or fractional",fit:["Conservative","Balanced"],why:"Simple diversified bond allocation with daily liquidity.",caution:"Duration and credit exposure can still produce losses.",next:"Review SEC yield, duration, tax treatment and role in the total allocation."},
  {id:"DCA-VTI",symbol:"AUTO · VTI",name:"Total-market recurring plan",category:"Recurring Investing",subcategory:"Monthly plan",score:93,risk:"Medium",cost:"Fund cost + broker terms",metric:"Automated monthly purchase",horizon:"10+ years",minimum:"Custom amount",fit:["Balanced","Growth"],why:"Automates consistency and reduces the temptation to time every market move.",caution:"Automation must not compete with bills, emergency reserves or high-interest debt.",next:"Choose an affordable amount after obligations, then review allocation quarterly."},
  {id:"DCA-BAL",symbol:"AUTO · 60/40",name:"Balanced recurring portfolio",category:"Recurring Investing",subcategory:"Allocation plan",score:89,risk:"Lower",cost:"Underlying fund costs",metric:"60% stocks / 40% bonds",horizon:"5+ years",minimum:"Custom amount",fit:["Conservative","Balanced"],why:"Combines growth and stability in a repeatable contribution plan.",caution:"The allocation may be too cautious or aggressive depending on the real goal date.",next:"Set a goal, rebalance rule and contribution that leaves emergency cash intact."},
];
type OptionCandidateResult = { underlying:string; feed:string; asOf:string; contract:{contractSymbol:string;expiration:string;type:string;strike:number;dte:number;bid:number;ask:number;mid:number;spreadPct:number;delta:number;volume:number;score:number;iv:number|null;gamma:number|null;theta:number|null;vega:number|null;premium:number;maxLoss:number;breakeven:number}; rationale:string[]; warnings:string[] };
type MarketClockResult = {status:string;timestamp?:string;isOpen?:boolean;nextOpen?:string;nextClose?:string};
type StockQuote = {bid:number|null;ask:number|null;last:number|null;timestamp?:string|null};
type ManualMarketAssessment = {symbol:string;verdict:"favorable"|"caution"|"unrated";label:string;reason:string;bid:number|null;ask:number|null;last:number|null;changePct:number|null};
type JournalEntry = {id:string;createdAt:string;symbol:string;decision:string;timeframe:string;thesis:string;fundamentals:string;valuation:string;technical:string;news:string;risk:string;emotion:string;result:string};
type ConnectedFinance = {connections:Array<Record<string,any>>;accounts:Array<Record<string,any>>;holdings:Array<Record<string,any>>};
type HouseholdAccess = {role:string;household?:{id:string;name:string};members:Array<{user_id:string;role:string;status:string;email:string;display_name:string;accepted_at?:string|null}>;invitations:Array<{id:string;email:string;role:string;invitation_type?:"join_household"|"create_household";household_name?:string|null;status:string;expires_at:string;accepted_at?:string|null;accepted_by?:string|null}>;availableHouseholds:Array<{id:string;name:string;role:string}>};
type FinnhubResearch = {status:string;provider?:string;symbol:string;asOf?:string;quote?:{c?:number};profile?:{name?:string;marketCapitalization?:number};metrics?:Record<string,number>;news?:Array<unknown>;filings?:Array<unknown>;error?:string};
type LiveNewsArticle={title:string;description?:string|null;url:string;publishedAt?:string|null;source:string};
type MacroSeries={id:string;label:string;unit:string;group:string;status:string;value:number|null;date:string|null;change:number|null};

export default function Home({ initialTab = "Dashboard", initialInvestmentId, focusInvestmentAnalysis = false }: { initialTab?: string; initialInvestmentId?: string; focusInvestmentAnalysis?: boolean } = {}) {
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authStep, setAuthStep] = useState<"login" | "verify">("login");
  const [code, setCode] = useState("");
  const [verifyMethod, setVerifyMethod] = useState<"email" | "sms">("email");
  const [accountEmail, setAccountEmail] = useState("");
  const [destination, setDestination] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [pick, setPick] = useState(opportunities[0]);
  const [capital, setCapital] = useState(25000);
  const [risk, setRisk] = useState(0.5);
  const [entry, setEntry] = useState(181.46);
  const [stop, setStop] = useState(176.9);
  const [target, setTarget] = useState(192.5);
  const [question, setQuestion] = useState("I want to buy NVDA at $180");
  const [analyzed, setAnalyzed] = useState(false);
  const [aiAnswer,setAiAnswer]=useState("");
  const [aiBusy,setAiBusy]=useState(false);
  const calc = useMemo(() => {
    const max = (capital * risk) / 100,
      per = Math.max(0.01, Math.abs(entry - stop)),
      shares = Math.floor(max / per);
    return {
      max,
      shares,
      exposure: shares * entry,
      rr: Math.abs(target - entry) / per,
    };
  }, [capital, risk, entry, stop, target]);
  const [extraMortgage, setExtraMortgage] = useState(300);
  const [extraCard, setExtraCard] = useState(300);
  const [alertFilter, setAlertFilter] = useState("All");
  const [timezone, setTimezone] = useState("America/Phoenix");
  const [dailyLimit, setDailyLimit] = useState(60);
  const [travelMode, setTravelMode] = useState(false);
  const [decisionTime, setDecisionTime] = useState("10:15");
  const [intradayRefreshMinutes, setIntradayRefreshMinutes] = useState(15);
  const [decisionAlarmEnabled, setDecisionAlarmEnabled] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState("Checking permission…");
  const [pushEnabled,setPushEnabled]=useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [chartSymbol, setChartSymbol] = useState("NVDA");
  const [timeframe, setTimeframe] = useState("1Y");
  const [chartBars, setChartBars] = useState<Array<[number,number,number,number,number]>>([]);
  const [indicator, setIndicator] = useState("Bollinger Bands");
  const [feedNotice, setFeedNotice] = useState("Provider credentials required");
  const [accessToken, setAccessToken] = useState("");
  const [backendOverview, setBackendOverview] = useState<Record<string, number> | null>(null);
  const [cycleRange, setCycleRange] = useState<"1Y" | "5Y">("5Y");
  const [actionNotice, setActionNotice] = useState("");
  const [academyWeek, setAcademyWeek] = useState(0);
  const [completedWeeks, setCompletedWeeks] = useState<number[]>([]);
  const [quizChoice, setQuizChoice] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [assetSector, setAssetSector] = useState("All sectors");
  const [assetSort, setAssetSort] = useState("score");
  const [investmentCategory, setInvestmentCategory] = useState("Stocks & ETFs");
  const [investorProfile, setInvestorProfile] = useState("Balanced");
  const [selectedInvestmentId, setSelectedInvestmentId] = useState(initialInvestmentId || "SPY");
  const [advisorGoal, setAdvisorGoal] = useState("Build long-term wealth");
  const [advisorHorizon, setAdvisorHorizon] = useState("10+ years");
  const [advisorAmount, setAdvisorAmount] = useState(500);
  const [advisorPlanReady, setAdvisorPlanReady] = useState(false);
  const [marketLookup, setMarketLookup] = useState("");
  const [marketLookupNotice, setMarketLookupNotice] = useState("");
  const [liveResearch,setLiveResearch]=useState<FinnhubResearch|null>(null);
  const [researchStatus,setResearchStatus]=useState("Loading live fundamentals…");
  const [liveNews,setLiveNews]=useState<LiveNewsArticle[]>([]);
  const [newsStatus,setNewsStatus]=useState("Loading verified headlines…");
  const [macroSeries,setMacroSeries]=useState<MacroSeries[]>([]);
  const [macroStatus,setMacroStatus]=useState("Loading FRED macro context…");
  const [manualAssessment, setManualAssessment] = useState<ManualMarketAssessment|null>(null);
  const [portfolioGoal, setPortfolioGoal] = useState<"Swing"|"2–3 years"|"5 years"|"10+ years">("5 years");
  const [portfolioAccount,setPortfolioAccount]=useState<"Taxable brokerage"|"401(k)"|"Traditional IRA"|"Roth IRA">("Taxable brokerage");
  const [portfolioAmount, setPortfolioAmount] = useState(25000);
  const [portfolioMix, setPortfolioMix] = useState({cash:10,bonds:10,diversified:40,dividend:20,growth:20});
  const [portfolioNotice, setPortfolioNotice] = useState("");
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalForm, setJournalForm] = useState({symbol:"",decision:"Watch / wait",timeframe:"5 years",thesis:"",fundamentals:"",valuation:"",technical:"Bollinger Bands: ",news:"",risk:"",emotion:"Calm",result:"Not reviewed yet"});
  const [journalNotice, setJournalNotice] = useState("");
  const [connectedFinance, setConnectedFinance] = useState<ConnectedFinance>({connections:[],accounts:[],holdings:[]});
  const [familyTransactions,setFamilyTransactions]=useState<Array<Record<string,any>>>([]);
  const [plaidNotice, setPlaidNotice] = useState("Connect a read-only institution to begin syncing balances and transactions.");
  const [plaidBusy, setPlaidBusy] = useState(false);
  const [manualAccount,setManualAccount]=useState({alias:"",accountType:"Roth IRA",purpose:"Long-term"});
  const [manualAccountBusy,setManualAccountBusy]=useState(false);
  const [optionSymbol, setOptionSymbol] = useState("SPY");
  const [optionOutlook, setOptionOutlook] = useState("bullish");
  const [optionMaxRisk, setOptionMaxRisk] = useState(500);
  const [optionTargetDte, setOptionTargetDte] = useState(45);
  const [optionResult, setOptionResult] = useState<OptionCandidateResult|null>(null);
  const [optionNotice, setOptionNotice] = useState("");
  const [marketClock, setMarketClock] = useState<MarketClockResult>({status:"loading"});
  const [clockTick, setClockTick] = useState(Date.now());
  const [suggestionQuotes, setSuggestionQuotes] = useState<Record<string,StockQuote>>({});
  const [quoteStatus, setQuoteStatus] = useState("Connect market data for live bid/ask");
  const [bookNotice, setBookNotice] = useState("Upload your workbook securely to read it here.");
  const [readerUrl, setReaderUrl] = useState("");
  const [examAnswers,setExamAnswers]=useState<Record<number,number>>({});
  const [analysisStrategy, setAnalysisStrategy] = useState<"swing"|"position">("swing");
  const [householdAccess,setHouseholdAccess]=useState<HouseholdAccess|null>(null);
  const [workspaceAccess,setWorkspaceAccess]=useState<"checking"|"granted"|"invitation_required">("checking");
  const [inviteOpen,setInviteOpen]=useState(false);
  const [inviteEmail,setInviteEmail]=useState("");
  const [inviteRole,setInviteRole]=useState("investment_manager");
  const [invitationType,setInvitationType]=useState<"join_household"|"create_household">("join_household");
  const [invitedHouseholdName,setInvitedHouseholdName]=useState("");
  const [inviteNotice,setInviteNotice]=useState("");
  const [realtimeTick,setRealtimeTick]=useState(0),[realtimeStatus,setRealtimeStatus]=useState("AUTO REFRESH");
  const pathByTab: Record<string,string> = { Dashboard:"dashboard", Accounts:"accounts", "Market Intel":"markets", Portfolio:"portfolio", "Professional Charts":"charts", "Market News":"market-news", "Growth Finder":"growth", "Bills & cards":"cash-flow", Scanner:"opportunities", "Daily Action Plan":"daily-action-plan", Liabilities:"debt", Household:"household", "Ask Northstar":"assistant", "Prepare Trade":"planner", "Paper Simulator":"simulation", Journal:"journal", Learn:"academy", Settings:"settings", Help:"help" };
  const navigate = (next:string) => { window.location.assign(`/workspace/${pathByTab[next] || "dashboard"}`); };
  const marketPages = ["Market Intel", "Professional Charts", "Market News", "Growth Finder"];
  const breadcrumbParent = marketPages.includes(tab) && tab !== "Market Intel" ? "Market Intel" : null;
  const notify = (message:string) => { setActionNotice(message); window.setTimeout(() => setActionNotice(""), 4200); };
  const analyzeWithAI=async()=>{setAiBusy(true);setAnalyzed(false);setAiAnswer("");try{const response=await fetch("/api/ai/investment-coach",{method:"POST",headers:financeHeaders(),body:JSON.stringify({question,context:{symbol:chartSymbol,entry,stop,target,riskPercent:risk,calculatedShares:calc.shares,rewardRisk:calc.rr,marketData:chartBars.length?"connected":"demonstration only"}})}),data=await response.json();if(!response.ok)throw new Error(data.error||"Analysis unavailable");setAiAnswer(data.answer);setAnalyzed(true)}catch(error){setAiAnswer(error instanceof Error?error.message:"Analysis unavailable");setAnalyzed(true)}finally{setAiBusy(false)}};
  const cognitoConfigured = isCognitoConfigured();
  const globalTimezones = useMemo(() => {
    try { return (Intl as typeof Intl & { supportedValuesOf(key:"timeZone"):string[] }).supportedValuesOf("timeZone"); }
    catch { return ["Pacific/Honolulu","America/Anchorage","America/Los_Angeles","America/Phoenix","America/Denver","America/Chicago","America/New_York","America/Puerto_Rico","America/Santo_Domingo","Europe/London","Europe/Paris","Europe/Madrid","Africa/Cairo","Asia/Dubai","Asia/Kolkata","Asia/Singapore","Asia/Tokyo","Australia/Sydney"]; }
  }, []);
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const activeTimezone = travelMode || timezone === "auto" ? deviceTimezone : timezone;
  const localMarketClock = new Intl.DateTimeFormat("en-US", { timeZone: activeTimezone, weekday:"short", hour:"numeric", minute:"2-digit", timeZoneName:"short" }).format(new Date());
  const decisionTimeLabel = useMemo(()=>{
    const [hour,minute]=decisionTime.split(":").map(Number), now=new Date(), nyDateParts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
    const approximateUtc=new Date(`${nyDateParts.year}-${nyDateParts.month}-${nyDateParts.day}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00-04:00`);
    return new Intl.DateTimeFormat("en-US",{timeZone:activeTimezone,hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(approximateUtc);
  },[decisionTime,activeTimezone]);
  const clockTarget = marketClock.isOpen ? marketClock.nextClose : marketClock.nextOpen;
  const clockRemainingMs = clockTarget ? Math.max(0,new Date(clockTarget).getTime()-clockTick) : 0;
  const clockHours = Math.floor(clockRemainingMs/3600000), clockMinutes = Math.floor((clockRemainingMs%3600000)/60000),clockDays=Math.floor(clockHours/24),clockHourRemainder=clockHours%24;
  const marketCountdown=clockDays>0?`${clockDays}d ${clockHourRemainder}h ${clockMinutes}m`:`${clockHours}h ${clockMinutes}m`;
  const clockTargetLabel = clockTarget ? new Intl.DateTimeFormat("en-US",{timeZone:activeTimezone,weekday:"short",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(clockTarget)) : "";
  const nyParts = Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour12:false,weekday:"short",hour:"2-digit",minute:"2-digit"}).formatToParts(new Date(clockTick)).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
  const nyMinutes = Number(nyParts.hour)*60+Number(nyParts.minute), isWeekday = !["Sat","Sun"].includes(String(nyParts.weekday));
  const marketPhase = marketClock.status!=="connected"?"setup":marketClock.isOpen?"open":isWeekday&&nyMinutes>=240&&nyMinutes<570?"premarket":isWeekday&&nyMinutes>=960&&nyMinutes<1200?"afterhours":"closed";
  const marketClockText = marketPhase==="open"?`US MARKET OPEN · closes in ${marketCountdown}`:marketPhase==="premarket"?`US PRE-MARKET · opens in ${marketCountdown}`:marketPhase==="afterhours"?`US AFTER-HOURS · next open in ${marketCountdown}`:marketPhase==="closed"?`US MARKET CLOSED · opens in ${marketCountdown}`:"MARKET CLOCK SETUP REQUIRED";
  const displayedCandles=(chartBars.length?chartBars:candles).slice(-80),chartLow=Math.min(...displayedCandles.map(value=>value[2])),chartHigh=Math.max(...displayedCandles.map(value=>value[1])),chartSpan=Math.max(.01,chartHigh-chartLow),latestCandle=displayedCandles[displayedCandles.length-1],firstCandle=displayedCandles[0],chartChange=((latestCandle[3]-firstCandle[0])/firstCandle[0])*100;
  const technicalAnalysis=useMemo(()=>probabilityEngine(displayedCandles,analysisStrategy),[displayedCandles,analysisStrategy]);
  const movingAverages=useMemo(()=>{const closes=displayedCandles.map(bar=>bar[3]),last=closes.at(-1)||0,sma=(period:number)=>closes.length>=period?closes.slice(-period).reduce((sum,value)=>sum+value,0)/period:null,ema=(period:number)=>{if(closes.length<period)return null;const k=2/(period+1);return closes.reduce((value,close,index)=>index?close*k+value*(1-k):close)};return [{name:"EMA 9",value:ema(9),use:"Fast swing momentum"},{name:"EMA 20",value:ema(20),use:"Common swing pullback area"},{name:"EMA 21",value:ema(21),use:"Short-term trend support"},{name:"SMA 50",value:sma(50),use:"Intermediate trend"},{name:"SMA 100",value:sma(100),use:"Position-trend reference"},{name:"SMA 200",value:sma(200),use:"Long-term regime"}].map(item=>{const distance=item.value===null?null:((last-item.value)/item.value)*100,status=item.value===null?"Unavailable":last<item.value?"Broken / below":Math.abs(distance!)<=2?"Testing support":"Above support";return{...item,distance,status,last}})},[displayedCandles]);
  const chartInterpretation=useMemo(()=>{const latest=displayedCandles.at(-1)!,recent=displayedCandles.slice(-Math.min(20,displayedCandles.length)),recentHigh=Math.max(...recent.map(bar=>bar[1])),recentLow=Math.min(...recent.map(bar=>bar[2])),probability=technicalAnalysis.probability,direction=probability>=62?"Upward bias":probability<=38?"Downward bias":"Sideways / uncertain",confidence=Math.max(20,Math.min(90,probability>=50?probability:100-probability)-(technicalAnalysis.disagreement?15:0)-(chartBars.length?0:12)),relevantNames=analysisStrategy==="swing"?["EMA 9","EMA 20","EMA 21","SMA 50"]:["SMA 50","SMA 100","SMA 200"],relevant=movingAverages.filter(item=>relevantNames.includes(item.name)&&item.value!==null),holding=relevant.filter(item=>item.last>=item.value!),broken=relevant.filter(item=>item.last<item.value!),nearestSupport=holding.sort((a,b)=>b.value!-a.value!)[0]?.value??recentLow,nearestResistance=recentHigh,bullCase=latest[3]+technicalAnalysis.atr*(analysisStrategy==="swing"?2:4),bearCase=latest[3]-technicalAnalysis.atr*(analysisStrategy==="swing"?1.5:3);let suggestion="Wait—directional evidence is mixed. Do not force an entry.";if(analysisStrategy==="swing"&&direction==="Upward bias")suggestion=technicalAnalysis.relVol>=1.2?`Watch for a confirmed close above $${nearestResistance.toFixed(2)}, or a controlled pullback that holds $${nearestSupport.toFixed(2)}. Define risk before entry.`:`Do not chase. Wait for price to hold $${nearestSupport.toFixed(2)} and for volume or a bullish candle to confirm demand.`;if(analysisStrategy==="swing"&&direction==="Downward bias")suggestion=`Avoid a new long entry until price reclaims $${nearestSupport.toFixed(2)} with confirmation. Existing swing plans require an invalidation review.`;if(analysisStrategy==="position"&&direction==="Upward bias")suggestion="Long-term structure is constructive. If the investment still passes fundamentals, valuation, diversification, and account-fit checks, consider planned contributions rather than chasing one candle.";if(analysisStrategy==="position"&&direction==="Downward bias")suggestion="Long-term technical structure is weak. Review fundamentals and allocation; pause automatic increases if the thesis changed, but do not panic-sell from chart evidence alone.";return{direction,confidence,recentHigh,recentLow,nearestSupport,nearestResistance,bullCase,bearCase,holding,broken,suggestion,latest:latest[3],observation:`Price is $${latest[3].toFixed(2)} with ${technicalAnalysis.relVol.toFixed(2)}× relative volume. ${holding.length} relevant averages are holding and ${broken.length} are below price.`,evidence:`Model alignment is ${probability}% bullish${technicalAnalysis.disagreement?", with timeframe disagreement":""}. ${technicalAnalysis.best?`${technicalAnalysis.best.name} quality is ${technicalAnalysis.best.quality}/100.`:"No qualified candle pattern is active."}`,risk:`A move below $${nearestSupport.toFixed(2)} would weaken this ${analysisStrategy==="swing"?"swing":"long-term"} interpretation. News gaps can bypass technical levels.`}},[displayedCandles,technicalAnalysis,movingAverages,analysisStrategy,chartBars.length]);
  const volumeInterpretation=useMemo(()=>{const last=displayedCandles.at(-1)!,previous=displayedCandles.at(-2)!,closeLocation=(last[3]-last[2])/Math.max(.01,last[1]-last[2]),priceUp=last[3]>previous[3],highVolume=technicalAnalysis.relVol>=1.2,lowVolume=technicalAnalysis.relVol<.8;let label="Average participation",meaning="Volume is near its recent average and does not independently confirm direction.";if(highVolume&&priceUp&&closeLocation>.65){label="Demand confirmation";meaning="Price advanced and closed near the high on above-average volume. This supports—but does not prove—the bullish case."}else if(highVolume&&!priceUp&&closeLocation<.35){label="Distribution warning";meaning="Price declined and closed near the low on above-average volume. Selling pressure strengthens the bearish evidence."}else if(highVolume){label="High-volume conflict";meaning="Participation is elevated, but candle direction or closing location is inconclusive. Wait for follow-through."}else if(lowVolume){label="Weak participation";meaning="The move has below-average participation, so confidence is reduced until price and volume confirm together."}const pullbackLow=chartInterpretation.nearestSupport, pullbackHigh=pullbackLow+technicalAnalysis.atr*.35,breakout=chartInterpretation.nearestResistance+technicalAnalysis.atr*.08,stop=pullbackLow-technicalAnalysis.atr*(analysisStrategy==="swing"?.5:1);return{label,meaning,closeLocation,ratio:technicalAnalysis.relVol,pullbackLow,pullbackHigh,breakout,stop,firstTarget:chartInterpretation.nearestResistance,secondTarget:chartInterpretation.bullCase}},[displayedCandles,technicalAnalysis,chartInterpretation,analysisStrategy]);
  const visibleAssets = useMemo(() => marketAssets.filter(asset => (!assetQuery || `${asset.symbol} ${asset.name}`.toLowerCase().includes(assetQuery.toLowerCase())) && (assetSector==="All sectors" || asset.sector===assetSector)).sort((a,b)=>assetSort==="pe"?a.pe-b.pe:assetSort==="growth"?b.growth5y-a.growth5y:assetSort==="cap"?b.marketCap-a.marketCap:b.score-a.score),[assetQuery,assetSector,assetSort]);
  const categoryItems = useMemo(() => investmentCatalog.filter(item => item.category===investmentCategory && (!assetQuery || `${item.symbol} ${item.name} ${item.subcategory}`.toLowerCase().includes(assetQuery.toLowerCase()))).sort((a,b)=>assetSort==="risk"?(a.risk==="Lower"?-1:a.risk==="Medium"?0:1)-(b.risk==="Lower"?-1:b.risk==="Medium"?0:1):b.score-a.score),[investmentCategory,assetQuery,assetSort]);
  const advisorSuggestions = useMemo(() => investmentCatalog.filter(item=>item.category==="Stocks & ETFs"&&item.fit.includes(investorProfile)).map(item=>{const asset=marketAssets.find(value=>value.symbol===item.symbol),fair=modelFairValues[item.symbol],gap=asset&&fair?((asset.price-fair)/fair)*100:null,adjusted=item.score-(gap!==null&&gap>25?24:0)-(item.risk==="High"&&investorProfile!=="Active"?8:0);return {...item,gap,adjusted}}).sort((a,b)=>b.adjusted-a.adjusted).slice(0,5),[investorProfile]);
  const selectedInvestment = investmentCatalog.find(item=>item.id===selectedInvestmentId) || investmentCatalog[0];
  const selectedFit = selectedInvestment.fit.includes(investorProfile);
  const catalogFundamentals = marketAssets.find(asset=>asset.symbol===selectedInvestment.symbol);
  const liveMetrics=liveResearch?.symbol===selectedInvestment.symbol?liveResearch.metrics:undefined,livePrice=liveResearch?.symbol===selectedInvestment.symbol?Number(liveResearch.quote?.c)||0:0,livePe=Number(liveMetrics?.peTTM||liveMetrics?.peBasicExclExtraTTM||0),liveMarketCap=Number(liveResearch?.profile?.marketCapitalization||liveMetrics?.marketCapitalization||0)/1000;
  const selectedFundamentals=livePe>0&&liveMarketCap>0?{symbol:selectedInvestment.symbol,name:liveResearch?.profile?.name||selectedInvestment.name,sector:catalogFundamentals?.sector||"Provider",price:livePrice||catalogFundamentals?.price||0,pe:livePe,marketCap:liveMarketCap,growth5y:catalogFundamentals?.growth5y||0,score:catalogFundamentals?.score||selectedInvestment.score,risk:catalogFundamentals?.risk||selectedInvestment.risk}:catalogFundamentals;
  const selectedFairValue = modelFairValues[selectedInvestment.symbol];
  const selectedDividendYield = indicatedDividendYields[selectedInvestment.symbol];
  const valuationPremium = selectedFundamentals&&selectedFairValue ? ((selectedFundamentals.price-selectedFairValue)/selectedFairValue)*100 : null;
  const sellReview = valuationPremium!==null&&valuationPremium>25;
  const selectedQuote=suggestionQuotes[selectedInvestment.symbol],selectedReferencePrice=selectedQuote?.ask||selectedFundamentals?.price||0,allocationRate=investorProfile==="Conservative"?.05:investorProfile==="Balanced"?.075:investorProfile==="Growth"?.1:.12,positionBudget=Math.min(advisorAmount,capital*allocationRate),suggestedShares=selectedReferencePrice>0?positionBudget/selectedReferencePrice:0,selectedAction=sellReview?"SELL / REDUCE REVIEW":selectedFit&&selectedInvestment.score>=82?"BUY RESEARCH · WAIT FOR CONFIRMATION":selectedFit?"WATCH / HOLD":"AVOID · PROFILE MISMATCH";
  const valuationScore=selectedFundamentals?(selectedFundamentals.pe<=20?90:selectedFundamentals.pe<=30?75:selectedFundamentals.pe<=40?55:30):null,fiveYearScore=selectedFundamentals?Math.min(95,35+Math.log10(Math.max(1,selectedFundamentals.growth5y))*25):null,sizeScore=selectedFundamentals?(selectedFundamentals.marketCap>=100?85:selectedFundamentals.marketCap>=10?70:45):null,dividendScore=selectedDividendYield===undefined?null:selectedDividendYield===0?55:selectedDividendYield<=5?80:selectedDividendYield<=8?55:25,technicalReady=chartSymbol===selectedInvestment.symbol&&chartBars.length>=20,technicalScore=technicalReady?(chartBars[chartBars.length-1][3]>chartBars[chartBars.length-20][3]?75:40):null,decisionScores=[valuationScore,fiveYearScore,sizeScore,dividendScore,technicalScore].filter((value):value is number=>value!==null),transparentDecisionScore=decisionScores.length?Math.round(decisionScores.reduce((sum,value)=>sum+value,0)/decisionScores.length):null;
  const investmentAccounts=useMemo(()=>connectedFinance.accounts.filter(account=>account.type==="investment"||/401|ira|brokerage|retirement/i.test(`${account.type||""} ${account.subtype||""}`)),[connectedFinance.accounts]);
  const visibleFinanceAccounts=tab==="Portfolio"?investmentAccounts:connectedFinance.accounts;
  const swingAccounts=useMemo(()=>investmentAccounts.filter(account=>["Swing","Options"].includes(String(account.investment_purpose||""))),[investmentAccounts]);
  const swingAccountIds=useMemo(()=>new Set(swingAccounts.map(account=>String(account.id))),[swingAccounts]);
  const swingHoldings=useMemo(()=>connectedFinance.holdings.filter(holding=>swingAccountIds.has(String(holding.account_id))),[connectedFinance.holdings,swingAccountIds]);
  const ownedInvestmentSymbols=useMemo(()=>Array.from(new Set(connectedFinance.holdings.map(holding=>String(holding.ticker||"").trim().toUpperCase()).filter(Boolean))),[connectedFinance.holdings]);
  const longTermHoldings=useMemo(()=>connectedFinance.holdings.filter(holding=>["Long-term","Retirement","Dividend income","Mixed"].includes(String(holding.investment_purpose||""))),[connectedFinance.holdings]);
  const connectedPortfolioAnalysis=useMemo(()=>{const labels={cash:"Cash & short-term",bonds:"Fixed income",diversified:"Core diversified",dividend:"Dividend quality",growth:"Growth / individual stocks"},values={cash:0,bonds:0,diversified:0,dividend:0,growth:0},classify=(holding:Record<string,any>):keyof typeof values=>{const symbol=String(holding.ticker||"").toUpperCase(),name=`${holding.name||""} ${holding.type||""}`.toUpperCase();if(/CASH|MONEY MARKET|SWEEP|TREASURY BILL/.test(`${symbol} ${name}`))return"cash";if(/BOND|FIXED INCOME|BND|AGG|TLT|IEF|SHY|MUNI/.test(`${symbol} ${name}`))return"bonds";if(/SCHD|VYM|DGRO|DVY|DIVIDEND/.test(`${symbol} ${name}`))return"dividend";if(/VTI|VOO|SPY|IVV|ITOT|VXUS|TOTAL MARKET|S&P 500|INDEX 500/.test(`${symbol} ${name}`))return"diversified";return"growth"};const total=longTermHoldings.reduce((sum,item)=>sum+Number(item.market_value_cents||0),0)/100;const holdings=longTermHoldings.map(item=>{const value=Number(item.market_value_cents||0)/100,bucket=classify(item),weight=total?value/total*100:0;values[bucket]+=value;return{ticker:String(item.ticker||""),name:String(item.name||"Unknown holding"),value,bucket,weight}});const rows=(Object.keys(values) as Array<keyof typeof values>).map(key=>{const actual=total?values[key]/total*100:0,target=portfolioMix[key],delta=target-actual,status=Math.abs(delta)<=5?"balanced":delta>5?"underweight":"overweight",amount=Math.abs(delta)*total/100;return{key,label:labels[key],actual,target,delta,status,amount}});const concentration=holdings.filter(item=>item.weight>10).sort((a,b)=>b.weight-a.weight);return{total,rows,concentration}},[longTermHoldings,portfolioMix]);
  const connectedPortfolioValue=connectedPortfolioAnalysis.total,portfolioTotal=Object.values(portfolioMix).reduce((sum,value)=>sum+value,0),portfolioYears=portfolioGoal==="Swing"?1:portfolioGoal==="2–3 years"?3:portfolioGoal==="5 years"?5:20,weightedReturn=(portfolioMix.cash*3.5+portfolioMix.bonds*4.5+portfolioMix.diversified*7+portfolioMix.dividend*6.5+portfolioMix.growth*9)/Math.max(1,portfolioTotal)/100,portfolioProjected=portfolioAmount*Math.pow(1+weightedReturn,portfolioYears),portfolioLow=portfolioAmount*Math.pow(1+Math.max(-.05,weightedReturn-.08),portfolioYears),portfolioHigh=portfolioAmount*Math.pow(1+weightedReturn+.05,portfolioYears);
  const familyCapital=useMemo(()=>{const dollars=(cents:unknown)=>Number(cents||0)/100,liquidAccounts=connectedFinance.accounts.filter(account=>/depository|checking|savings|cash|money market/i.test(`${account.type||""} ${account.subtype||""}`)),debtAccounts=connectedFinance.accounts.filter(account=>/credit|loan|mortgage|line of credit/i.test(`${account.type||""} ${account.subtype||""}`)),liquid=liquidAccounts.reduce((sum,account)=>sum+Math.max(0,dollars(account.current_balance_cents)),0),invested=connectedFinance.holdings.reduce((sum,holding)=>sum+Math.max(0,dollars(holding.market_value_cents)),0),debt=debtAccounts.reduce((sum,account)=>sum+Math.abs(dollars(account.current_balance_cents)),0);return{liquid,invested,debt,net:liquid+invested-debt,liquidAccounts:liquidAccounts.length,debtAccounts:debtAccounts.length}},[connectedFinance.accounts,connectedFinance.holdings]);
  const monthlySpending=useMemo(()=>{const cutoff=Date.now()-92*86400000,recent=familyTransactions.filter(item=>Date.parse(String(item.posted_at||""))>=cutoff),monthKeys=[...new Set(recent.map(item=>String(item.posted_at||"").slice(0,7)).filter(Boolean))],months=Math.max(1,monthKeys.length),isDebt=(item:Record<string,any>)=>/payment|credit card|loan|mortgage|debt/i.test(`${item.category||""} ${item.description||""}`),isTransfer=(item:Record<string,any>)=>/transfer|internal/i.test(`${item.category||""} ${item.description||""}`),outflows=recent.filter(item=>item.direction==="outflow"),spending=outflows.filter(item=>!isDebt(item)&&!isTransfer(item)).reduce((sum,item)=>sum+Math.abs(Number(item.amount_cents||0))/100,0)/months,debtPayments=outflows.filter(isDebt).reduce((sum,item)=>sum+Math.abs(Number(item.amount_cents||0))/100,0)/months,income=recent.filter(item=>item.direction==="inflow"&&!isTransfer(item)).reduce((sum,item)=>sum+Math.abs(Number(item.amount_cents||0))/100,0)/months,safeLimit=income>0?Math.max(0,income-debtPayments)*.8:0,ratio=safeLimit>0?spending/safeLimit:0,state=safeLimit===0?"unknown":ratio>1?"danger":ratio>.85?"warning":"safe";return{spending,debtPayments,income,safeLimit,ratio,state,months,transactions:recent.length}},[familyTransactions]);
  const latestFinanceSync=connectedFinance.connections.map(item=>Date.parse(String(item.last_synced_at||""))).filter(Number.isFinite).sort((a,b)=>b-a)[0]||null;
  const applyPortfolioPreset = () => setPortfolioMix(portfolioGoal==="Swing"?{cash:55,bonds:0,diversified:20,dividend:5,growth:20}:portfolioGoal==="2–3 years"?{cash:35,bonds:40,diversified:20,dividend:5,growth:0}:portfolioGoal==="10+ years"?{cash:5,bonds:10,diversified:55,dividend:15,growth:15}:{cash:10,bonds:10,diversified:40,dividend:20,growth:20});
  const applyCoreDividendGrowthPreset = () => {setPortfolioGoal("5 years");setPortfolioMix({cash:0,bonds:0,diversified:40,dividend:30,growth:30});setPortfolioNotice("40% Core / 30% Dividend / 30% Growth applied. Review emergency cash and risk before using it.")};
  const savePortfolio = () => {if(portfolioTotal!==100){setPortfolioNotice(`Allocation totals ${portfolioTotal}%. Adjust it to exactly 100% before saving.`);return}localStorage.setItem("northstar-portfolio-plan",JSON.stringify({portfolioGoal,portfolioAccount,portfolioAmount,portfolioMix}));setPortfolioNotice("✓ Portfolio goal, account type, and target allocation saved on this device.")};
  const saveJournalEntry = () => {if(!journalForm.symbol.trim()||!journalForm.thesis.trim()||!journalForm.risk.trim()){setJournalNotice("Symbol, thesis, and invalidation/risk are required before saving.");return}const entry:JournalEntry={...journalForm,id:crypto.randomUUID(),createdAt:new Date().toISOString(),symbol:journalForm.symbol.trim().toUpperCase()};const next=[entry,...journalEntries];setJournalEntries(next);localStorage.setItem("northstar-decision-journal",JSON.stringify(next));setJournalNotice("✓ Decision saved. Return later to compare the outcome with the original reasoning.")};
  const financeHeaders=()=>({"Content-Type":"application/json",...(accessToken?{Authorization:`Bearer ${accessToken}`}:{}) ,...(typeof window!=="undefined"&&localStorage.getItem("northstar-household-id")?{"X-Household-ID":localStorage.getItem("northstar-household-id")!}:{})});
  const apiPayload=async(response:Response)=>{const text=await response.text();if(!text)return{};try{return JSON.parse(text)}catch{return{error:text.slice(0,240)}}};
  const loadHousehold=async()=>{try{const response=await fetch("/api/household",{headers:financeHeaders()}),data=await response.json() as HouseholdAccess&{error?:string;code?:string};if(!response.ok){if(data.code==="INVITATION_REQUIRED")setWorkspaceAccess("invitation_required");throw new Error(data.error||"Unable to load household access")}setHouseholdAccess(data);setWorkspaceAccess("granted")}catch(error){setInviteNotice(error instanceof Error?error.message:"Unable to load household access")}};
  const createInvitation=async(email:string,role:string,isResend=false,type: "join_household"|"create_household"=invitationType,householdName=invitedHouseholdName)=>{setInviteNotice(isResend?"Replacing and resending invitation…":"Creating secure invitation…");try{const response=await fetch("/api/household/invitations",{method:"POST",headers:financeHeaders(),body:JSON.stringify({email,role,invitationType:type,householdName})}),data=await apiPayload(response) as {error?:string;delivered?:boolean;acceptUrl?:string};if(!response.ok)throw new Error(data.error||`Invitation failed (${response.status})`);setInviteNotice(data.delivered?`✓ Invitation ${isResend?"resent":"emailed"}. It expires in 7 days.`:`✓ Replacement invitation created. Email delivery is not configured; secure link: ${data.acceptUrl}`);setInviteEmail("");setInvitedHouseholdName("");await loadHousehold()}catch(error){setInviteNotice(error instanceof Error?error.message:"Invitation failed")}};
  const inviteMember=()=>createInvitation(inviteEmail,inviteRole);
  const cancelInvitation=async(invitationId:string)=>{if(!window.confirm("Cancel this pending invitation? Its secure link will stop working."))return;setInviteNotice("Canceling invitation…");try{const response=await fetch("/api/household/invitations",{method:"DELETE",headers:financeHeaders(),body:JSON.stringify({invitationId})}),data=await apiPayload(response) as {error?:string};if(!response.ok)throw new Error(data.error||`Cancellation failed (${response.status})`);setInviteNotice("✓ Invitation canceled. Its previous link is inactive.");await loadHousehold()}catch(error){setInviteNotice(error instanceof Error?error.message:"Invitation could not be canceled")}};
  const removeHouseholdMember=async(memberUserId:string,name:string)=>{if(!window.confirm(`Remove ${name} from this household? They will lose access, but their previously synchronized household records will remain for audit continuity.`))return;setInviteNotice(`Removing ${name}…`);try{const response=await fetch("/api/household/members",{method:"DELETE",headers:financeHeaders(),body:JSON.stringify({memberUserId})}),data=await apiPayload(response) as {error?:string};if(!response.ok)throw new Error(data.error||`Removal failed (${response.status})`);setInviteNotice(`✓ ${name} was removed from this household.`);await loadHousehold()}catch(error){setInviteNotice(error instanceof Error?error.message:"Household member could not be removed")}};
  const acceptInvitation=async(token:string)=>{setInviteNotice("Accepting invitation…");try{const response=await fetch("/api/household/invitations/accept",{method:"POST",headers:financeHeaders(),body:JSON.stringify({token})}),data=await apiPayload(response) as {error?:string;householdId:string;role:string};if(!response.ok)throw new Error(data.error||"Unable to accept invitation");localStorage.setItem("northstar-household-id",data.householdId);sessionStorage.removeItem("northstar-pending-invite");history.replaceState({},"",location.pathname);setWorkspaceAccess("granted");setInviteNotice(`✓ Joined household as ${String(data.role).replaceAll("_"," ")}.`);await loadHousehold()}catch(error){setInviteNotice(error instanceof Error?error.message:"Unable to accept invitation")}};
  const switchHousehold=(householdId:string)=>{localStorage.setItem("northstar-household-id",householdId);loadHousehold();};
  useEffect(()=>{const urlToken=new URLSearchParams(window.location.search).get("invite");if(urlToken)sessionStorage.setItem("northstar-pending-invite",urlToken);if(!signedIn)return;loadHousehold();const token=urlToken||sessionStorage.getItem("northstar-pending-invite");if(token)acceptInvitation(token)},[signedIn,accessToken]);
  const loadConnectedFinance=async()=>{try{const[response,transactionResponse]=await Promise.all([fetch("/api/connections/plaid",{headers:financeHeaders()}),fetch("/api/transactions",{headers:financeHeaders(),cache:"no-store"})]),data=await response.json(),transactions=await transactionResponse.json();if(!response.ok)throw new Error(data.error||"Unable to load connected accounts");setConnectedFinance(data);if(transactionResponse.ok&&Array.isArray(transactions))setFamilyTransactions(transactions)}catch(error){setPlaidNotice(error instanceof Error?error.message:"Unable to load connected accounts")}};
  const updateInvestmentAccount=async(accountId:string,nickname:string,investmentPurpose:string)=>{setPlaidNotice("Saving investment account profile…");try{const response=await fetch("/api/connections/plaid",{method:"PATCH",headers:financeHeaders(),body:JSON.stringify({accountId,nickname,investmentPurpose})}),data=await apiPayload(response);if(!response.ok)throw new Error(data.error||"Unable to save account profile");await loadConnectedFinance();setPlaidNotice("✓ Nickname and investment purpose saved and verified from the database.");return true}catch(error){setPlaidNotice(error instanceof Error?error.message:"Unable to save account profile");return false}};
  const createManualInvestmentAccount=async()=>{setManualAccountBusy(true);setPlaidNotice("Creating manual investment account…");try{const response=await fetch("/api/connections/plaid",{method:"POST",headers:financeHeaders(),body:JSON.stringify({...manualAccount,source:"manual"})}),data=await apiPayload(response);if(!response.ok)throw new Error(`${data.error||"Unable to create manual investment account"}${data.code?` (${data.code})`:""}`);setManualAccount(value=>({...value,alias:""}));await loadConnectedFinance();setPlaidNotice("✓ Manual investment account created. Add and maintain its holdings manually; it is not synchronized by Plaid.")}catch(error){setPlaidNotice(error instanceof Error?error.message:"Unable to create manual investment account")}finally{setManualAccountBusy(false)}};
  const addManualHolding=async(accountId:string,holding:{ticker:string;name:string;quantity:number;averageCost:number;currentPrice:number})=>{setPlaidNotice(`Saving ${holding.ticker}…`);try{const response=await fetch("/api/connections/plaid",{method:"POST",headers:financeHeaders(),body:JSON.stringify({action:"add_manual_holding",accountId,...holding})}),data=await apiPayload(response);if(!response.ok)throw new Error(`${data.error||"Unable to save holding"}${data.code?` (${data.code})`:""}`);await loadConnectedFinance();setPlaidNotice(`✓ ${holding.ticker} saved in the manual portfolio.`);return true}catch(error){setPlaidNotice(error instanceof Error?error.message:"Unable to save holding");return false}};
  const syncPlaid=async(connectionId:string)=>{setPlaidBusy(true);setPlaidNotice("Synchronizing balances, transactions, and investment holdings…");try{const response=await fetch("/api/connections/plaid/sync",{method:"POST",headers:financeHeaders(),body:JSON.stringify({connectionId})}),data=await response.json();if(!response.ok)throw new Error(data.error||"Synchronization failed");setPlaidNotice(`✓ Synced ${data.accounts} accounts, ${data.holdings} holdings, and ${data.added+data.modified} transaction updates.`);await loadConnectedFinance()}catch(error){setPlaidNotice(error instanceof Error?error.message:"Synchronization failed")}finally{setPlaidBusy(false)}};
  const removePlaidConnection=async(connectionId:string,institution:string)=>{if(!window.confirm(`Remove ${institution}? This revokes Plaid access and permanently deletes only this connection's synchronized accounts, holdings, and transactions from Northstar.`))return;setPlaidBusy(true);setPlaidNotice(`Removing ${institution}…`);try{const response=await fetch("/api/connections/plaid",{method:"DELETE",headers:financeHeaders(),body:JSON.stringify({connectionId})}),data=await apiPayload(response);if(!response.ok)throw new Error(data.error||"Unable to remove connection");setPlaidNotice(`✓ ${data.institution||institution} was revoked and removed. Other household connections were not changed.`);await loadConnectedFinance()}catch(error){setPlaidNotice(error instanceof Error?error.message:"Unable to remove connection")}finally{setPlaidBusy(false)}};
  const connectPlaid=async()=>{setPlaidBusy(true);setPlaidNotice("Preparing secure Plaid Link…");try{const tokenResponse=await fetch("/api/connections/plaid/link-token",{method:"POST",headers:financeHeaders()}),tokenData=await apiPayload(tokenResponse);if(!tokenResponse.ok)throw new Error(tokenData.error||tokenData.error_message||`Plaid Link could not start (${tokenResponse.status})`);if(!(window as any).Plaid)await new Promise<void>((resolve,reject)=>{const script=document.createElement("script");script.src="https://cdn.plaid.com/link/v2/stable/link-initialize.js";script.onload=()=>resolve();script.onerror=()=>reject(new Error("Plaid Link could not load"));document.head.appendChild(script)});const handler=(window as any).Plaid.create({token:tokenData.link_token,onSuccess:async(publicToken:string,metadata:any)=>{setPlaidNotice("Securing the connection…");try{const exchange=await fetch("/api/connections/plaid/exchange",{method:"POST",headers:financeHeaders(),body:JSON.stringify({publicToken,institutionName:metadata?.institution?.name})}),result=await apiPayload(exchange);if(!exchange.ok)throw new Error(result.error||`Connection failed (${exchange.status})`);if(!result.id)throw new Error("Connection was accepted but no connection ID was returned.");await syncPlaid(result.id)}catch(error){setPlaidNotice(error instanceof Error?error.message:"Connection failed");setPlaidBusy(false)}},onExit:(error:any,metadata:any)=>{if(error){const details=[error.display_message||error.error_message||"Plaid Link closed with an error",error.error_code&&`code ${error.error_code}`,error.error_type&&`type ${error.error_type}`,error.request_id&&`request ${error.request_id}`,metadata?.institution?.name&&`institution ${metadata.institution.name}`,metadata?.status&&`status ${metadata.status}`].filter(Boolean);setPlaidNotice(details.join(" · "))}else if(metadata?.status)setPlaidNotice(`Plaid Link closed · status ${metadata.status}`);setPlaidBusy(false)}});handler.open()}catch(error){setPlaidNotice(error instanceof Error?error.message:"Plaid Link could not start");setPlaidBusy(false)}};
  const buildAdvisorPlan = () => {
    const targetId = advisorHorizon==="Less than 1 year" || advisorGoal==="Protect emergency money" ? "TBILL-13W" : advisorHorizon==="1–3 years" ? "BND" : advisorGoal==="Create reliable income" ? (investorProfile==="Conservative"?"BND":"VBTLX") : advisorGoal==="Invest automatically every month" ? (investorProfile==="Conservative"?"DCA-BAL":"DCA-VTI") : investorProfile==="Conservative" ? "DCA-BAL" : "VTI";
    const target = investmentCatalog.find(item=>item.id===targetId) || investmentCatalog[0];
    setSelectedInvestmentId(target.id);
    setInvestmentCategory(target.category);
    setAssetQuery("");
    setAdvisorPlanReady(true);
  };
  const searchMarket = async () => { const query=marketLookup.trim().toUpperCase();if(!query)return;setManualAssessment(null);const known=investmentCatalog.find(item=>item.symbol===query||item.name.toUpperCase().includes(query));if(known){setInvestmentCategory(known.category);setSelectedInvestmentId(known.id);setAssetQuery("");setMarketLookupNotice(`✓ ${known.symbol} found. See the color-coded suitability decision and explanation below.`);return}setMarketLookupNotice("Searching the connected market provider…");try{const response=await fetch(`/api/market/quote?symbol=${encodeURIComponent(query)}`),data=await response.json();if(!response.ok)throw new Error(data.status==="not_configured"?"Connect Alpaca in Settings to search the full live market.":data.error||"Symbol could not be loaded.");const bid=Number(data.latestQuote?.bp)||null,ask=Number(data.latestQuote?.ap)||null,last=Number(data.latestTrade?.p||data.dailyBar?.c)||null,previous=Number(data.prevDailyBar?.c)||null,changePct=last&&previous?((last-previous)/previous)*100:null,spreadPct=bid&&ask?((ask-bid)/((ask+bid)/2))*100:null;const verdict=spreadPct!==null&&spreadPct>1?"caution":changePct!==null&&changePct>0?"favorable":"unrated",label=verdict==="favorable"?"FAVORABLE FOR FURTHER RESEARCH":verdict==="caution"?"CAUTION · WIDE BID/ASK SPREAD":"NOT YET RATED · MORE DATA REQUIRED",reason=verdict==="favorable"?"Price has positive near-term confirmation and the quote is tradeable. This is not enough to call the company a good investment; fundamentals, valuation, five-year growth, debt, earnings and portfolio fit must still pass.":verdict==="caution"?"The current spread may create meaningful execution cost. Avoid acting until liquidity improves and full fundamental and valuation checks are available.":"A valid quote confirms the symbol exists, but price alone cannot establish that it is a good investment. Connect fundamentals and complete the full analysis before considering it.";setChartSymbol(query);setManualAssessment({symbol:query,verdict,label,reason,bid,ask,last,changePct});setMarketLookupNotice(`✓ ${query} found and given a preliminary market-quality check.`)}catch(error){setMarketLookupNotice(error instanceof Error?error.message:"Search failed")}};
  const findOptionContract = async () => {setOptionNotice("Scanning the live option chain…");setOptionResult(null);try{const response=await fetch("/api/market/options",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:optionSymbol,outlook:optionOutlook,maxRisk:optionMaxRisk,targetDte:optionTargetDte})}),data=await response.json();if(!response.ok)throw new Error(data.error||"No contract passed the filters.");setOptionResult(data);setOptionNotice("Exact contract candidate selected from the current chain.")}catch(error){setOptionNotice(error instanceof Error?error.message:"Option-chain analysis failed")}};
  const testMarketClock = async () => {setMarketClock({status:"loading"});try{const response=await fetch("/api/market/clock"),data=await response.json();setMarketClock(response.ok?data:{status:data.status||"not_configured"})}catch{setMarketClock({status:"unavailable"})}};
  const uploadAcademyBook = async (file:File) => { const form=new FormData();form.append("file",file);setBookNotice("Uploading securely…");try{const headers:HeadersInit=accessToken?{Authorization:`Bearer ${accessToken}`}:{},created=await fetch("/api/documents",{method:"POST",headers,body:form});const data=await created.json();if(!created.ok)throw new Error(data.error||"Upload failed");const response=await fetch(`/api/documents/${data.id}`,{headers});if(!response.ok)throw new Error("Book saved, but reader could not open it");const blobUrl=URL.createObjectURL(await response.blob());setReaderUrl(current=>{if(current)URL.revokeObjectURL(current);return blobUrl});setBookNotice(`${data.filename} is stored privately and ready to read.`)}catch(error){setBookNotice(error instanceof Error?error.message:"Upload failed")}};
  const emailIdentity = accountEmail.includes("@") ? accountEmail.split("@")[0] : "";
  const displayName = emailIdentity
    ? emailIdentity
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
    : "Account Owner";
  const displayInitials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  useEffect(() => {
    const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    setIsLocal(localHost);
    if (localHost && sessionStorage.getItem("northstar-local-preview") === "true") setSignedIn(true);
    if (!("serviceWorker" in navigator)) return;
    if (localHost) {
      navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
      if ("caches" in window) {
        caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  useEffect(() => {
    const session=getCognitoSession();
    if(session){setAccessToken(session.idToken);setAccountEmail(session.email||"");setSignedIn(true)}
    setAuthReady(true);
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    fetch("/api/overview", { headers })
      .then(async response => response.ok ? response.json() : null)
      .then(data => setBackendOverview(data))
      .catch(() => setBackendOverview(null));
  }, [signedIn, accessToken]);
  useEffect(()=>{let active=true;const load=()=>fetch("/api/market/clock").then(async response=>({ok:response.ok,data:await response.json()})).then(({ok,data})=>{if(active)setMarketClock(ok?data:{status:data.status||"not_configured"})}).catch(()=>{if(active)setMarketClock({status:"unavailable"})});load();const refresh=window.setInterval(load,60000),tick=window.setInterval(()=>setClockTick(Date.now()),30000);return()=>{active=false;window.clearInterval(refresh);window.clearInterval(tick)}},[]);
  useEffect(()=>{let active=true;setFeedNotice("Loading historical data…");fetch(`/api/market/bars?symbol=${encodeURIComponent(chartSymbol)}&range=${timeframe}`).then(async response=>({ok:response.ok,data:await response.json()})).then(({ok,data})=>{if(!active)return;if(!ok){setChartBars([]);setFeedNotice(data.status==="not_configured"?"Connect live market data in Settings":"Historical data unavailable");return}setChartBars(data.bars.map((bar:{open:number;high:number;low:number;close:number;volume:number})=>[bar.open,bar.high,bar.low,bar.close,bar.volume]));setFeedNotice(`${data.feed.toUpperCase()} · ${data.range} history · refreshed ${new Date().toLocaleTimeString()}`)}).catch(()=>{if(active){setChartBars([]);setFeedNotice("Historical data unavailable")}});return()=>{active=false}},[chartSymbol,timeframe,realtimeTick]);
  useEffect(()=>{let active=true;const symbols=advisorSuggestions.map(item=>item.symbol).filter(symbol=>/^[A-Z.]{1,10}$/.test(symbol));if(!symbols.length)return;fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(","))}`).then(async response=>({ok:response.ok,data:await response.json()})).then(({ok,data})=>{if(!active)return;if(!ok){setSuggestionQuotes({});setQuoteStatus(data.status==="not_configured"?"Connect market data for live bid/ask":"Live quotes unavailable");return}setSuggestionQuotes(data.quotes);setQuoteStatus(`${data.feed.toUpperCase()} quotes · ${new Date(data.asOf).toLocaleTimeString()} · auto`)}).catch(()=>{if(active)setQuoteStatus("Live quotes unavailable")});return()=>{active=false}},[advisorSuggestions,realtimeTick]);
  useEffect(()=>{if(selectedInvestment.category!=="Stocks & ETFs")return;let active=true;setResearchStatus("Loading live Finnhub fundamentals…");fetch(`/api/market/research?symbol=${encodeURIComponent(selectedInvestment.symbol)}`).then(async response=>({ok:response.ok,data:await apiPayload(response) as FinnhubResearch})).then(({ok,data})=>{if(!active)return;if(!ok){setLiveResearch(null);setResearchStatus(data.status==="not_configured"?"Finnhub is not configured":data.error||"Live fundamentals unavailable");return}setLiveResearch(data);const available=Object.keys(data.metrics||{}).length;setResearchStatus(`Finnhub connected · ${available} metrics · ${data.asOf?new Date(data.asOf).toLocaleString():"current request"}`)}).catch(error=>{if(active){setLiveResearch(null);setResearchStatus(error instanceof Error?error.message:"Live fundamentals unavailable")}});return()=>{active=false}},[selectedInvestment.symbol,selectedInvestment.category]);
  useEffect(()=>{if(!["Market News","Market Intel","Dashboard"].includes(tab))return;let active=true;setNewsStatus("Loading verified NewsAPI.ai headlines…");fetch("/api/market/news").then(async response=>({ok:response.ok,data:await apiPayload(response)})).then(({ok,data})=>{if(!active)return;if(!ok){setLiveNews([]);setNewsStatus(data.error||"News feed unavailable");return}setLiveNews(data.articles||[]);setNewsStatus(`NewsAPI.ai connected · ${data.articles?.length||0} headlines · ${new Date(data.asOf).toLocaleString()} · auto`)}).catch(error=>{if(active){setLiveNews([]);setNewsStatus(error instanceof Error?error.message:"News feed unavailable")}});return()=>{active=false}},[tab,realtimeTick]);
  useEffect(()=>{if(!["Market News","Market Intel","Dashboard","Growth Finder"].includes(tab))return;let active=true;setMacroStatus("Loading FRED macro context…");fetch("/api/market/macro").then(async response=>({ok:response.ok,data:await apiPayload(response)})).then(({ok,data})=>{if(!active)return;if(!ok){setMacroSeries([]);setMacroStatus(data.error||"Macroeconomic data unavailable");return}setMacroSeries(data.series||[]);setMacroStatus(`FRED connected · ${data.series?.filter((item:MacroSeries)=>item.status==="available").length||0} series · ${new Date(data.asOf).toLocaleString()}`)}).catch(error=>{if(active){setMacroSeries([]);setMacroStatus(error instanceof Error?error.message:"Macroeconomic data unavailable")}});return()=>{active=false}},[tab]);
  useEffect(() => {
    if (initialTab !== "Ask Northstar") return;
    const savedPrompt = sessionStorage.getItem("northstar-full-analysis-prompt");
    if (!savedPrompt) return;
    setQuestion(savedPrompt);
    sessionStorage.removeItem("northstar-full-analysis-prompt");
  }, [initialTab]);
  useEffect(()=>{if(initialTab!=="Professional Charts")return;const saved=sessionStorage.getItem("northstar-chart-symbol");if(saved){setChartSymbol(saved);setMarketLookup(saved);sessionStorage.removeItem("northstar-chart-symbol")}},[initialTab]);
  useEffect(()=>{try{const saved=localStorage.getItem("northstar-portfolio-plan");if(!saved)return;const plan=JSON.parse(saved);if(["Swing","2–3 years","5 years","10+ years"].includes(plan.portfolioGoal))setPortfolioGoal(plan.portfolioGoal);if(["Taxable brokerage","401(k)","Traditional IRA","Roth IRA"].includes(plan.portfolioAccount))setPortfolioAccount(plan.portfolioAccount);if(Number.isFinite(plan.portfolioAmount))setPortfolioAmount(plan.portfolioAmount);if(plan.portfolioMix&&["cash","bonds","diversified","dividend","growth"].every(key=>Number.isFinite(plan.portfolioMix[key])))setPortfolioMix(plan.portfolioMix)}catch{setPortfolioNotice("Saved portfolio plan could not be loaded.")}},[]);
  useEffect(()=>{try{const saved=localStorage.getItem("northstar-market-alert-settings");if(!saved)return;const settings=JSON.parse(saved);if(typeof settings.timezone==="string")setTimezone(settings.timezone);if(typeof settings.travelMode==="boolean")setTravelMode(settings.travelMode);if(/^\d{2}:\d{2}$/.test(settings.decisionTime||""))setDecisionTime(settings.decisionTime);if([5,15,30,60].includes(Number(settings.intradayRefreshMinutes)))setIntradayRefreshMinutes(Number(settings.intradayRefreshMinutes));if(typeof settings.decisionAlarmEnabled==="boolean")setDecisionAlarmEnabled(settings.decisionAlarmEnabled);if(Number.isFinite(settings.dailyLimit))setDailyLimit(settings.dailyLimit)}catch{}},[]);
  useEffect(()=>{localStorage.setItem("northstar-market-alert-settings",JSON.stringify({timezone,travelMode,decisionTime,intradayRefreshMinutes,decisionAlarmEnabled,dailyLimit}))},[timezone,travelMode,decisionTime,intradayRefreshMinutes,decisionAlarmEnabled,dailyLimit]);
  useEffect(()=>{if(!decisionAlarmEnabled||!pushEnabled||!("Notification" in window)||Notification.permission!=="granted")return;const check=()=>{const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour12:false,hour:"2-digit",minute:"2-digit"}).formatToParts(new Date()).filter(part=>part.type!=="literal").map(part=>[part.type,part.value])),today=new Date().toISOString().slice(0,10),key=`northstar-decision-alarm-${today}`;if(!["Sat","Sun"].includes(String(parts.weekday))&&`${parts.hour}:${parts.minute}`===decisionTime&&localStorage.getItem(key)!=="sent"){new Notification("Northstar decision window",{body:"The live market plan has been refreshed. Review triggers, risk, and invalidation before taking any action."});localStorage.setItem(key,"sent")}};check();const timer=window.setInterval(check,30000);return()=>window.clearInterval(timer)},[decisionAlarmEnabled,pushEnabled,decisionTime]);
  useEffect(()=>{try{const saved=localStorage.getItem("northstar-decision-journal");if(saved)setJournalEntries(JSON.parse(saved));const reflection=sessionStorage.getItem("northstar-journal-reflection");if(initialTab==="Journal"&&reflection){setJournalForm(current=>({...current,thesis:reflection}));sessionStorage.removeItem("northstar-journal-reflection")}}catch{setJournalNotice("Saved journal entries could not be loaded.")}},[initialTab]);
  useEffect(()=>{if(["Dashboard","Accounts","Portfolio","Market Intel","Scanner","Prepare Trade","Professional Charts"].includes(initialTab)&&signedIn)loadConnectedFinance()},[initialTab,signedIn,accessToken]);
  useEffect(()=>{if(!signedIn)return;if(initialTab==="Household")loadHousehold();if(["Dashboard","Accounts","Portfolio","Market Intel","Scanner","Prepare Trade","Professional Charts"].includes(initialTab))loadConnectedFinance()},[realtimeTick]);
  useEffect(()=>{if(initialTab!=="Household"||!signedIn)return;const timer=window.setInterval(()=>loadHousehold(),10000);return()=>window.clearInterval(timer)},[initialTab,signedIn,accessToken]);
  useEffect(()=>{if(initialTab==="Household"&&sessionStorage.getItem("northstar-open-invite")==="true"){sessionStorage.removeItem("northstar-open-invite");setInviteOpen(true)}},[initialTab]);
  const socialLogin = async () => {
    setAuthNotice("");
    try { await startCognitoLogin(); }
    catch(error){setAuthNotice(error instanceof Error?error.message:"Unable to start sign-in.")}
  };
  const sendOtp = async () => socialLogin();
  const verifyOtp = async () => socialLogin();
  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setNotifyStatus("Not supported on this device");
      return;
    }
    const result = await Notification.requestPermission();
    if(result==="granted"){localStorage.setItem("northstar-push-enabled","true");setPushEnabled(true)}
    setNotifyStatus(
      result === "granted"
        ? "Device permission granted · server push setup required"
        : result === "denied"
          ? "Blocked in browser settings"
          : "Not enabled",
    );
  };
  useEffect(()=>{if(!("Notification" in window)){setNotifyStatus("Not supported on this device");return}const appOn=localStorage.getItem("northstar-push-enabled")!=="false"&&Notification.permission==="granted";setPushEnabled(appOn);setNotifyStatus(Notification.permission==="granted"?(appOn?"Northstar alerts ON · browser permission granted":"Northstar alerts OFF · browser permission remains granted"):Notification.permission==="denied"?"Blocked in browser settings":"Not enabled")},[]);
  const notifyClass=notifyStatus.includes("alerts ON")||notifyStatus.startsWith("Enabled")||notifyStatus.startsWith("Device permission")?"enabled":notifyStatus.startsWith("Blocked")?"blocked":notifyStatus.startsWith("Not supported")?"unsupported":notifyStatus.startsWith("Checking")?"checking":"disabled";
  const navigationGroups = [
    {name:"Household Finance",items:[["Dashboard","⌂"],["Accounts","▣"],["Bills & cards","$"],["Liabilities","▥"],["Household","♧"]]},
    {name:"Long-Term Investing",items:[["Portfolio","◫"],["Growth Finder","↗"]]},
    {name:"Swing Trade Decisions",items:[["Daily Action Plan","☀"],["Market Intel","✦"],["Scanner","⌕"],["Prepare Trade","◎"]]},
    {name:"Charts & Decision Review",items:[["Professional Charts","⌁"],["Journal","▤"]]},
    {name:"Market News & Context",items:[["Market News","●"]]},
    {name:"Academy & Simulation",items:[["Learn","◇"],["Paper Simulator","◎"]]},
    {name:"System",items:[["Settings","⚙"]]},
  ];
  const navigationLabels:Record<string,string>={"Market Intel":"Smart Suggestions",Scanner:"Opportunity Scanner","Prepare Trade":"Prepare Trade Plan","Professional Charts":"Chart Analysis",Journal:"Decision Journal",Learn:"Trading Academy","Paper Simulator":"Practice Simulator"};
  const familyRole=householdAccess?.role||"owner",studentOnly=familyRole==="student";
  const visibleNavigationGroups=studentOnly?navigationGroups.filter(group=>group.name==="Academy & Simulation").map(group=>({...group,items:group.items.filter(([name])=>name==="Learn"||name==="Paper Simulator")})):navigationGroups;
  useEffect(()=>{if(studentOnly&&!['Learn','Paper Simulator'].includes(initialTab))window.location.replace('/workspace/academy')},[studentOnly,initialTab]);
  const demonstrationAlerts = [
    {
      level: "ACT NOW TO REVIEW",
      category: "Trade / Tariffs",
      time: "8 min ago",
      title: "New semiconductor export restriction announced",
      source: "U.S. Department of Commerce · Primary source",
      impact: "Directly affects 12% of your portfolio",
      confidence: 91,
      move: "+8.4%",
      action: "Review exposure",
    },
    {
      level: "IMPORTANT",
      category: "Defense",
      time: "24 min ago",
      title: "Federal contract expands domestic drone procurement",
      source: "U.S. Department of Defense · Contract notice",
      impact: "Two suppliers and one ETF may benefit",
      confidence: 86,
      move: "+3.1%",
      action: "Research beneficiaries",
    },
    {
      level: "WATCH",
      category: "Healthcare / FDA",
      time: "1 hr ago",
      title: "FDA decision expected tomorrow for a major holding",
      source: "FDA calendar · Confirmed date",
      impact: "Options IV elevated; gap risk is material",
      confidence: 78,
      move: "−0.6%",
      action: "Review position risk",
    },
    {
      level: "INFO",
      category: "Institutional Activity",
      time: "3 hr ago",
      title: "Large fund disclosed a new energy-grid position",
      source: "SEC 13F · Delayed public filing",
      impact: "Disclosure is up to 45 days delayed",
      confidence: 64,
      move: "+0.9%",
      action: "Study, do not copy",
    },
  ];
  const alerts=liveNews.length?liveNews.slice(0,20).map(article=>({level:/fed|rate|inflation|earnings|tariff|sec |fda|merger/i.test(article.title)?"IMPORTANT":"INFO",category:"MARKET NEWS",time:article.publishedAt?new Date(article.publishedAt).toLocaleString():"Timestamp unavailable",title:article.title,source:`${article.source} · NewsAPI.ai discovery`,impact:article.description||"Open the source and evaluate portfolio exposure, financial impact, and price reaction.",confidence:55,move:"Not calculated",action:"Read and verify",url:article.url})):demonstrationAlerts;
  const visibleAlerts =
    alertFilter === "All"
      ? alerts
      : alerts.filter((a) => a.level === alertFilter);
  const bills = [
    {
      name: "Mortgage",
      category: "Housing",
      amount: 2148,
      due: "Sep 1",
      autopay: true,
      change: 0,
    },
    {
      name: "APS Electricity",
      category: "Utilities",
      amount: 186,
      due: "Sep 4",
      autopay: true,
      change: 18,
    },
    {
      name: "Internet",
      category: "Utilities",
      amount: 79,
      due: "Sep 8",
      autopay: true,
      change: 0,
    },
    {
      name: "Auto Insurance",
      category: "Insurance",
      amount: 214,
      due: "Sep 12",
      autopay: false,
      change: 12,
    },
    {
      name: "Mobile Family Plan",
      category: "Phone",
      amount: 164,
      due: "Sep 15",
      autopay: true,
      change: 0,
    },
    {
      name: "Streaming bundle",
      category: "Subscriptions",
      amount: 47,
      due: "Sep 19",
      autopay: true,
      change: 7,
    },
  ];
  const cards = [
    {
      name: "Visa Signature",
      balance: 8420,
      limit: 12000,
      statement: 7910,
      min: 248,
      due: "Sep 6",
      apr: 24.9,
      rewards: "12,480 pts",
    },
    {
      name: "Everyday Cash",
      balance: 1260,
      limit: 8500,
      statement: 1184,
      min: 45,
      due: "Sep 14",
      apr: 19.49,
      rewards: "$86.20",
    },
    {
      name: "Travel Card",
      balance: 390,
      limit: 15000,
      statement: 390,
      min: 35,
      due: "Sep 22",
      apr: 21.99,
      rewards: "34,120 mi",
    },
  ];
  const monthlyBills = bills.reduce((s, b) => s + b.amount, 0);
  const cardMinimums = cards.reduce((s, c) => s + c.min, 0);
  const monthlyIncome = 9200;
  const freeCash = monthlyIncome - monthlyBills - cardMinimums - 3258;
  const debts = [
    {
      name: "Visa Signature",
      type: "Credit card",
      balance: 8420,
      apr: 24.9,
      payment: 260,
      urgency: "Critical",
    },
    {
      name: "Home Mortgage",
      type: "Mortgage",
      balance: 287640,
      apr: 4.125,
      payment: 2148,
      urgency: "Manage",
    },
    {
      name: "Tesla Model Y",
      type: "Auto loan",
      balance: 31800,
      apr: 6.49,
      payment: 612,
      urgency: "Review",
    },
    {
      name: "Federal Student Loans",
      type: "Student loan",
      balance: 22450,
      apr: 4.8,
      payment: 238,
      urgency: "Manage",
    },
  ];
  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const weightedApr =
    debts.reduce((sum, d) => sum + d.balance * d.apr, 0) / totalDebt;
  if (!authReady)
    return (
      <main className="auth-loading" aria-busy="true" aria-live="polite" aria-label="Checking secure sign-in">
        <section><div className="auth-loading-mark">N</div><b>NORTHSTAR</b><span className="auth-loading-spinner" aria-hidden="true"/><p>Checking secure sign-in…</p><small>No financial workspace is displayed until authentication is confirmed.</small></section>
      </main>
    );
  if (!signedIn)
    return (
      <main className="auth-page">
        <section className="auth-brand">
          <span>N</span>
          <b>NORTHSTAR</b>
          <p>
            One intelligent financial home for investing, trading, debt, and the
            people you trust.
          </p>
          <blockquote>
            Protect the household first.
            <br />
            Build wealth with a repeatable process.
          </blockquote>
        </section>
        <section className="auth-panel">
          {authStep === "login" ? (
            <div className="auth-box">
              <p className="kicker">SECURE HOUSEHOLD ACCESS</p>
              <h1>Welcome to Northstar</h1>
              <p>Sign in to see your private financial workspace.</p>
              <button
                className={`oauth ${cognitoConfigured ? "" : "disabled"}`}
                onClick={socialLogin}
              >
                <b>G</b> Continue with Google <span>{cognitoConfigured ? "AWS Cognito" : "Setup required"}</span>
              </button>
              <div className="or">
                <i />
                or
                <i />
              </div>
              <label>
                Account email
                <input
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value.trim())}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />
              </label>
              <button
                className="primary full-auth"
                disabled={!accountEmail.includes("@")}
                onClick={() => {
                  setVerifyMethod("email");
                  setDestination(accountEmail);
                  setAuthStep("verify");
                  setAuthNotice("");
                }}
              >
                Continue to verification
              </button>
              <small>
                Enter the account email first. Verification and the localhost
                developer bypass are available on the next step.
              </small>
              <div className="auth-legal"><a href="/privacy">Privacy Policy</a><span>Northstar uses read-only financial connections and never executes trades.</span></div>
            </div>
          ) : (
            <div className="auth-box">
              <button className="back" onClick={() => setAuthStep("login")}>
                ← Back
              </button>
              <p className="kicker">IDENTITY VERIFICATION</p>
              <h1>Continue with AWS Cognito</h1>
              <p>
                Cognito securely manages verification, recovery, MFA, and account creation.
              </p>
              <div className="method-tabs">
                <button
                  className={verifyMethod === "email" ? "active" : ""}
                  onClick={() => {
                    setVerifyMethod("email");
                    setDestination(accountEmail);
                    setAuthNotice("");
                  }}
                >
                  Email
                </button>
                <button
                  className={verifyMethod === "sms" ? "active" : ""}
                  onClick={() => {
                    setVerifyMethod("sms");
                    setDestination("");
                    setAuthNotice("");
                  }}
                >
                  SMS
                </button>
              </div>
              <label>
                {verifyMethod === "email" ? "Email address" : "Mobile number"}
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={
                    verifyMethod === "email"
                      ? "you@example.com"
                      : "+1 555 123 4567"
                  }
                  type={verifyMethod === "email" ? "email" : "tel"}
                />
              </label>
              <button
                className="primary full-auth"
                disabled={!destination}
                onClick={sendOtp}
              >
                Open secure Cognito sign-in
              </button>
              {authNotice && (
                <div className="provider-warning">
                  <b>Provider required</b>
                  <span>{authNotice}</span>
                </div>
              )}
              <label className="code-label">
                Verification code
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  inputMode="numeric"
                  className="code"
                  disabled={!authNotice.startsWith("Code sent")}
                />
              </label>
              <button className="primary full-auth" disabled={code.length !== 6} onClick={verifyOtp}>
                Verify and enter Northstar
              </button>
              {isLocal && (
                  <button
                    className="dev-bypass"
                    disabled={!accountEmail.includes("@")}
                    onClick={() => {
                      sessionStorage.setItem("northstar-local-preview", "true");
                      setAuthNotice("Local UI preview only. Backend development authentication must also be explicitly enabled in .env.local.");
                      setSignedIn(true);
                    }}
                  >
                    Developer bypass · localhost only
                  </button>
                )}
              <div className="security-note">
                <b>◈ No fake verification</b>
                <span>
                  Northstar will enable this form only after email/SMS delivery
                  and server-side verification are configured.
                </span>
              </div>
            </div>
          )}
        </section>
      </main>
    );
  if(workspaceAccess==="checking")return <main className="auth-loading" aria-busy="true"><section><div className="auth-loading-mark">N</div><b>NORTHSTAR</b><span className="auth-loading-spinner" aria-hidden="true"/><p>Validating invitation and household access…</p><small>Authentication alone does not grant access.</small></section></main>;
  if(workspaceAccess==="invitation_required")return <main className="auth-page"><section className="auth-brand"><span>N</span><b>NORTHSTAR</b><p>Private family financial workspaces begin with a verified invitation.</p><blockquote>Identity verified.<br/>Workspace access not granted.</blockquote></section><section className="auth-panel"><div className="auth-box"><p className="kicker">INVITATION REQUIRED</p><h1>Open your invitation link</h1><p>{inviteNotice||"Signing in with Google is not enough to create a Northstar workspace."}</p><div className="security-note"><b>How to enter</b><span>Ask a Northstar owner to send an invitation to this exact email address. Open the link from your inbox, then authenticate with that same address.</span></div><button className="primary full-auth" type="button" onClick={()=>{setSignedIn(false);setAccessToken("");signOutCognito()}}>Sign out</button><div className="auth-legal"><a href="/privacy">Privacy Policy</a><span>No financial data is available without membership.</span></div></div></section></main>;
  return (
    <main className={`workspace-view page-${(pathByTab[tab] || "dashboard").replace(/[^a-z-]/g, "")} ${focusInvestmentAnalysis?"page-research-detail":""}`}>
      <RealtimeSync accessToken={accessToken} refreshMinutes={intradayRefreshMinutes} onStatus={setRealtimeStatus} onEvent={()=>setRealtimeTick(value=>value+1)} />
      <header>
        <div className="brand">
          <span>N</span>
          <b>NORTHSTAR</b>
          <small>MARKET COPILOT</small>
        </div>
        <div className={`open ${marketPhase}`} role="button" tabIndex={0} onClick={()=>window.location.assign("/workspace/settings#market-data-settings")} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")window.location.assign("/workspace/settings#market-data-settings")}} title={clockTargetLabel?`${marketClock.isOpen?"Closes":"Next opens"} ${clockTargetLabel}`:"Open Market Data & Clock setup"}>
          <i />
          <span>{marketClockText}<small>{clockTargetLabel&&` · ${marketClock.isOpen?"close":"open"} ${clockTargetLabel}`}</small></span>
        </div>
        <div className="head-actions">
          <span className={`realtime-status ${realtimeStatus==="LIVE SYNC"?"live":"fallback"}`} title={realtimeStatus==="LIVE SYNC"?"Streaming application updates. Market freshness still depends on provider entitlements.":"Market views refresh periodically. Plaid refreshes only when the institution synchronizes."}><i />{realtimeStatus}</span>
          {!studentOnly&&["owner","co_owner"].includes(familyRole)&&<button className="invite-family-link" onClick={()=>{sessionStorage.setItem("northstar-open-invite","true");navigate("Household")}}>♧ Invite family</button>}
          <button
            className="help-link"
            onClick={() => navigate("Help")}
          >
            ? Help & Guide
          </button>
          <button onClick={() => { const symbol=window.prompt("Enter a stock or ETF symbol",chartSymbol); if(symbol){sessionStorage.setItem("northstar-chart-symbol",symbol.toUpperCase());navigate("Professional Charts");} }}>⌕ Search</button>
          <button className="header-logout" type="button" onClick={()=>{setSignedIn(false);setAccessToken("");signOutCognito()}}>Log out</button>
          <span className="avatar">{displayInitials}</span>
        </div>
      </header>
      <div className="shell">
        <aside>
          {visibleNavigationGroups.map(group => <div className="nav-group" key={group.name}><p>{group.name}</p>{group.items.map(([x,icon]) => (
            <button
              key={x}
              onClick={() => navigate(x)}
              className={tab === x ? "active" : ""}
            >
              <span>{icon}</span>
              {navigationLabels[x]||x}
            </button>
          ))}</div>)}
          <p>MY LISTS</p>
          <button>
            <span className="violet">●</span>Core watchlist <em>4</em>
          </button>
          <button>
            <span className="gold">●</span>Future sectors <em>12</em>
          </button>
          <div className="guard">
            <strong>◈ Capital guard is on</strong>
            <small>
              Every idea is checked against your rules before you act.
            </small>
            <button onClick={() => navigate("Prepare Trade")}>
              Review risk rules →
            </button>
          </div>
          <div className="user">
            <span className="avatar">{displayInitials}</span>
            <b>
              {displayName}<small>{accountEmail} · Household owner</small>
            </b>
            <button className="signout" onClick={() => { setSignedIn(false); setAccessToken(""); signOutCognito(); }}>
              Sign out
            </button>
          </div>
        </aside>
        <section className="content">
          {actionNotice && <div className="action-toast" role="status">{actionNotice}</div>}
          <nav className="workspace-breadcrumb" aria-label="Page navigation">
            <div className="history-controls" aria-label="Navigation history">
              <button type="button" onClick={() => window.history.back()} aria-label="Go back" title="Go back">← <span>Back</span></button>
              <button type="button" onClick={() => window.history.forward()} aria-label="Go forward" title="Go forward"><span>Forward</span> →</button>
            </div>
            <ol>
              <li><button type="button" onClick={() => navigate("Dashboard")}>Workspace</button></li>
              {breadcrumbParent && <li><button type="button" onClick={() => navigate(breadcrumbParent)}>Markets</button></li>}
              <li aria-current="page">{tab === "Market Intel" ? "Markets" : tab}</li>
            </ol>
          </nav>
          <div className="hero" id="dashboard-top">
            <div>
              <p className="kicker">
                {tab==="Daily Action Plan"?"LIVE MARKET DATA · DAILY ACTION PLAN":`MARKET BRIEF · ${tab.toUpperCase()}`}
              </p>
              <h1>{tab==="Dashboard"?"Start here: understand today, then choose one action.":tab==="Daily Action Plan"?"Today’s live market action plan.":tab==="Household"?"Your household financial command center.":tab==="Learn"?"Learn investing from foundation to professional practice.":tab==="Paper Simulator"?"Practice decisions without risking real money.":"Your professional trading copilot."}</h1>
              <p>
                {tab==="Dashboard"?"First review household health. Then open the Daily Action Plan for market candidates, or Portfolio for long-term accounts. Every proposal requires your confirmation.":tab==="Daily Action Plan"?"This is the real provider-backed market workspace—not an Academy exercise or paper simulation. It is built after the close for the next session, then re-ranked as current price, volume, fundamentals, news, and market structure change. Forecasts remain probabilistic.":tab==="Household"?"One shared family workspace with separate named users, controlled roles, connected accounts, and accountable access.":tab==="Learn"?"Structured lessons, interactive charts, exams, prediction practice, and decision journaling for adults and supervised young learners.":tab==="Paper Simulator"?"Use live market references to practice long-term investing, swing plans, calls, and puts. Every transaction remains simulated.":"Built for every experience level. Protect capital first. Find opportunities second. Profit is the result of a repeatable process—not a prediction."}
              </p>
            </div>
            <button className="primary" onClick={() => navigate("Ask Northstar")}>
              ✦ Analyze an idea
            </button>
          </div>
          {tab==="Dashboard"&&<section className="dashboard-start card"><header><span>YOUR NORTHSTAR WORKFLOW</span><h2>Three clear places to begin</h2><p>You do not need to interpret every panel at once.</p></header><div><button onClick={()=>navigate("Accounts")}><b>1 · Household money</b><span>Connect and review cash, spending, cards, loans, and account freshness.</span></button><button onClick={()=>navigate("Portfolio")}><b>2 · Long-term portfolio</b><span>Review investment accounts, allocation, concentration, and contribution-based corrections.</span></button><button onClick={()=>navigate("Daily Action Plan")}><b>3 · Today’s trade decisions</b><span>Open the post-close plan or live re-ranked swing list with triggers and invalidations.</span></button></div></section>}
          {tab==="Daily Action Plan"&&<section className="daily-plan-intro card"><header><span>{marketPhase==="open"?"REAL MARKET DATA · MARKET OPEN · LIVE UPDATE":"REAL MARKET DATA · NEXT-SESSION PREPARATION"}</span><h2>{marketPhase==="open"?"One ranked plan that changes with current evidence":marketClock.status==="connected"?`Preparing for the next open in ${marketCountdown}`:"Preparing the next-session plan"}</h2>{!marketClock.isOpen&&clockTargetLabel&&<p>Next official U.S. market open: <b>{clockTargetLabel}</b>. A long weekend or holiday countdown is shown as days and hours, not a confusing total such as 88 hours.</p>}</header><div><article><b>While the market is closed</b><p>Rank the next-session list from the latest completed provider bars, Weekly/Daily structure, volume, support, resistance, available fundamentals, and defined risk. Closed-market prices remain the latest available values.</p></article><article><b>Before the next open</b><p>Keep the plan as preparation—not an immediate entry. At the decision window, recheck gaps, pre-market information, relative volume, index/sector confirmation, and invalidate stale setups.</p></article><article><b>When trading resumes</b><p>Switch to live-session monitoring, refresh provider data every {intradayRefreshMinutes} minutes, and promote only candidates whose trigger, liquidity, and reward/risk still qualify.</p></article></div><footer><b>{marketClock.isOpen?"Live decision workspace:":"Next-session plan:"}</b> values and timestamps come from the connected providers shown below. {decisionAlarmEnabled?`Review alarm ON · ${decisionTime} New York / ${decisionTimeLabel}`:"Review alarm OFF · configure it in Settings"}. Northstar proposes; you decide.</footer></section>}
          {tab==="Dashboard"&&<section className="family-capital card"><header><div><span>PLAID HOUSEHOLD FINANCIAL POSITION</span><h2>Total family capital and debt</h2><p>Read-only totals from every synchronized household connection and named family member.</p></div><em>{latestFinanceSync?`Last synchronized ${new Date(latestFinanceSync).toLocaleString()}`:"Plaid synchronization required"}</em></header><div className="family-capital-grid"><article className="liquid"><small>LIQUID CAPITAL</small><strong>${familyCapital.liquid.toLocaleString(undefined,{maximumFractionDigits:0})}</strong><p>Checking, savings, cash and money-market balances</p><span>{familyCapital.liquidAccounts} connected accounts</span></article><article className="invested"><small>INVESTED CAPITAL</small><strong>${familyCapital.invested.toLocaleString(undefined,{maximumFractionDigits:0})}</strong><p>Current market value of synchronized investment holdings</p><span>{connectedFinance.holdings.length} holdings</span></article><article className="debt"><small>TOTAL DEBT</small><strong>${familyCapital.debt.toLocaleString(undefined,{maximumFractionDigits:0})}</strong><p>Credit cards, loans, mortgages and credit lines returned by Plaid</p><span>{familyCapital.debtAccounts} debt accounts</span></article><article className={familyCapital.net>=0?"net positive":"net negative"}><small>NET FINANCIAL CAPITAL</small><strong>{familyCapital.net<0?"−":""}${Math.abs(familyCapital.net).toLocaleString(undefined,{maximumFractionDigits:0})}</strong><p>Liquid capital + investments − connected debt</p><span>{familyCapital.net>=0?"POSITIVE":"NEGATIVE"}</span></article></div><footer><b>Coverage note:</b> Property value, private businesses, unconnected accounts and manually entered debts are excluded from this Plaid total. Investment balances are calculated from holdings to avoid double counting.</footer></section>}
          {tab==="Dashboard"&&<section className={`spending-guard card ${monthlySpending.state}`}><header><div><span>90-DAY HOUSEHOLD SPENDING GUARD</span><h2>Average monthly spending</h2><p>Purchases are separated from transfers and debt payments to reduce double counting.</p></div><strong>${monthlySpending.spending.toLocaleString(undefined,{maximumFractionDigits:0})}<small>average per month</small></strong></header><div className="spending-metrics"><span><small>Average income</small><b>${monthlySpending.income.toLocaleString(undefined,{maximumFractionDigits:0})}</b></span><span><small>Average debt payments</small><b>${monthlySpending.debtPayments.toLocaleString(undefined,{maximumFractionDigits:0})}</b></span><span><small>Suggested spending ceiling</small><b>{monthlySpending.safeLimit?`$${monthlySpending.safeLimit.toLocaleString(undefined,{maximumFractionDigits:0})}`:"Income data required"}</b></span><span><small>Current status</small><b>{monthlySpending.state==="safe"?"WITHIN PLAN":monthlySpending.state==="warning"?"NEAR LIMIT":monthlySpending.state==="danger"?"OVER LIMIT":"INSUFFICIENT DATA"}</b></span></div><div className="spending-bar"><i style={{width:`${Math.min(100,monthlySpending.ratio*100)}%`}}/><b>{monthlySpending.safeLimit?`${(monthlySpending.ratio*100).toFixed(0)}% of suggested ceiling`:"—"}</b></div><footer><b>Calculation:</b> ceiling = 80% of average income remaining after detected credit-card, loan and mortgage payments. Review categories because provider descriptions can misclassify transfers. Based on {monthlySpending.transactions} transactions across {monthlySpending.months} month(s).</footer></section>}
          {["Daily Action Plan","Scanner","Market Intel","Prepare Trade"].includes(tab)&&<AutomaticMarketCopilot accessToken={accessToken} ownedSymbols={ownedInvestmentSymbols} onPrepare={(symbol,action)=>{sessionStorage.setItem("northstar-chart-symbol",symbol);sessionStorage.setItem("northstar-prepared-action",JSON.stringify({symbol,action}));navigate("Prepare Trade")}} onSelect={symbol=>{sessionStorage.setItem("northstar-chart-symbol",symbol);setChartSymbol(symbol);setMarketLookup(symbol);navigate("Professional Charts")}} />}
          <MarketWatchlist accessToken={accessToken} onOpen={symbol=>{sessionStorage.setItem("northstar-chart-symbol",symbol);setChartSymbol(symbol);navigate("Professional Charts")}} />
          <nav className="market-subnav" aria-label="Market tools"><button className={tab==="Market Intel"?"active":""} onClick={()=>navigate("Market Intel")}><b>✦</b><span>Market Advisor<small>Recommendations and product analysis</small></span></button><button className={tab==="Professional Charts"?"active":""} onClick={()=>navigate("Professional Charts")}><b>⌁</b><span>Professional Charts<small>Any stock or ETF · 1M to 5Y</small></span></button><button className={tab==="Market News"?"active":""} onClick={()=>navigate("Market News")}><b>◉</b><span>Market Intelligence<small>News, catalysts and causal chains</small></span></button><button className={tab==="Growth Finder"?"active":""} onClick={()=>navigate("Growth Finder")}><b>↗</b><span>Affordable Growth<small>Lower-price research with risk checks</small></span></button></nav>
          {["Market Intel","Scanner","Prepare Trade","Professional Charts"].includes(tab)&&<section className="purpose-account-review card"><header><div><span>PLAID ACCOUNTS · SWING & OPTIONS</span><h2>Your purpose-matched trading accounts</h2><p>These accounts appear here because their saved purpose is Swing or Options. Suggestions use short-term risk rules and remain read-only.</p></div><strong>{swingAccounts.length}<small>matched accounts</small></strong></header>{swingAccounts.length?<><div className="purpose-account-list">{swingAccounts.map(account=><article key={account.id}><div><b>{account.nickname||account.official_name||account.name}</b><small>{account.investment_purpose} · {account.subtype||"investment"}</small></div><strong>{swingHoldings.filter(holding=>String(holding.account_id)===String(account.id)).length}<small> holdings</small></strong></article>)}</div><div className="purpose-holding-review">{swingHoldings.map(holding=>{const market=Number(holding.market_value_cents||0),cost=Number(holding.cost_basis_cents||0),gain=market-cost,gainPct=cost>0?gain/cost*100:null,symbol=String(holding.ticker||"");return <article className={gainPct!==null&&gainPct<=-8?"decision-risk":"decision-review"} key={`${holding.account_id}_${symbol}_${holding.name}`}><div><b>{symbol||"Ticker unavailable"}</b><small>{holding.nickname||holding.name}</small></div><strong>{gainPct===null?"Cost basis needed":`${gainPct>=0?"+":""}${gainPct.toFixed(1)}%`}<small>institution gain/loss</small></strong><p>{gainPct!==null&&gainPct<=-8?"RISK REVIEW · Loss requires checking the original stop and thesis. Do not average down automatically.":"CHART REVIEW NEEDED · Confirm Daily/4H trend, volume, support, entry, stop and target before any decision."}</p><button disabled={!symbol} onClick={()=>{sessionStorage.setItem("northstar-chart-symbol",symbol);setChartSymbol(symbol);navigate("Professional Charts")}}>Analyze chart →</button></article>})}</div></>:<div className="purpose-empty"><b>No account is assigned to Swing or Options.</b><span>Open Financial Adviser → Accounts, expand the Plaid investment account, select Swing or Options, and save the account profile.</span><button onClick={()=>navigate("Accounts")}>Assign an account →</button></div>}<footer><b>Current holdings are not automatically correct or incorrect.</b> Northstar requires current chart, liquidity, volume, news, position size and invalidation evidence before suggesting keep, reduce, or exit.</footer></section>}
          {["Market Intel","Scanner","Prepare Trade","Professional Charts"].includes(tab)&&<ConnectedHoldingsAnalysis holdings={swingHoldings} mode="swing" onOpen={symbol=>{sessionStorage.setItem("northstar-chart-symbol",symbol);setChartSymbol(symbol);navigate("Professional Charts")}} />}
          <section className="connected-accounts card">
            <div className="accounts-head"><div><span>▣ {tab==="Portfolio"?"READ-ONLY RETIREMENT & INVESTMENT CONNECTIONS":"READ-ONLY FINANCIAL CONNECTIONS"}</span><h2>{tab==="Portfolio"?"Connect your 401(k), Roth IRA, IRA, or brokerage":"Bank, cards, loans, and investment accounts"}</h2><p>{tab==="Portfolio"?"Use Plaid Investments to synchronize supported Chase or plan-custodian accounts, holdings, quantities, cost basis and institution prices. Availability depends on the institution connection.":"Connect through Plaid to track balances, spending, liabilities, and portfolio holdings."} Northstar cannot transfer money or place trades.</p></div><button className="primary" disabled={plaidBusy} onClick={connectPlaid}>{plaidBusy?"Connecting…":tab==="Portfolio"?"+ Connect retirement account":"+ Connect an institution"}</button></div>
            {(tab==="Accounts"||tab==="Portfolio")&&<section className="manual-investment-account"><header><div><span>MANUAL FALLBACK · NOT PLAID-SYNCHRONIZED</span><h3>Create an investment account manually</h3><p>Use this when your institution cannot connect. Northstar will keep it separate from bank, credit, and loan accounts.</p></div></header><div><label>Account alias<input value={manualAccount.alias} maxLength={80} placeholder="Example: Jose Roth at Chase" onChange={event=>setManualAccount(value=>({...value,alias:event.target.value}))}/></label><label>Account type<select value={manualAccount.accountType} onChange={event=>setManualAccount(value=>({...value,accountType:event.target.value}))}>{["Taxable brokerage","401(k)","Traditional IRA","Roth IRA","SEP IRA","Other investment"].map(value=><option key={value}>{value}</option>)}</select></label><label>What is it for?<select value={manualAccount.purpose} onChange={event=>setManualAccount(value=>({...value,purpose:event.target.value}))}>{["Swing","Options","Long-term","Retirement","Dividend income","Mixed"].map(value=><option key={value}>{value}</option>)}</select></label><button type="button" disabled={manualAccountBusy||!manualAccount.alias.trim()} onClick={createManualInvestmentAccount}>{manualAccountBusy?"Creating…":"+ Create manual account"}</button></div><footer>Manual accounts depend on the balances and holdings you enter. Market prices can be refreshed, but quantities and transactions will not update automatically.</footer></section>}
            <div className="plaid-security"><b>🔒 Your bank credentials never enter Northstar.</b><span>Plaid handles institution authentication. Northstar stores only an encrypted provider token on the server and requests read-only financial data.</span></div>
            <div className={`data-freshness ${latestFinanceSync?"synced":"waiting"}`}><b>{latestFinanceSync?"PLAID INSTITUTION SNAPSHOT":"PLAID DATA NOT YET SYNCHRONIZED"}</b><span>{latestFinanceSync?`Last successful account synchronization: ${new Date(latestFinanceSync).toLocaleString()}. Bank and retirement data is not tick-by-tick; use Sync now to request the latest snapshot.`:"Connect and synchronize an institution before using balances or holdings for decisions."}</span><em>Market quotes: provider timestamp · Account data: institution timestamp</em></div>
            <div className="connection-summary"><div><small>Connected institutions</small><b>{connectedFinance.connections.length}</b></div><div><small>{tab==="Portfolio"?"Investment accounts":"Financial accounts"}</small><b>{visibleFinanceAccounts.length}</b></div><div><small>Investment holdings</small><b>{connectedFinance.holdings.length}</b></div><div><small>{tab==="Portfolio"?"Invested market value":"Tracked financial value"}</small><b>${(tab==="Portfolio"?connectedFinance.holdings.reduce((sum,item)=>sum+Number(item.market_value_cents||0),0)/100:(connectedFinance.accounts.reduce((sum,item)=>sum+Number(item.current_balance_cents||0),0)+connectedFinance.holdings.reduce((sum,item)=>sum+Number(item.market_value_cents||0),0))/100).toLocaleString(undefined,{maximumFractionDigits:0})}</b></div></div>
            <div className="plaid-notice" role="status">{plaidNotice}</div>
            <div className="connections-list">{connectedFinance.connections.map(connection=><article key={connection.id}><i>▣</i><span><b>{connection.institution_name||"Connected institution"}</b><small>{connection.last_synced_at?`Last synced ${new Date(connection.last_synced_at).toLocaleString()}`:"Ready for first synchronization"}</small></span><em className={connection.status}>{connection.status}</em><div className="connection-actions"><button disabled={plaidBusy} onClick={()=>syncPlaid(String(connection.id))}>↻ Sync now</button><button className="remove" disabled={plaidBusy} onClick={()=>removePlaidConnection(String(connection.id),String(connection.institution_name||"this institution"))}>Remove</button></div></article>)}{!connectedFinance.connections.length&&<div className="connection-empty"><b>No institution connected yet</b><span>Use Connect an institution to securely select a bank, credit card, loan servicer, or supported brokerage.</span></div>}</div>
            {!!visibleFinanceAccounts.length&&<section className="account-table"><div className="account-row heading"><span>Account</span><span>Type</span><span>Available</span><span>Current balance</span><span>Credit limit</span></div>{visibleFinanceAccounts.map(account=><div className="account-row" key={account.id}><span><b>{account.name}</b><small>{account.official_name||""} {account.mask?`•••• ${account.mask}`:""}</small></span><span>{account.subtype||account.type}</span><span>{account.available_balance_cents==null?"—":`$${(Number(account.available_balance_cents)/100).toLocaleString()}`}</span><strong>${(Number(account.current_balance_cents||0)/100).toLocaleString()}</strong><span>{account.credit_limit_cents==null?"—":`$${(Number(account.credit_limit_cents)/100).toLocaleString()}`}</span></div>)}</section>}
            {investmentAccounts.map(account=><InvestmentAccountProfile key={`profile_${account.id}`} account={account} holdings={connectedFinance.holdings.filter(holding=>holding.account_id===account.id)} onSave={updateInvestmentAccount} onAddHolding={addManualHolding}/>)}
            {tab==="Accounts"&&swingHoldings.length>0&&<ConnectedHoldingsAnalysis holdings={swingHoldings} mode="swing" onOpen={symbol=>{sessionStorage.setItem("northstar-chart-symbol",symbol);setChartSymbol(symbol);navigate("Professional Charts")}} />}
            {tab==="Accounts"&&longTermHoldings.length>0&&<ConnectedHoldingsAnalysis holdings={longTermHoldings} mode="long-term" onOpen={symbol=>{sessionStorage.setItem("northstar-chart-symbol",symbol);setChartSymbol(symbol);navigate("Professional Charts")}} />}
            {!!connectedFinance.holdings.length&&<section className="holdings-table"><h3>Investment holdings and growth tracking</h3>{connectedFinance.holdings.map(holding=>{const market=Number(holding.market_value_cents||0),cost=Number(holding.cost_basis_cents||0),gain=market-cost;return <article key={`${holding.account_id}_${holding.ticker}_${holding.name}`}><span><b>{holding.ticker||"—"}</b><small>{holding.name}</small></span><span><small>Shares</small><b>{Number(holding.quantity||0).toLocaleString()}</b></span><span><small>Market value</small><b>${(market/100).toLocaleString()}</b><small>{holding.price_at?`Institution price ${new Date(holding.price_at).toLocaleString()}`:"Price timestamp unavailable"}</small></span><span className={gain>=0?"gain":"loss"}><small>Gain / loss</small><b>{gain>=0?"+":"−"}${(Math.abs(gain)/100).toLocaleString()}</b></span></article>})}</section>}
          </section>
          <section className="portfolio-builder card">
            {tab==="Portfolio"&&<ConnectedHoldingsAnalysis holdings={longTermHoldings} mode="long-term" onOpen={symbol=>{sessionStorage.setItem("northstar-chart-symbol",symbol);setChartSymbol(symbol);navigate("Professional Charts")}} />}
            <div className="portfolio-head"><div><span>◫ GOAL-BASED PORTFOLIO BUILDER</span><h2>Create and adjust your investment plan</h2><p>Choose when the money is needed, set a target mix, and review possible outcomes before changing real holdings.</p></div><em>READ-ONLY PLAN</em></div>
            <div className="portfolio-setup expanded"><label>Strategy / horizon<select value={portfolioGoal} onChange={e=>setPortfolioGoal(e.target.value as "Swing"|"2–3 years"|"5 years"|"10+ years")}><option>Swing</option><option>2–3 years</option><option>5 years</option><option>10+ years</option></select></label><label>Account type<select value={portfolioAccount} onChange={e=>setPortfolioAccount(e.target.value as typeof portfolioAccount)}><option>Taxable brokerage</option><option>401(k)</option><option>Traditional IRA</option><option>Roth IRA</option></select></label><label>Portfolio amount<div className="portfolio-money"><b>$</b><input type="number" min="0" step="500" value={portfolioAmount} onChange={e=>setPortfolioAmount(Math.max(0,+e.target.value))}/></div></label><div className="preset-actions"><button onClick={applyPortfolioPreset}>✦ Build risk-aware mix</button><button onClick={applyCoreDividendGrowthPreset}>◎ Apply 40 / 30 / 30</button>{connectedPortfolioValue>0&&<button onClick={()=>{setPortfolioAmount(connectedPortfolioValue);setPortfolioNotice(`Using $${connectedPortfolioValue.toLocaleString(undefined,{maximumFractionDigits:0})} from synchronized holdings as the planning value.`)}}>↻ Use connected value</button>}</div></div>
            {connectedPortfolioValue>0&&<section className="plaid-allocation-review"><header><div><span>PLAID HOLDINGS · CURRENT VS TARGET</span><h3>Read-only portfolio rebalance coach</h3><p>Calculated from synchronized institution values. Review rules-based classifications, especially mutual funds without recognizable tickers.</p></div><strong>${connectedPortfolioValue.toLocaleString(undefined,{maximumFractionDigits:0})}<small>connected holdings</small></strong></header><div className="allocation-compare">{connectedPortfolioAnalysis.rows.map(row=><article className={row.status} key={row.key}><div><b>{row.label}</b><em>{row.status==="underweight"?"ADD RESEARCH":row.status==="overweight"?"REDUCE / SELL REVIEW":"NEAR TARGET"}</em></div><span><small>Current</small><strong>{row.actual.toFixed(1)}%</strong></span><span><small>Target</small><strong>{row.target}%</strong></span><span><small>Difference</small><strong>{row.delta>=0?"+":""}{row.delta.toFixed(1)}%</strong></span><p>{row.status==="underweight"?`Research adding about $${row.amount.toLocaleString(undefined,{maximumFractionDigits:0})} through future contributions after suitability, valuation, fees and plan choices pass review.`:row.status==="overweight"?`About $${row.amount.toLocaleString(undefined,{maximumFractionDigits:0})} exceeds the target. Redirect contributions first; sell only after taxes, restrictions, fees and thesis are checked.`:"Within ±5 percentage points of target. Monitor and use contributions to limit unnecessary selling."}</p></article>)}</div>{connectedPortfolioAnalysis.concentration.length>0&&<div className="concentration-review"><b>! Concentration review required</b><span>{connectedPortfolioAnalysis.concentration.map(item=>`${item.ticker||item.name}: ${item.weight.toFixed(1)}%`).join(" · ")}</span><p>A holding above 10% can dominate results. Verify whether it is a diversified fund, employer stock, restricted position, or intentional allocation before considering a change.</p></div>}<footer><b>Sequence:</b> fill underweight categories with contributions → review overlap and fees → rebalance only when benefits exceed taxes, restrictions and costs → confirm every change yourself.</footer></section>}
            <div className="portfolio-body"><div className="allocation-editor">{([{key:"cash",icon:"◆",label:"Cash & short-term",note:"Stability and near-term needs"},{key:"bonds",icon:"▰",label:"Bonds / fixed income",note:"Income and volatility control"},{key:"diversified",icon:"◎",label:"Core / VOO–VTI type",note:"Broad-market base and diversification"},{key:"dividend",icon:"$",label:"Dividend / SCHD type",note:"Quality income and dividend growth"},{key:"growth",icon:"↗",label:"Growth stocks",note:"Revenue, earnings and cash-flow growth"}] as const).map(asset=><label key={asset.key}><i>{asset.icon}</i><span><b>{asset.label}</b><small>{asset.note}</small></span><input type="range" min="0" max="100" step="5" value={portfolioMix[asset.key]} onChange={e=>setPortfolioMix(current=>({...current,[asset.key]:+e.target.value}))}/><strong>{portfolioMix[asset.key]}%</strong><em>${(portfolioAmount*portfolioMix[asset.key]/100).toLocaleString(undefined,{maximumFractionDigits:0})}</em></label>)}</div><aside className="portfolio-summary"><span className={portfolioTotal===100?"valid":"invalid"}>{portfolioTotal===100?"✓":"!"} ALLOCATION TOTAL · {portfolioTotal}%</span><h3>{portfolioGoal} planning range</h3><div><small>Lower scenario</small><b>${portfolioLow.toLocaleString(undefined,{maximumFractionDigits:0})}</b></div><div><small>Planning midpoint</small><b>${portfolioProjected.toLocaleString(undefined,{maximumFractionDigits:0})}</b></div><div><small>Higher scenario</small><b>${portfolioHigh.toLocaleString(undefined,{maximumFractionDigits:0})}</b></div><p><u>Important:</u> These are uncertain scenarios, not promised returns. A 40/30/30 stock allocation can still lose substantially and may be unsuitable for money required within 2–3 years.</p><button className="primary" onClick={savePortfolio}>Save portfolio goal</button>{portfolioNotice&&<small className="portfolio-notice">{portfolioNotice}</small>}</aside></div>
            <div className="portfolio-guidance"><section><b>✓ {portfolioGoal} framework</b><p>{portfolioGoal==="Swing"?"Use a separate risk budget, defined invalidation, small position sizing, and cash reserve. Do not treat retirement money as swing-trading capital.":portfolioGoal==="2–3 years"?"Keep most goal-critical money in cash and high-quality short-duration bonds.":portfolioGoal==="10+ years"?"Long horizons may support broad diversified equity exposure, regular contributions, and contribution-based rebalancing—if your risk capacity permits.":"A five-year horizon can support diversified equity exposure, provided you can tolerate temporary losses."}</p></section><section><b>◎ {portfolioAccount}</b><p>{portfolioAccount==="401(k)"?"Review employer match first, plan fees, available funds, vesting, and contribution limits. Northstar cannot change payroll elections.":portfolioAccount==="Roth IRA"?"Qualified withdrawals may be tax-free, but eligibility, contribution limits, and withdrawal rules require verification for your tax year.":portfolioAccount==="Traditional IRA"?"Deductibility and withdrawals depend on tax rules and your circumstances. Verify current limits before contributing.":"Taxable accounts require capital-gain, dividend, tax-lot, and wash-sale review before rebalancing."}</p></section></div>
          </section>
          <section className="focus-bar">
            {backendOverview && <div><span>PERSISTENT DATA</span><b>{backendOverview.entities} entities · {backendOverview.transactions} transactions</b><small>AWS PostgreSQL financial ledger connected</small></div>}
            <div>
              <span>LOCAL MARKET TIME</span>
              <b>{activeTimezone.replace(/_/g," ")}</b>
              <small>{localMarketClock} · Exchange anchored to New York</small>
            </div>
            <div>
              <span>TODAY’S WATCH PLAN</span>
              <b>50 of {dailyLimit} minutes</b>
              <small>6:20–7:00 AM · 12:50–1:00 PM</small>
            </div>
            <div>
              <span>DECISION GUARD</span>
              <b>10-minute cooling-off</b>
              <small>Required after high-urgency alerts</small>
            </div>
            <button
              onClick={() => navigate("Settings")}
            >
              Configure attention limits →
            </button>
          </section>
          <section className="growth-finder card" id="growth-finder">
            <div className="screener-head"><div><p>AFFORDABLE GROWTH RESEARCH</p><h2>Find emerging companies without confusing price with value</h2><span>Northstar searches for strong growth, sensible valuation, liquidity, cash runway and limited dilution—not merely a low share price.</span></div><em>LIVE DATA CHECKED PER CANDIDATE</em></div>
            <div className="growth-principle"><b>A $10 stock is not automatically cheaper than a $200 stock.</b><span>Share count determines nominal price. The advisor compares market capitalization, enterprise value, revenue growth, margins, free cash flow and dilution before calling anything inexpensive.</span></div>
            <div className="growth-screen-grid"><article><span>01 · QUALITY</span><h3>Business acceleration</h3><p>Revenue growth above 20%, improving gross margin, recurring demand and credible management execution.</p></article><article><span>02 · FINANCIAL SAFETY</span><h3>Survival before upside</h3><p>Cash runway, manageable debt, positive or improving free cash flow, and no dependence on repeated share issuance.</p></article><article><span>03 · VALUATION</span><h3>Price versus realistic growth</h3><p>Forward valuation must be supportable by revenue, earnings and cash-flow scenarios—not social-media excitement.</p></article><article><span>04 · MARKET EVIDENCE</span><h3>3–12 month confirmation</h3><p>Relative strength, volume, institutional participation, catalysts and clear invalidation levels.</p></article></div>
            <div className="growth-scenarios"><div><span>BEAR CASE</span><b>−45% to −20%</b><p>Growth disappoints, dilution increases or the market multiple contracts.</p></div><div><span>BASE CASE</span><b>−5% to +30%</b><p>Execution continues near expectations and valuation remains stable.</p></div><div><span>BULL CASE</span><b>+30% to +100%+</b><p>Only when growth, margins and catalysts materially exceed expectations. This is low probability—not a promise.</p></div></div>
            <AutomaticMarketCopilot accessToken={accessToken} ownedSymbols={ownedInvestmentSymbols} initialStrategy="long-term" onPrepare={(symbol,action)=>{sessionStorage.setItem("northstar-chart-symbol",symbol);sessionStorage.setItem("northstar-prepared-action",JSON.stringify({symbol,action}));navigate("Prepare Trade")}} onSelect={symbol=>{sessionStorage.setItem("northstar-chart-symbol",symbol);setChartSymbol(symbol);setMarketLookup(symbol);navigate("Professional Charts")}} />
          </section>
          <div className="regime">
            <div>
              <p>MARKET CONDITION</p>
              <b>
                <i /> Constructively bullish
              </b>
              <span>
                Trend is positive, but breadth is narrowing. Favor quality
                setups; avoid chasing extended moves.
              </span>
            </div>
            {[
              ["S&P 500", "6,482", "+0.74%"],
              ["NASDAQ", "21,705", "+1.08%"],
              ["DOW", "45,228", "+0.31%"],
              ["RUSSELL", "2,347", "−0.22%"],
            ].map((x) => (
              <div className="index" key={x[0]}>
                <span>{x[0]}</span>
                <b>{x[1]}</b>
                <em className={x[2][0] === "−" ? "down" : ""}>{x[2]}</em>
              </div>
            ))}
          </div>
          <section className="chart-workspace card" id="market-charts">
            <div className="chart-head">
              <div>
                <p>PROFESSIONAL MARKET CHARTS</p>
                <h2>{chartSymbol} · Candles, volume and technical context</h2>
              </div>
              <div className="feed-state"><i /> {chartBars.length?"CONNECTED DATA":"DEMO FALLBACK"} <small>{feedNotice}</small></div>
            </div>
            <div className="chart-toolbar">
              <div className="chart-symbol-search"><input value={marketLookup} onChange={e=>setMarketLookup(e.target.value.toUpperCase().replace(/[^A-Z.]/g,"").slice(0,10))} onKeyDown={e=>{if(e.key==="Enter"&&marketLookup)setChartSymbol(marketLookup)}} placeholder="Search any ticker" aria-label="Search any stock or ETF chart"/><button onClick={()=>marketLookup&&setChartSymbol(marketLookup)}>Load chart</button></div>
              <div className="symbol-picks">
                {["NVDA","SPY","QQQ","AAPL","MSFT"].map(symbol => <button key={symbol} className={chartSymbol===symbol?"active":""} onClick={()=>{setChartSymbol(symbol);setMarketLookup(symbol)}}>{symbol}</button>)}
              </div>
              <div className="time-picks">
                {["1M","3M","6M","1Y","5Y"].map(frame => <button key={frame} className={timeframe===frame?"active":""} onClick={()=>setTimeframe(frame)}>{frame}</button>)}
              </div>
              <select aria-label="Technical indicator" value={indicator} onChange={e=>setIndicator(e.target.value)}>
                <option>Bollinger Bands</option><option>EMA 20/50</option><option>SMA 50/200</option><option>VWAP</option>
              </select>
            </div>
            <div className="quote-strip">
              <span><small>LAST</small><b>${latestCandle[3].toFixed(2)}</b></span><span><small>RANGE CHANGE</small><b className={chartChange>=0?"green":"red"}>{chartChange>=0?"+":""}{chartChange.toFixed(2)}%</b></span>
              <span><small>FIRST OPEN</small><b>${firstCandle[0].toFixed(2)}</b></span><span><small>RANGE HIGH / LOW</small><b>${chartHigh.toFixed(2)} / ${chartLow.toFixed(2)}</b></span>
              <span><small>LATEST VOLUME</small><b>{latestCandle[4]>=1000000?(latestCandle[4]/1000000).toFixed(1)+"M":latestCandle[4].toLocaleString()}</b></span><span><small>RANGE</small><b>{timeframe}</b></span>
            </div>
            <section className="ma-support-panel"><div><p>MOVING-AVERAGE SUPPORT MAP</p><h3>Which averages may support—or fail to support—price?</h3><span>An average is dynamic context, not a barrier that prevents a decline. A close below it, failed reclaim, high-volume selling, or broken market structure weakens the support thesis.</span></div><div className="ma-support-grid">{movingAverages.map(average=><article key={average.name} className={average.status.startsWith("Above")?"holding":average.status.startsWith("Testing")?"testing":average.status.startsWith("Broken")?"broken":"missing"}><b>{average.name}</b><strong>{average.value===null?"Need more bars":`$${average.value.toFixed(2)}`}</strong><span>{average.status}{average.distance===null?"":` · ${average.distance>=0?"+":""}${average.distance.toFixed(1)}%`}</span><small>{average.use}</small></article>)}</div><footer><b>Swing:</b> prioritize EMA 9/20/21 plus SMA 50. <b>Long-term/401(k)/IRA:</b> use SMA 50/100/200 for regime context, but prioritize allocation, diversification, fees, contributions, and goal horizon.</footer></section>
            <section className={`chart-interpreter ${chartInterpretation.direction.startsWith("Upward")?"bullish":chartInterpretation.direction.startsWith("Downward")?"bearish":"neutral"}`}><header><div><p>TECHNICAL CHART INTERPRETER</p><h3>{chartSymbol} · {analysisStrategy==="swing"?"Swing trade":"Long-term / retirement portfolio"}</h3></div><label>Interpret as<select value={analysisStrategy} onChange={event=>setAnalysisStrategy(event.target.value as "swing"|"position")}><option value="swing">Swing trade</option><option value="position">Long-term / 401(k) / IRA</option></select></label></header><div className="interpreter-verdict"><span><small>DIRECTIONAL BIAS</small><strong>{chartInterpretation.direction}</strong></span><span><small>MODEL CONFIDENCE</small><strong>{chartInterpretation.confidence}%</strong></span><span><small>DYNAMIC SUPPORT</small><strong>${chartInterpretation.nearestSupport.toFixed(2)}</strong></span><span><small>RECENT RESISTANCE</small><strong>${chartInterpretation.nearestResistance.toFixed(2)}</strong></span></div><div className="interpretation-chain"><article><b>1 · Observation</b><p>{chartInterpretation.observation}</p></article><article><b>2 · Evidence</b><p>{chartInterpretation.evidence}</p></article><article><b>3 · Risk</b><p>{chartInterpretation.risk}</p></article><article className="recommendation"><b>4 · Suggested action</b><p>{chartInterpretation.suggestion}</p></article></div><div className="volume-decision"><article><span>VOLUME ANALYSIS · {volumeInterpretation.ratio.toFixed(2)}×</span><h4>{volumeInterpretation.label}</h4><p>{volumeInterpretation.meaning}</p><small>Close location: {(volumeInterpretation.closeLocation*100).toFixed(0)}% of the candle range. Volume is combined with price direction, candle close, structure, moving averages, and timeframes.</small></article><article><span>CONDITIONAL BUY / SELL PLAN</span><h4>No automatic order</h4><dl><div><dt>Pullback buy-watch zone</dt><dd>${volumeInterpretation.pullbackLow.toFixed(2)}–${volumeInterpretation.pullbackHigh.toFixed(2)}</dd></div><div><dt>Breakout buy trigger</dt><dd>Close above ${volumeInterpretation.breakout.toFixed(2)} + confirmation</dd></div><div><dt>Stop / thesis invalidation</dt><dd>Close below ${volumeInterpretation.stop.toFixed(2)}</dd></div><div><dt>Sell / reduce reviews</dt><dd>${volumeInterpretation.firstTarget.toFixed(2)} then ~${volumeInterpretation.secondTarget.toFixed(2)}</dd></div></dl><small>Only consider a buy when the setup, volume, reward/risk, account fit, market context, and your written rules agree. Sell/trim levels require your explicit decision.</small></article></div><div className="price-paths"><span><b>Bullish scenario</b><strong>~${chartInterpretation.bullCase.toFixed(2)}</strong><small>ATR-based scenario, not a target guarantee</small></span><span><b>Current price</b><strong>${chartInterpretation.latest.toFixed(2)}</strong><small>{chartBars.length?"Connected bars":"Demonstration bars"} · {new Date(technicalAnalysis.timestamp).toLocaleString()}</small></span><span><b>Bearish scenario</b><strong>~${chartInterpretation.bearCase.toFixed(2)}</strong><small>Risk scenario; gaps may exceed it</small></span></div><footer><b>Confirmation:</b> {technicalAnalysis.confirmation} <b>Invalidation:</b> {technicalAnalysis.invalidation}. This is decision support, not an order or a prediction.</footer></section>
            <div className="chart-layout">
              <div className="price-panel">
                <div className="price-grid"><span>${chartHigh.toFixed(2)}</span><span>${(chartLow+chartSpan*.75).toFixed(2)}</span><span>${(chartLow+chartSpan*.5).toFixed(2)}</span><span>${(chartLow+chartSpan*.25).toFixed(2)}</span><span>${chartLow.toFixed(2)}</span></div>
                <div className="candle-field">
                  {displayedCandles.map((c,i) => {
                    const [open,high,low,close,volume]=c; const green=close>=open;
                    return <div className="candle-column" key={i}>
                      <div className="wick" style={{height:`${Math.max(3,((high-low)/chartSpan)*285)}px`,bottom:`${((low-chartLow)/chartSpan)*285+52}px`}} />
                      <div className={`candle ${green?"up":"down"}`} style={{height:`${Math.max(3,(Math.abs(close-open)/chartSpan)*285)}px`,bottom:`${((Math.min(open,close)-chartLow)/chartSpan)*285+52}px`}} title={`O ${open.toFixed(2)} H ${high.toFixed(2)} L ${low.toFixed(2)} C ${close.toFixed(2)}`} />
                      <div className={`volume ${green?"up":"down"}`} style={{height:`${Math.max(3,Math.min(42,(volume/Math.max(...displayedCandles.map(value=>value[4])))*42))}px`}} />
                    </div>;
                  })}
                </div>
                <div className="ema ema-fast">{indicator}</div><div className="ema ema-slow">Trend confirmation</div>
                <span className="event-marker earnings" tabIndex={0} aria-label="Earnings event marker" title="E · Earnings event"><b>E</b><div role="tooltip"><strong>Earnings event</strong><small>A scheduled company report that can cause gaps, higher volume, and volatility. Check the confirmed date before acting.</small></div></span><span className="event-marker news" tabIndex={0} aria-label="Verified news marker" title="N · Verified market news"><b>N</b><div role="tooltip"><strong>Verified news</strong><small>A confirmed company or market headline. Read the primary source and observe price and volume reaction before making a decision.</small></div></span>
              </div>
              <aside className="chart-side">
                <h3>Technical read</h3>
                <div className="signal positive"><b>Bullish structure</b><span>Higher highs remain intact above $179.</span></div>
                <div className="signal"><b>Momentum</b><span>RSI 62.4 · strong, not overbought.</span></div>
                <div className="signal"><b>MACD</b><span>Positive histogram, momentum slowing.</span></div>
                <div className="signal warning"><b>Risk condition</b><span>Close below $176.90 invalidates this setup.</span></div>
                <button className="primary" onClick={()=>navigate("Prepare Trade")}>Send to trade planner →</button>
              </aside>
            </div>
            <div className="indicator-grid">
              <div className="mini-chart"><span>RSI (14) <b>62.4</b></span><div className="rsi-line"><i /></div><small>30 oversold</small><small>70 overbought</small></div>
              <div className="mini-chart"><span>MACD <b>+1.82</b></span><div className="macd-bars">{[3,6,9,13,18,14,11,8,5,2,-2,-4].map((x,i)=><i key={i} className={x<0?"negative":""} style={{height:`${Math.abs(x)+5}px`}} />)}</div><small>Momentum histogram</small></div>
              <div className="mini-chart performance"><span>Portfolio vs S&amp;P 500</span><b>+12.8% <small>vs +9.4%</small></b><div><i style={{width:"78%"}}/><em style={{width:"61%"}}/></div></div>
            </div>
            <section className="probability-engine">
              <div className="engine-head"><div><p>TRANSPARENT MULTI-TIMEFRAME PROBABILITY ENGINE</p><h3>Evidence alignment · {technicalAnalysis.probability}% bullish</h3><span>Calculated from price direction, moving-average structure, relative volume and timeframe weights. Decision support—not a forecast or trade signal.</span></div><label>Strategy<select value={analysisStrategy} onChange={e=>setAnalysisStrategy(e.target.value as "swing"|"position")}><option value="swing">Swing</option><option value="position">Position</option></select></label></div>
              <div className="timeframe-matrix">{technicalAnalysis.rows.map(row=><article key={row.frame} className={`${row.bias.toLowerCase()} ${row.available?"":"unavailable"}`}><b>{row.frame}</b><strong>{row.available?`${row.score}%`:"—"}</strong><span>{row.available?row.bias:"No data"}</span><small>{row.weight}% weight</small></article>)}</div>
              <div className="reality-grid"><article><span>CANDLE / BREAKOUT REALITY</span><h4>{technicalAnalysis.best?technicalAnalysis.best.name:"No qualified pattern"}</h4><b>{technicalAnalysis.best?`${technicalAnalysis.best.quality}/100 Pattern Quality`:"Insufficient contextual evidence"}</b><p>{technicalAnalysis.best?.evidence||"Wait for location, volume and follow-through evidence."}</p></article><article><span>EVIDENCE & DISAGREEMENT</span><h4>{technicalAnalysis.disagreement?"Timeframes disagree":"Directional evidence aligned"}</h4><b>{technicalAnalysis.relVol.toFixed(2)}× relative volume · ATR ${technicalAnalysis.atr.toFixed(2)}</b><p>{technicalAnalysis.disagreement?"Confidence is reduced. Do not force lower-timeframe evidence against higher-timeframe context.":"Alignment improves confidence but does not remove gap, news or execution risk."}</p></article><article><span>CONFIRMATION</span><h4>What must happen next</h4><p>{technicalAnalysis.confirmation}</p><span>INVALIDATION</span><p>{technicalAnalysis.invalidation}</p></article></div>
              <details className="pattern-catalog"><summary>Pattern coverage and current history query</summary><div>{Object.entries(patternLibrary).map(([group,names])=><p key={group}><b>{group}</b><span>{names.join(" · ")}</span></p>)}</div><small>Detected now: {technicalAnalysis.patterns.map(p=>`${p.name} (${p.quality})`).join(", ")||"none"}. Source: {chartBars.length?"connected market bars":"demonstration bars"}; calculated {new Date(technicalAnalysis.timestamp).toLocaleString()}.</small></details>
            </section>
            <div className="cycle-head">
              <div><p>LONG-RANGE MARKET CYCLES</p><h3>Performance through expansion, contraction and recovery</h3></div>
              <div>{(["1Y","5Y"] as const).map(range => <button key={range} className={cycleRange===range?"active":""} onClick={()=>setCycleRange(range)}>{range}</button>)}</div>
            </div>
            <div className="cycle-grid">
              <div className="long-chart">
                <div className="long-scale"><span>+80%</span><span>+40%</span><span>0%</span><span>−20%</span></div>
                <div className="long-series" aria-label={`${cycleRange} historical performance chart`}>
                  {(cycleRange === "1Y" ? fiveYearSeries.slice(-12) : fiveYearSeries).map((value,index,shown) => {
                    const previous=index ? shown[index-1] : value;
                    return <i key={index} className={value>=previous?"gain":"loss"} style={{height:`${Math.max(6,(value-72)*1.65)}px`}} title={`${value.toFixed(1)} index value`} />;
                  })}
                </div>
                <div className="cycle-zones"><span>Recovery</span><span>Expansion</span><span>Contraction</span><span>Recovery</span><span>Late cycle</span></div>
                <div className="long-labels"><span>{cycleRange==="5Y"?"2021":"12 months ago"}</span><span>{cycleRange==="5Y"?"2022":"9 months"}</span><span>{cycleRange==="5Y"?"2023":"6 months"}</span><span>{cycleRange==="5Y"?"2024":"3 months"}</span><span>Today</span></div>
              </div>
              <div className="cycle-summary">
                <span><small>{cycleRange} RETURN</small><b>+{cycleRange==="5Y"?"78.6":"12.8"}%</b></span>
                <span><small>ANNUALIZED</small><b>{cycleRange==="5Y"?"12.3":"12.8"}%</b></span>
                <span><small>MAX DRAWDOWN</small><b className="red">−22.1%</b></span>
                <span><small>VOLATILITY</small><b>18.4%</b></span>
                <p>Compare performance across a complete cycle. A strong return is less valuable if it required an unacceptable drawdown.</p>
              </div>
            </div>
            <div className="year-compare">
              <div className="year-head"><b>Year-by-year cycle comparison</b><span>Portfolio <i /> Benchmark <em /></span></div>
              {cycleYears.map(year => <div className="year-row" key={year.year}>
                <b>{year.year}<small>{year.phase}</small></b>
                <div className="return-track"><i className={year.portfolio<0?"negative":""} style={{width:`${Math.abs(year.portfolio)*2.2}%`}} /><span>{year.portfolio>0?"+":""}{year.portfolio}%</span></div>
                <div className="return-track benchmark"><i className={year.benchmark<0?"negative":""} style={{width:`${Math.abs(year.benchmark)*2.2}%`}} /><span>{year.benchmark>0?"+":""}{year.benchmark}%</span></div>
                <span className="drawdown">Max drawdown <b>{year.drawdown}%</b></span>
              </div>)}
              <p className="history-note">Historical charts use demonstration values until the market-data provider is configured. Past performance does not predict future results.</p>
            </div>
            <div className="provider-connect">
              <div><b>Connect live market data</b><span>Quotes, historical candles, news and paper/live account sync use a licensed provider connection.</span></div>
              <select aria-label="Market data provider"><option>Alpaca</option><option>Interactive Brokers</option><option>Webull</option><option>CoinMarketCap</option></select>
              <button onClick={()=>{setFeedNotice("Connection setup requires provider sign-in and API authorization");navigate("Settings")}}>Connect provider</button>
            </div>
          </section>
          <section className="asset-screener card" id="asset-search">
            <div className="screener-head"><div><p>INVESTMENT DISCOVERY & RECOMMENDATION ENGINE</p><h2>Find investments by purpose—not by hype</h2><span>Search, compare, and understand suitability across major investment categories.</span></div><em>EDUCATIONAL CATALOG · CONNECT LIVE DATA FOR CURRENT PRICES</em></div>
            <section className="advisor-start">
              <div className="advisor-intro"><span>✦ NORTHSTAR ADVISOR · START HERE</span><h3>You do not need to understand every market product.</h3><p>Tell Northstar what the money is for. The app will suggest a sensible place to begin, explain why, show the risks, and tell you what must be checked before investing.</p></div>
              <div className="market-lookup"><div><b>⌕ Search any stock or ETF</b><span>Enter a ticker or company name to learn whether it is a good fit, needs caution, or should be avoided.</span></div><input value={marketLookup} onChange={e=>setMarketLookup(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")searchMarket()}} placeholder="Example: AAPL, NVDA, SPY, Microsoft…" aria-label="Search any stock or ETF" /><button onClick={searchMarket}>✦ Analyze market</button>{marketLookupNotice&&<small>{marketLookupNotice}</small>}</div>
              {manualAssessment&&<section className={`manual-assessment ${manualAssessment.verdict}`}><div className="assessment-icon" aria-hidden="true">{manualAssessment.verdict==="favorable"?"✓":manualAssessment.verdict==="caution"?"!":"?"}</div><div><span>MANUAL SEARCH · PRELIMINARY DECISION</span><h3>{manualAssessment.symbol} · {manualAssessment.label}</h3><p><u>Why:</u> {manualAssessment.reason}</p></div><dl><div><dt>Bid</dt><dd>{manualAssessment.bid?`$${manualAssessment.bid.toFixed(2)}`:"—"}</dd></div><div><dt>Ask</dt><dd>{manualAssessment.ask?`$${manualAssessment.ask.toFixed(2)}`:"—"}</dd></div><div><dt>Last</dt><dd>{manualAssessment.last?`$${manualAssessment.last.toFixed(2)}`:"—"}</dd></div><div><dt>Daily move</dt><dd>{manualAssessment.changePct===null?"—":`${manualAssessment.changePct>=0?"+":""}${manualAssessment.changePct.toFixed(2)}%`}</dd></div></dl></section>}
              <div className="advisor-questions">
                <label><span>1. What is your goal?</span><select value={advisorGoal} onChange={e=>{setAdvisorGoal(e.target.value);setAdvisorPlanReady(false)}}>{["Build long-term wealth","Invest automatically every month","Create reliable income","Protect emergency money"].map(goal=><option key={goal}>{goal}</option>)}</select></label>
                <label><span>2. When will you need the money?</span><select value={advisorHorizon} onChange={e=>{setAdvisorHorizon(e.target.value);setAdvisorPlanReady(false)}}>{["Less than 1 year","1–3 years","3–7 years","10+ years"].map(value=><option key={value}>{value}</option>)}</select></label>
                <label><span>3. How much can you invest now or monthly?</span><div className="money-input"><b>$</b><input type="number" min="0" value={advisorAmount} onChange={e=>{setAdvisorAmount(+e.target.value);setAdvisorPlanReady(false)}} /></div></label>
                <label><span>4. How comfortable are you with losses?</span><select value={investorProfile} onChange={e=>{setInvestorProfile(e.target.value);setAdvisorPlanReady(false)}}><option value="Conservative">Low · protect money first</option><option value="Balanced">Medium · growth with stability</option><option value="Growth">Higher · long-term growth</option><option value="Active">Advanced · I understand trading risk</option></select></label>
              </div>
              <button className="advisor-button" onClick={buildAdvisorPlan}>Show my explained starting plan →</button>
              {advisorPlanReady&&<div className="advisor-answer"><div><span>NORTHSTAR'S STARTING POINT</span><h3>{selectedInvestment.name}</h3><p>For <b>{advisorGoal.toLowerCase()}</b>, a <b>{advisorHorizon.toLowerCase()}</b> horizon, and approximately <b>${advisorAmount.toLocaleString()}</b>, begin your research here. This is not permission to buy yet—the checks below explain what Northstar still needs to verify.</p></div><strong>{selectedInvestment.score}<small>/100</small></strong></div>}
            </section>
            <section className="advisor-shortlist"><div className="shortlist-head"><div><span>ADVISOR-SUGGESTED RESEARCH LIST</span><h3>Best starting candidates for a {investorProfile.toLowerCase()} profile</h3></div><small>{quoteStatus}</small></div><div className="shortlist-grid">{advisorSuggestions.map((item,index)=>{const quote=suggestionQuotes[item.symbol],overvalued=item.gap!==null&&item.gap>25,action=overvalued?"Sell / avoid review":index<2?"Buy research":"Wait / compare",decisionTone=overvalued?"decision-risk":index<2?"decision-positive":"decision-review";return <button className={decisionTone} key={item.id} title={`Open ${item.symbol} research analysis`} onClick={()=>window.location.assign(`/workspace/research/${encodeURIComponent(item.symbol.toLowerCase())}`)}><i>{index+1}</i><span><b>{item.symbol} · {item.name}</b><small>{item.why}</small></span><span className="quote-cell"><small>BID</small><b>{quote?.bid?`$${quote.bid.toFixed(2)}`:"—"}</b><small>ASK</small><b>{quote?.ask?`$${quote.ask.toFixed(2)}`:"—"}</b></span><em className={overvalued?"avoid":index<2?"top":"watch"}>{action}</em><strong>{item.adjusted}<small>/100 adjusted</small></strong></button>})}</div><p className="shortlist-note">Background guide: green = favorable research candidate; amber = wait or compare; red = risk or sell/avoid review. Color never replaces the written decision.</p></section>
            <div className="advanced-label"><span>Explore and compare products</span><small>Advanced view · optional</small></div>
            <nav className="investment-tabs" aria-label="Investment categories">{["Stocks & ETFs","Mutual Funds","Options","Fixed Income","Recurring Investing"].map(category=><button key={category} className={investmentCategory===category?"active":""} onClick={()=>{setInvestmentCategory(category);setAssetQuery("");const first=investmentCatalog.find(item=>item.category===category);if(first)setSelectedInvestmentId(first.id)}}><span>{category==="Stocks & ETFs"?"▥":category==="Mutual Funds"?"◫":category==="Options"?"⇄":category==="Fixed Income"?"▤":"↻"}</span>{category}<small>{investmentCatalog.filter(item=>item.category===category).length}</small></button>)}</nav>
            <div className="screener-controls investment-controls"><label><span>Search this category</span><input value={assetQuery} onChange={e=>setAssetQuery(e.target.value)} placeholder="Search symbol, name, strategy..." /></label><label><span>Your current profile</span><select value={investorProfile} onChange={e=>setInvestorProfile(e.target.value)}>{["Conservative","Balanced","Growth","Active"].map(x=><option key={x}>{x}</option>)}</select></label><label><span>Rank results</span><select value={assetSort} onChange={e=>setAssetSort(e.target.value)}><option value="score">Highest research score</option><option value="risk">Lower risk first</option></select></label></div>
            {investmentCategory==="Options"&&<section className="option-contract-advisor"><div className="option-advisor-head"><div><span>PROFESSIONAL OPTIONS CONTRACT SELECTOR</span><h3>Find the most suitable exact contract</h3><p>Northstar ranks live contracts by DTE, delta, premium risk, spread, volume, implied volatility and Greeks. It never sends an order.</p></div><em>LIVE CHAIN REQUIRED</em></div><div className="option-fields"><label>Underlying symbol<input value={optionSymbol} onChange={e=>setOptionSymbol(e.target.value.toUpperCase().replace(/[^A-Z.]/g,"").slice(0,10))} /></label><label>Directional outlook<select value={optionOutlook} onChange={e=>setOptionOutlook(e.target.value)}><option value="bullish">Bullish · long call</option><option value="bearish">Bearish · long put</option></select></label><label>Target expiration window<select value={optionTargetDte} onChange={e=>setOptionTargetDte(+e.target.value)}><option value="21">About 21 DTE</option><option value="45">About 45 DTE</option><option value="60">About 60 DTE</option><option value="90">About 90 DTE</option></select></label><label>Maximum premium risk<div className="money-input"><b>$</b><input type="number" min="50" value={optionMaxRisk} onChange={e=>setOptionMaxRisk(+e.target.value)} /></div></label><button onClick={findOptionContract}>Scan live chain →</button></div>{optionNotice&&<div className="option-notice">{optionNotice}</div>}{optionResult&&<article className="exact-contract"><div className="contract-verdict"><span>BEST CONTRACT CANDIDATE · VERIFY QUOTE BEFORE ACTING</span><h3>{optionResult.contract.contractSymbol}</h3><p>{optionResult.underlying} {optionResult.contract.expiration} ${optionResult.contract.strike.toFixed(2)} {optionResult.contract.type.toUpperCase()} · {optionResult.contract.dte} DTE</p></div><div className="contract-metrics"><span><small>Ask / debit</small><b>${optionResult.contract.ask.toFixed(2)}</b><em>${optionResult.contract.premium.toFixed(0)} per contract</em></span><span><small>Maximum loss</small><b>${optionResult.contract.maxLoss.toFixed(0)}</b><em>Long option premium</em></span><span><small>Breakeven</small><b>${optionResult.contract.breakeven.toFixed(2)}</b><em>At expiration</em></span><span><small>Delta</small><b>{optionResult.contract.delta.toFixed(2)}</b><em>Target near ±0.40</em></span><span><small>Spread</small><b>{optionResult.contract.spreadPct.toFixed(1)}%</b><em>Lower is better</em></span><span><small>IV</small><b>{optionResult.contract.iv===null?"N/A":`${(optionResult.contract.iv*100).toFixed(1)}%`}</b><em>{optionResult.feed} feed</em></span></div><div className="contract-explanation"><section><b>Why this contract ranked first</b>{optionResult.rationale.map(reason=><p key={reason}>✓ {reason}</p>)}</section><section><b>Mandatory checks</b>{optionResult.warnings.map(warning=><p key={warning}>! {warning}</p>)}</section></div><small>Chain timestamp: {new Date(optionResult.asOf).toLocaleString()}</small></article>}</section>}
            <div className="investment-discovery-layout">
              <div className="investment-results"><div className="investment-results-head"><span>{investmentCategory}</span><b>{categoryItems.length} results</b></div>{categoryItems.map(item=>{const fit=item.fit.includes(investorProfile);return <button className={`investment-result ${selectedInvestment.id===item.id?"selected":""}`} key={item.id} onClick={()=>setSelectedInvestmentId(item.id)}><span className="investment-symbol">{item.symbol.slice(0,5)}</span><span className="investment-name"><b>{item.name}</b><small>{item.subcategory} · {item.horizon}</small></span><span className={`fit-label ${fit?"good":"review"}`}>{fit?"Profile fit":"Review fit"}</span><strong>{item.score}<small>/100</small></strong><i>›</i></button>})}{!categoryItems.length&&<div className="empty-assets">No matches in this category. Try a broader search.</div>}</div>
              <article className="investment-analysis" id="selected-investment-analysis">
                {focusInvestmentAnalysis&&<div className="research-page-nav"><a href="/workspace/markets">← Back to recommendations</a><span>DEDICATED INVESTMENT RESEARCH · {selectedInvestment.symbol}</span></div>}
                {selectedInvestment.category==="Stocks & ETFs"&&<div className="plaid-notice" role="status">{researchStatus}</div>}
                <div className="analysis-top"><div><p>EXPLAINABLE ANALYSIS</p><h3>{selectedInvestment.symbol} · {selectedInvestment.name}</h3><span>{selectedInvestment.subcategory}</span></div><strong>{selectedInvestment.score}<small>/100 research score</small></strong></div>
                <div className={`recommendation-verdict ${selectedFit?"fit":"caution"}`}><i aria-hidden="true">{selectedFit?"✓":"!"}</i><b>{selectedFit?`RECOMMENDED FOR RESEARCH · ${investorProfile.toUpperCase()} FIT`:`NOT A DEFAULT FIT FOR ${investorProfile.toUpperCase()}`}</b><span>{selectedFit?"The product matches the selected profile, but account data and current market evidence must still be checked.":"The risk, horizon, or complexity does not naturally match the selected profile. Review alternatives first."}</span></div>
                <div className="investment-facts"><span><small>Risk</small><b>{selectedInvestment.risk}</b></span><span><small>Cost / structure</small><b>{selectedInvestment.cost}</b></span><span><small>Time horizon</small><b>{selectedInvestment.horizon}</b></span><span><small>Minimum</small><b>{selectedInvestment.minimum}</b></span></div>
                <section className={`execution-plan ${sellReview?"sell":""}`}><div className="execution-head"><span>READ-ONLY ACTION PLAN</span><h3>{selectedAction}</h3><p>{selectedQuote?.bid&&selectedQuote?.ask?`Live bid $${selectedQuote.bid.toFixed(2)} · ask $${selectedQuote.ask.toFixed(2)}. Use a limit order near a verified quote; never assume the displayed price will execute.`:"Connect live bid/ask data before using a precise entry or quantity."}</p></div><div className="execution-grid"><span><small>Maximum allocation</small><b>${positionBudget.toLocaleString(undefined,{maximumFractionDigits:0})}</b><em>{(allocationRate*100).toFixed(1)}% profile cap; limited by your ${advisorAmount.toLocaleString()} available amount</em></span><span><small>Suggested quantity</small><b>{selectedReferencePrice>0?(suggestedShares>=1?`${Math.floor(suggestedShares)} whole shares`: `${suggestedShares.toFixed(2)} fractional shares`):"Quote required"}</b><em>{selectedReferencePrice>0?`Approximately $${Math.min(positionBudget,(suggestedShares>=1?Math.floor(suggestedShares):suggestedShares)*selectedReferencePrice).toFixed(0)} at $${selectedReferencePrice.toFixed(2)}`:"No quantity without a current ask"}</em></span><span><small>Buy only when</small><b>{sellReview?"Do not add while overvaluation rule is active":selectedInvestment.score>=82?"Valuation and trend confirmation agree":"Score improves and invalidation is defined"}</b><em>Verify cash reserves, debt and portfolio concentration first</em></span><span><small>Sell / reduce when</small><b>{sellReview?"Now requires review · premium exceeds 25%":"Thesis breaks, risk limit is hit, or price exceeds fair value by 25%"}</b><em>Also review taxes, replacement options and earnings risk</em></span></div></section>
                {selectedFundamentals&&<section className="stock-fundamentals"><div className="fundamentals-title"><span>STOCK & ETF FUNDAMENTAL CHECK</span><b>Included in Northstar's research score</b></div><div className="fundamental-metrics"><span><small>P/E ratio</small><strong>{selectedFundamentals.pe.toFixed(1)}×</strong><p>{selectedFundamentals.pe>45?"High valuation: future growth expectations are demanding.":selectedFundamentals.pe<20?"Lower valuation: investigate whether risk or weak growth explains it.":"Moderate valuation: compare with its industry and history."}</p></span><span><small>{selectedInvestment.subcategory.includes("ETF")?"Fund size / AUM":"Market capitalization"}</small><strong>${selectedFundamentals.marketCap>=1000?(selectedFundamentals.marketCap/1000).toFixed(2)+"T":selectedFundamentals.marketCap+"B"}</strong><p>{selectedInvestment.subcategory.includes("ETF")?"Larger funds often provide stronger liquidity; size is not investment quality.":"Company size helps assess stability and concentration; it does not determine fair value."}</p></span><span><small>Five-year price growth</small><strong className="growth-positive">+{selectedFundamentals.growth5y}%</strong><p>Historical price change—not a forecast. Northstar also requires earnings, revenue and cash-flow quality.</p></span><span><small>{selectedInvestment.subcategory.includes("ETF")?"Distribution yield":"Dividend"}</small><strong>{selectedDividendYield>0?`Yes · ${selectedDividendYield.toFixed(2)}% yield`:"No regular dividend"}</strong><p>{selectedDividendYield>0?"Verify payout ratio, free-cash-flow coverage, dividend growth and the next ex-dividend date.":"The investment case depends on price appreciation and business growth rather than cash income."}</p></span><span className={sellReview?"sell-review-metric":""}><small>Price vs estimated fair value</small><strong>{valuationPremium!==null?`${valuationPremium>=0?"+":""}${valuationPremium.toFixed(1)}%`:"Provider required"}</strong><p>Market ${selectedFundamentals.price.toFixed(2)} vs model estimate ${selectedFairValue?.toFixed(2)}. Estimates must be updated as fundamentals change.</p></span></div>{valuationPremium!==null&&<div className={`valuation-decision ${sellReview?"sell":"hold"}`}><b>{sellReview?"SELL / REDUCE REVIEW · PRICE IS MORE THAN 25% ABOVE ESTIMATED FAIR VALUE":valuationPremium>0?"HOLD / VALUATION REVIEW · PRICE IS ABOVE ESTIMATED FAIR VALUE":"RESEARCH OPPORTUNITY · PRICE IS BELOW ESTIMATED FAIR VALUE"}</b><span>{sellReview?`The market price is ${valuationPremium.toFixed(1)}% above the model estimate. Review trimming or selling, but first verify the valuation model, thesis, taxes, position size, catalysts and replacement investment.`:`The valuation gap is ${valuationPremium.toFixed(1)}%. This does not trigger the greater-than-25% sell-review rule.`}</span></div>}</section>}
                {!selectedFundamentals&&selectedInvestment.category==="Stocks & ETFs"&&<div className="fundamentals-missing"><b>{liveResearch?.status==="connected"?"Finnhub connected · instrument metrics unavailable":"Fundamental data required"}</b><span>{liveResearch?.status==="connected"?`${selectedInvestment.symbol} was found, but Finnhub did not return sufficient P/E and market-cap data for this instrument. ETF AUM, holdings, expenses, distributions and performance require an ETF-specific dataset; Northstar will not invent them.`:"Connect Finnhub to retrieve current P/E, market capitalization, revenue growth, earnings growth and cash-flow evidence before a recommendation."}</span></div>}
                {selectedInvestment.category==="Stocks & ETFs"&&<section className="decision-framework"><div className="framework-head"><div><span>DISCIPLINED VALUE + GROWTH + CHART PROCESS</span><h3>Why Northstar is—or is not—suggesting this investment</h3></div><strong>{transparentDecisionScore??"—"}<small>/100 partial evidence</small></strong></div><div className="framework-grid"><article className={fiveYearScore!==null&&fiveYearScore>=70?"pass":"review"}><i>{fiveYearScore!==null&&fiveYearScore>=70?"✓":"!"}</i><b>Five-year growth</b><strong>{selectedFundamentals?`+${selectedFundamentals.growth5y}% price history`:"Data required"}</strong><p>History is context, not a forecast. Revenue, EPS and free-cash-flow growth must confirm it.</p></article><article className={valuationScore!==null&&valuationScore>=70?"pass":"review"}><i>{valuationScore!==null&&valuationScore>=70?"✓":"!"}</i><b>Value / P-E</b><strong>{selectedFundamentals?`${selectedFundamentals.pe.toFixed(1)}× P/E`:"Data required"}</strong><p>Compared with growth, sector peers and history. Buffett-style quality still requires ROIC, cash flow and debt.</p></article><article className={sizeScore!==null&&sizeScore>=70?"pass":"review"}><i>{sizeScore!==null&&sizeScore>=70?"✓":"!"}</i><b>Market cap & durability</b><strong>{selectedFundamentals?`$${selectedFundamentals.marketCap>=1000?(selectedFundamentals.marketCap/1000).toFixed(2)+"T":selectedFundamentals.marketCap+"B"}`:"Data required"}</strong><p>Size supports liquidity analysis but never makes a company automatically safe or inexpensive.</p></article><article className={dividendScore!==null&&dividendScore>=70?"pass":"neutral"}><i>{selectedDividendYield>0?"$":"—"}</i><b>Dividend quality</b><strong>{selectedDividendYield>0?`${selectedDividendYield.toFixed(2)}% indicated yield`:"No regular dividend"}</strong><p>Require payout coverage, dividend growth and cut history; avoid chasing unusually high yield.</p></article><article className={technicalScore!==null&&technicalScore>=70?"pass":"review"}><i>{technicalScore===null?"?":technicalScore>=70?"✓":"!"}</i><b>Candles & chart signals</b><strong>{technicalScore===null?"Load this symbol’s chart":technicalScore>=70?"Trend confirmation present":"Trend confirmation weak"}</strong><p>Check candles, volume, support, resistance, moving averages, RSI and MACD together—not one signal alone.</p></article><article className="review"><i>!</i><b>News & catalyst check</b><strong>Verified feed required</strong><p>Policy, earnings and company news must be verified, evaluated for financial impact and checked for “already priced in” risk.</p></article></div><div className="framework-rule"><b>Decision rule</b><span>No “BUY RESEARCH” label should become actionable until quality, valuation, technical confirmation, news, portfolio fit and risk checks pass. Missing evidence lowers confidence—it is never silently assumed.</span></div></section>}
                <div className="analysis-reasons"><section className="positive"><b><i>✓</i> Why it is on the list</b><p>{selectedInvestment.why}</p></section><section className="warning"><b><i>!</i> What can go wrong</b><p>{selectedInvestment.caution}</p></section></div>
                <div className="analysis-next"><span>✦ NEXT REQUIRED ANALYSIS</span><b>{selectedInvestment.next}</b></div>
                <div className="analysis-actions"><button onClick={()=>{sessionStorage.setItem("northstar-chart-symbol",selectedInvestment.symbol);navigate("Professional Charts")}}>View market evidence</button><button className="primary" onClick={()=>{const fundamentals=selectedFundamentals?` Current illustrative metrics: price $${selectedFundamentals.price.toFixed(2)}, P/E ${selectedFundamentals.pe.toFixed(1)}x, ${selectedInvestment.subcategory.includes("ETF")?"fund AUM":"market cap"} $${selectedFundamentals.marketCap>=1000?(selectedFundamentals.marketCap/1000).toFixed(2)+"T":selectedFundamentals.marketCap+"B"}, five-year price growth ${selectedFundamentals.growth5y}%, and ${selectedDividendYield>0?`an indicated dividend/distribution yield of ${selectedDividendYield.toFixed(2)}%`:"no regular dividend"}. Estimated fair value is $${selectedFairValue?.toFixed(2)} with a ${valuationPremium?.toFixed(1)}% valuation gap.`:"";const prompt=`Provide a full analysis of ${selectedInvestment.symbol} — ${selectedInvestment.name} for my ${investorProfile.toLowerCase()} profile. My goal is ${advisorGoal.toLowerCase()}, my time horizon is ${advisorHorizon.toLowerCase()}, and the amount is approximately $${advisorAmount.toLocaleString()}.${fundamentals} Explain in plain language: suitability, valuation, financial quality, five-year trend, dividend status and sustainability, risks, costs, diversification impact, bull/base/bear scenarios, better alternatives, and the exact evidence that would change the recommendation. If price is more than 25% above fair value, explain whether I should hold, trim, or sell after considering taxes and position size. Do not assume or place a trade.`;sessionStorage.setItem("northstar-full-analysis-prompt",prompt);navigate("Ask Northstar")}}>Ask for full analysis</button></div>
              </article>
            </div>
            <div className="screener-foot"><span>✓ Category-specific criteria</span><span>✓ Profile and horizon fit</span><span>✓ Costs, risks and next evidence</span><b>Recommendation means research next—not automatic purchase</b></div>
          </section>
          <section className="intel card" id="market-intel">
            <div className="intel-top">
              <div>
                <p>LIVE MARKET INTELLIGENCE</p>
                <h2>Events that may change risk or opportunity</h2>
                <span>
                  <i /> {newsStatus}
                </span>
              </div>
              <div className="intel-actions">
                <button onClick={()=>navigate("Settings")}>⚙ Alert preferences</button>
                <button className="primary" onClick={()=>notify("Watch creation requires the authenticated connected-data form.")}>＋ Create watch</button>
              </div>
            </div>
            <div className="plaid-notice" role="status">{macroStatus}</div>
            {macroSeries.length>0&&<div className="connection-summary">{macroSeries.slice(0,6).map(item=><div key={item.id}><small>{item.label}</small><b>{item.value===null?"—":`${item.value.toFixed(2)}${item.unit?` ${item.unit}`:""}`}</b><span>{item.date||"No observation date"}{item.change!==null?` · ${item.change>=0?"+":""}${item.change.toFixed(2)} previous`:""}</span></div>)}</div>}
            <div className="intel-filters">
              {["All", "ACT NOW TO REVIEW", "IMPORTANT", "WATCH", "INFO"].map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setAlertFilter(f)}
                    className={alertFilter === f ? "active" : ""}
                  >
                    {f}
                  </button>
                ),
              )}
            </div>
            <div className="alert-list">
              {visibleAlerts.map((a, index) => (
                <article key={`${a.title}-${a.time}-${index}`}>
                  <div
                    className={`urgency ${a.level.split(" ")[0].toLowerCase()}`}
                  >
                    {a.level}
                  </div>
                  <div className="alert-copy">
                    <div>
                      <span>{a.category}</span>
                      <time>{a.time}</time>
                    </div>
                    <h3>{a.title}</h3>
                    <p>
                      <b>Verified source:</b> {a.source}
                    </p>
                    <p>
                      <b>Portfolio fit:</b> {a.impact}
                    </p>
                    <div className="evidence">
                      <span>
                        Confidence <b>{a.confidence}%</b>
                      </span>
                      <span>
                        Price reaction <b>{a.move}</b>
                      </span>
                      <span>
                        Next step <b>{a.action}</b>
                      </span>
                    </div>
                  </div>
                  <button className="review" onClick={()=>{if("url" in a&&a.url)window.open(String(a.url),"_blank","noopener,noreferrer");else document.querySelector(".causal")?.scrollIntoView({behavior:"smooth"})}}>{"url" in a&&a.url?"Open source ↗":"Open evidence chain →"}</button>
                </article>
              ))}
            </div>
            <div className="intel-foot">
              <span>✓ Primary-source verification</span>
              <span>✓ Rumor suppression</span>
              <span>✓ Price-chase detection</span>
              <span>✓ Portfolio concentration check</span>
              <b>Alerts are research prompts—not trade orders.</b>
            </div>
          </section>
          <div className="intel-grid">
            <section className="card causal">
              <div className="title">
                <div>
                  <p>CAUSAL CHAIN · FEATURED EVENT</p>
                  <h2>Who may benefit—and who may lose</h2>
                </div>
                <span className="score">
                  91<small>/100</small>
                </span>
              </div>
              <div className="chain">
                <span>
                  <small>FORMAL ACTION</small>
                  <b>Export restriction</b>
                </span>
                <i>→</i>
                <span>
                  <small>DIRECT EFFECT</small>
                  <b>Foreign chip supply constrained</b>
                </span>
                <i>→</i>
                <span>
                  <small>SUBSTITUTION</small>
                  <b>Domestic capacity demand</b>
                </span>
                <i>→</i>
                <span>
                  <small>SECOND ORDER</small>
                  <b>Power, equipment, chemicals</b>
                </span>
              </div>
              <div className="exposure-map">
                <div>
                  <b>Bullish beneficiaries to research</b>
                  <span>
                    AMAT <em>Equipment</em>
                  </span>
                  <span>
                    LRCX <em>Equipment</em>
                  </span>
                  <span>
                    VRT <em>Data-center power</em>
                  </span>
                </div>
                <div>
                  <b>Potential losers / risks</b>
                  <span>
                    Restricted suppliers <em>Revenue risk</em>
                  </span>
                  <span>
                    Chip designers <em>China exposure</em>
                  </span>
                  <span>
                    SMH ETF <em>Your allocation is overweight</em>
                  </span>
                </div>
              </div>
              <div className="thesis-check">
                <span>
                  <b>Already priced in?</b> Partly—headline beneficiary is up
                  8.4%. Avoid chasing.
                </span>
                <span>
                  <b>Invalidation:</b> Policy delay, exemptions, or limited
                  revenue impact.
                </span>
                <span>
                  <b>Watch next:</b> Implementation date, company guidance,
                  volume confirmation.
                </span>
              </div>
            </section>
            <section className="card trackers">
              <div className="title">
                <div>
                  <p>WATCH NETWORK</p>
                  <h2>Sources and people</h2>
                </div>
              </div>
              {[
                [
                  "White House & Congress",
                  "Policy, tariffs, fiscal action",
                  "LIVE","https://www.whitehouse.gov/news/",
                ],
                ["Federal Reserve", "Rates, liquidity, bank policy", "LIVE","https://www.federalreserve.gov/newsevents/pressreleases.htm"],
                ["SEC · FDA · FTC", "Filings and regulatory decisions", "LIVE","https://www.sec.gov/newsroom"],
                ["CEOs & founders", "Verified public statements", "WATCH","https://www.sec.gov/search-filings"],
                [
                  "13F & insider filings",
                  "Legally public · delayed",
                  "DELAYED","https://www.sec.gov/search-filings",
                ],
              ].map((x) => (
                <div className="tracker" key={x[0]}>
                  <span>
                    <i />{" "}
                    <b>
                      {x[0]}
                      <small>{x[1]}</small>
                    </b>
                  </span>
                  <span className="tracker-actions"><em>{x[2]}</em><a href={x[3]} target="_blank" rel="noopener noreferrer" aria-label={`Open official source for ${x[0]} in a new tab`}>Open ↗</a></span>
                </div>
              ))}
              <div className="filing-note">
                Public filings may be delayed by days or weeks. Northstar never
                labels delayed disclosures as real-time insider knowledge.
              </div>
            </section>
          </div>
          <section className="themes card">
            <div className="title">
              <div>
                <p>THEME DISCOVERY ENGINE</p>
                <h2>Multiple events are converging</h2>
              </div>
              <button onClick={()=>navigate("Market Intel")}>Explore all themes →</button>
            </div>
            <div className="theme-list">
              {[
                [
                  "AI electricity demand",
                  "7 confirming events",
                  "Nuclear · grid · cooling · copper",
                  "Strong",
                ],
                [
                  "Domestic manufacturing",
                  "5 confirming events",
                  "Automation · construction · chemicals",
                  "Building",
                ],
                [
                  "Cybersecurity regulation",
                  "4 confirming events",
                  "Identity · cloud · compliance",
                  "Early",
                ],
                [
                  "Defense modernization",
                  "6 confirming events",
                  "Drones · space · secure communications",
                  "Strong",
                ],
              ].map((x) => (
                <div key={x[0]}>
                  <span>
                    <b>{x[0]}</b>
                    <small>{x[1]}</small>
                  </span>
                  <span>{x[2]}</span>
                  <em>{x[3]}</em>
                </div>
              ))}
            </div>
          </section>
          <div className="main-grid" id="scanner">
            <section className="card scanner">
              <div className="title">
                <div>
                  <p>AI OPPORTUNITY SCANNER</p>
                  <h2>{tab==="Scanner"?"Full ranked setup list":"Setups worth studying"}</h2>
                </div>
                {tab!=="Scanner"&&<button onClick={() => navigate("Scanner")}>View all →</button>}
              </div>
              <div className={`scanner-source ${chartBars.length?"live":"demo"}`}><b>{chartBars.length?"CONNECTED MARKET EVIDENCE":"ILLUSTRATIVE RESEARCH LIST"}</b><span>{chartBars.length?"Open a candidate’s chart to calculate current support, resistance, moving averages, volume confirmation, and conditional levels.":"These names are examples, not current stock recommendations. Connect Alpaca market data before relying on price or volume."}</span></div>
              {(tab==="Scanner"?scannerOpportunities:opportunities).map((o) => (
                <div className="opp-row" key={o.ticker}><button
                  className={pick.ticker === o.ticker ? "opp selected" : "opp"}
                  onClick={() => {
                    setPick(o);
                    setEntry(o.price);
                    setStop(+(o.price * 0.975).toFixed(2));
                    setTarget(+(o.price * 1.06).toFixed(2));
                  }}
                >
                  <span className="symbol">{o.ticker[0]}</span>
                  <span>
                    <b>{o.ticker}</b>
                    <small>{o.setup}</small>
                  </span>
                  <span className="trend">{o.trend}</span>
                  <strong>
                    {o.score}
                    <small>/100</small>
                  </strong>
                </button><button className="opp-prepare" type="button" onClick={()=>{sessionStorage.setItem("northstar-chart-symbol",o.ticker);sessionStorage.setItem("northstar-prepared-action",JSON.stringify({symbol:o.ticker,action:o.trend==="Bullish"?"Prepare conditional buy":"No action — monitor",reason:o.setup}));navigate("Prepare Trade")}}>+ Add to Prepare</button></div>
              ))}
            </section>
            <section className="card rationale">
              <div className="title">
                <div>
                  <p>EXPLAINABLE DECISION · MULTI-TIMEFRAME</p>
                  <h2>{pick.ticker} · Wait for confirmation</h2>
                </div>
                <span className="score">
                  {pick.score}
                  <small>/100</small>
                </span>
              </div>
              <div className="verdict">
                NOT AN ORDER · CONDITIONAL SETUP · WEEKLY ↑ · DAILY ↑ · 1H ↔
              </div>
              <p className="summary">
                {pick.name} is in a constructive higher-timeframe trend and
                pulling toward support. The current location is interesting, but
                entering before price proves demand could mean catching a deeper
                decline.
              </p>
              <div className="why">
                <div>
                  <b>Why it may work</b>
                  <ul>
                    <li>
                      Weekly and daily structure show higher highs and lows
                    </li>
                    <li>
                      Support at ${pick.support} offers a defined invalidation
                      area
                    </li>
                    <li>
                      Relative volume is {pick.volume}, showing active
                      participation
                    </li>
                  </ul>
                </div>
                <div>
                  <b>What can go wrong</b>
                  <ul>
                    <li>Close below support breaks the thesis</li>
                    <li>{pick.catalyst} can increase gap risk</li>
                    <li>Broad-market weakness may override the setup</li>
                  </ul>
                </div>
              </div>
              <div className="condition">
                <span>ENTRY CONDITION</span>
                <b>
                  Wait for a bullish candle to reclaim support with
                  above-average volume.
                </b>
              </div>
              <div className="scenarios">
                <span>
                  <b>42%</b>Bull: retest then continuation
                </span>
                <span>
                  <b>38%</b>Neutral: range continues
                </span>
                <span>
                  <b>20%</b>Bear: support fails
                </span>
              </div>
            </section>
          </div>
          <section className="card planner" id="trade-planner">
            <div className="title">
              <div>
                <p>MANDATORY RISK CHECK</p>
                <h2>Position blueprint</h2>
              </div>
              <span className={calc.rr >= 2 ? "pass" : "warn"}>
                {calc.rr >= 2 ? "✓ Passes rules" : "! Improve reward/risk"}
              </span>
            </div>
            <div className="plan-grid">
              <div className="fields">
                <label>
                  Account size ($)
                  <input
                    type="number"
                    value={capital}
                    onChange={(e) => setCapital(+e.target.value)}
                  />
                </label>
                <label>
                  Maximum risk (%)
                  <input
                    type="number"
                    step=".1"
                    max="1"
                    value={risk}
                    onChange={(e) => setRisk(+e.target.value)}
                  />
                </label>
                <label>
                  Entry ($)
                  <input
                    type="number"
                    value={entry}
                    onChange={(e) => setEntry(+e.target.value)}
                  />
                </label>
                <label>
                  Invalidation / stop ($)
                  <input
                    type="number"
                    value={stop}
                    onChange={(e) => setStop(+e.target.value)}
                  />
                </label>
                <label>
                  First target ($)
                  <input
                    type="number"
                    value={target}
                    onChange={(e) => setTarget(+e.target.value)}
                  />
                </label>
              </div>
              <div className="blueprint">
                <p>MAXIMUM POSITION</p>
                <strong>
                  {calc.shares.toLocaleString()} <small>shares</small>
                </strong>
                <span>
                  Capital exposure{" "}
                  <b>
                    $
                    {calc.exposure.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </b>
                </span>
                <span>
                  Maximum planned loss{" "}
                  <b className="red">−${calc.max.toFixed(2)}</b>
                </span>
                <span>
                  Reward / risk <b>{calc.rr.toFixed(1)} : 1</b>
                </span>
                <button onClick={() => navigate("Paper Simulator")}>
                  Practice this plan
                </button>
                <em>No live order will be sent.</em>
              </div>
            </div>
          </section>
          <PaperTradingSimulator initialSymbol={pick.ticker} initialCash={100000} accessToken={accessToken} />
          <div className="lower-grid">
            <section className="card ask" id="ask-northstar">
              <div className="title">
                <div>
                  <p>SHOULD I ENTER?</p>
                  <h2>Challenge your trade idea</h2>
                </div>
              </div>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <button className="primary" disabled={aiBusy} onClick={analyzeWithAI}>
                {aiBusy?"Analyzing evidence…":"Analyze with Investment AI"}
              </button>
              {analyzed && (
                <div className="answer">
                  <b>{aiAnswer.includes("not configured")?"Investment AI setup required":"Read-only decision analysis"}</b>
                  <p className="ai-response">{aiAnswer}</p>
                  <span>Northstar never submits an order. You must verify current data and act explicitly in your own institution.</span>
                </div>
              )}
            </section>
            <section className="card events">
              <div className="title">
                <div>
                  <p>CATALYST RADAR</p>
                  <h2>What could move markets</h2>
                </div>
              </div>
              <div>
                <time>10:00 ET</time>
                <span>
                  <b>Consumer confidence</b>
                  <small>High-impact macro event · volatility possible</small>
                </span>
                <em>HIGH</em>
              </div>
              <div>
                <time>14:00 ET</time>
                <span>
                  <b>Federal Reserve speaker</b>
                  <small>Watch rate-sensitive sectors and bond yields</small>
                </span>
                <em>MED</em>
              </div>
              <div>
                <time>FRI</time>
                <span>
                  <b>U.S. jobs report</b>
                  <small>Could change expectations for interest rates</small>
                </span>
                <em>HIGH</em>
              </div>
              <p className="news-note">
                Public-figure statements are treated as unverified catalysts
                until confirmed by primary reporting and visible market
                reaction.
              </p>
            </section>
          </div>
          <section className="cash-command card" id="bills-cards">
            <div className="title">
              <div>
                <p>HOUSEHOLD CASH-FLOW COMMAND CENTER</p>
                <h2>Everything due, before you invest</h2>
              </div>
              <button onClick={() => navigate("Bills & cards")}>
                Manage bills & cards →
              </button>
            </div>
            <div className="cash-equation">
              <span>
                <small>Expected monthly income</small>
                <b>${monthlyIncome.toLocaleString()}</b>
              </span>
              <i>−</i>
              <span>
                <small>Recurring bills</small>
                <b>${monthlyBills.toLocaleString()}</b>
              </span>
              <i>−</i>
              <span>
                <small>Card minimums</small>
                <b>${cardMinimums}</b>
              </span>
              <i>−</i>
              <span>
                <small>Other loan payments</small>
                <b>$3,258</b>
              </span>
              <i>=</i>
              <span className={freeCash < 0 ? "danger-cash" : "safe-cash"}>
                <small>Projected free cash</small>
                <b>${freeCash.toLocaleString()}</b>
              </span>
            </div>
            <div className="cash-advice">
              <b>Northstar decision</b>
              <span>
                Do not add money to trading this month. The projected cash flow
                is negative and the Visa balance costs 24.9% APR. Cover
                obligations, preserve liquidity, then direct surplus to the
                card.
              </span>
            </div>
          </section>
          <div className="bills-grid">
            <section className="card bill-center">
              <div className="title">
                <div>
                  <p>UPCOMING BILLS</p>
                  <h2>${monthlyBills.toLocaleString()} due this month</h2>
                </div>
                <button onClick={()=>notify("Bill creation will save to AWS PostgreSQL after authentication is configured.")}>＋ Add bill</button>
              </div>
              <div className="bill-head">
                <span>Bill</span>
                <span>Due</span>
                <span>Amount</span>
                <span>Autopay</span>
              </div>
              {bills.map((b) => (
                <div className="bill-row" key={b.name}>
                  <span className="bill-name">
                    <i>{b.name[0]}</i>
                    <b>
                      {b.name}
                      <small>{b.category}</small>
                    </b>
                  </span>
                  <span>{b.due}</span>
                  <b>${b.amount}</b>
                  <span className={b.autopay ? "autopay" : "manual"}>
                    {b.autopay ? "ON" : "MANUAL"}
                  </span>
                  {b.change > 0 && <em>↑ ${b.change}</em>}
                </div>
              ))}
              <div className="bill-foot">
                <span>Annual recurring total</span>
                <b>${(monthlyBills * 12).toLocaleString()}</b>
                <span>3 bills increased · $37/month</span>
              </div>
            </section>
            <section className="card bill-insights">
              <div className="title">
                <div>
                  <p>BILL INTELLIGENCE</p>
                  <h2>Needs attention</h2>
                </div>
              </div>
              <div className="insight urgent">
                <b>Auto insurance due in 12 days</b>
                <span>
                  Autopay is off. Missing this payment could create a coverage
                  lapse.
                </span>
                <button onClick={()=>notify("Payment-plan reminder marked for review. No money was moved.")}>Mark payment plan →</button>
              </div>
              <div className="insight">
                <b>Subscriptions rose 17.5%</b>
                <span>
                  Streaming increased by $7. Review usage before the next
                  renewal.
                </span>
                <button onClick={()=>document.querySelector(".bill-center")?.scrollIntoView({behavior:"smooth"})}>Review subscriptions →</button>
              </div>
              <div className="insight">
                <b>Electricity is above trend</b>
                <span>
                  This bill is $18 higher than the three-month average.
                </span>
                <button onClick={()=>document.getElementById("market-charts")?.scrollIntoView({behavior:"smooth"})}>Compare history →</button>
              </div>
            </section>
          </div>
          <section className="cards-center card">
            <div className="title">
              <div>
                <p>CREDIT CARD CONTROL</p>
                <h2>Pay expensive revolving debt first</h2>
              </div>
              <span className="warn">1 HIGH-RISK CARD</span>
            </div>
            <div className="card-table">
              <div className="card-head">
                <span>Account</span>
                <span>Balance / available</span>
                <span>Utilization</span>
                <span>APR</span>
                <span>Minimum / due</span>
                <span>Rewards</span>
              </div>
              {cards.map((c) => {
                const utilization = (c.balance / c.limit) * 100;
                return (
                  <div className="credit-row" key={c.name}>
                    <span>
                      <i>◫</i>
                      <b>
                        {c.name}
                        <small>${c.limit.toLocaleString()} limit</small>
                      </b>
                    </span>
                    <span>
                      <b>${c.balance.toLocaleString()}</b>
                      <small>
                        ${(c.limit - c.balance).toLocaleString()} available
                      </small>
                    </span>
                    <span>
                      <b className={utilization > 50 ? "red" : ""}>
                        {utilization.toFixed(1)}%
                      </b>
                      <i className="util">
                        <i style={{ width: `${utilization}%` }} />
                      </i>
                    </span>
                    <span>
                      <b className={c.apr > 20 ? "red" : ""}>{c.apr}%</b>
                      <small>
                        ${Math.round((c.balance * c.apr) / 1200)}/mo est.
                      </small>
                    </span>
                    <span>
                      <b>${c.min}</b>
                      <small>{c.due}</small>
                    </span>
                    <span>
                      <b>{c.rewards}</b>
                      <small>Current value</small>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="card-scenario">
              <div>
                <p>PAYOFF SCENARIO · VISA SIGNATURE</p>
                <h3>What if I pay an extra ${extraCard}?</h3>
                <input
                  type="range"
                  min="0"
                  max="1500"
                  step="50"
                  value={extraCard}
                  onChange={(e) => setExtraCard(+e.target.value)}
                />
              </div>
              <span>
                <small>New monthly payment</small>
                <b>${248 + extraCard}</b>
              </span>
              <span>
                <small>Estimated payoff</small>
                <b>{Math.max(5, 34 - Math.round(extraCard / 55))} months</b>
              </span>
              <span>
                <small>Estimated interest saved</small>
                <b>${Math.round(extraCard * 5.8).toLocaleString()}</b>
              </span>
              <button onClick={()=>notify(`Payoff scenario saved for review: extra $${extraCard}/month. No payment was sent.`)}>Apply to payoff plan</button>
            </div>
            <p className="fine cards-fine">
              Estimates assume no new charges and a stable APR. The card
              issuer’s minimum-payment formula may change.
            </p>
          </section>
          <section className="debt-health card" id="liabilities">
            <div className="title">
              <div>
                <p>PERSONAL FINANCE · LIABILITIES</p>
                <h2>Household debt dashboard</h2>
              </div>
              <button onClick={() => navigate("Liabilities")}>
                Open full debt center →
              </button>
            </div>
            <div className="health-metrics">
              <span>
                <small>Total liabilities</small>
                <b>${totalDebt.toLocaleString()}</b>
              </span>
              <span>
                <small>Monthly obligations</small>
                <b>$3,258</b>
              </span>
              <span>
                <small>Weighted APR</small>
                <b>{weightedApr.toFixed(2)}%</b>
              </span>
              <span>
                <small>Debt-to-income</small>
                <b>31.4%</b>
              </span>
              <span>
                <small>Home equity</small>
                <b>$164,360</b>
              </span>
            </div>
            <div className="debt-list">
              {debts.map((d) => (
                <div key={d.name}>
                  <span className="debt-type">{d.type[0]}</span>
                  <span>
                    <b>{d.name}</b>
                    <small>
                      {d.type} · ${d.payment}/month
                    </small>
                  </span>
                  <span>
                    <small>Balance</small>
                    <b>${d.balance.toLocaleString()}</b>
                  </span>
                  <span>
                    <small>APR</small>
                    <b className={d.apr > 12 ? "red" : ""}>{d.apr}%</b>
                  </span>
                  <em className={d.urgency === "Critical" ? "critical" : ""}>
                    {d.urgency}
                  </em>
                </div>
              ))}
            </div>
          </section>
          <div className="finance-grid">
            <section className="card mortgage">
              <div className="title">
                <div>
                  <p>MORTGAGE INTELLIGENCE</p>
                  <h2>What if I pay extra?</h2>
                </div>
                <span className="pass">4.125% FIXED</span>
              </div>
              <div className="mortgage-stats">
                <span>
                  <small>Home value</small>
                  <b>$452,000</b>
                </span>
                <span>
                  <small>Mortgage balance</small>
                  <b>$287,640</b>
                </span>
                <span>
                  <small>Estimated equity</small>
                  <b>$164,360</b>
                </span>
                <span>
                  <small>Loan-to-value</small>
                  <b>63.6%</b>
                </span>
              </div>
              <label className="extra">
                Additional monthly principal <b>${extraMortgage}</b>
                <input
                  type="range"
                  min="0"
                  max="1500"
                  step="50"
                  value={extraMortgage}
                  onChange={(e) => setExtraMortgage(+e.target.value)}
                />
              </label>
              <div className="savings">
                <span>
                  <small>Estimated time saved</small>
                  <b>{((extraMortgage / 100) * 1.4).toFixed(1)} years</b>
                </span>
                <span>
                  <small>Estimated interest saved</small>
                  <b>${Math.round(extraMortgage * 142).toLocaleString()}</b>
                </span>
                <span>
                  <small>New projected payoff</small>
                  <b>{2049 - Math.round((extraMortgage / 100) * 1.4)}</b>
                </span>
              </div>
              <p className="fine">
                Illustrative amortization scenario. Taxes, escrow, rate changes,
                and lender rules can affect actual results.
              </p>
            </section>
            <section className="card next-money">
              <div className="title">
                <div>
                  <p>HOUSEHOLD DECISION ASSISTANT</p>
                  <h2>What should I do with my next $500?</h2>
                </div>
              </div>
              <div className="priority">
                <strong>1</strong>
                <span>
                  <b>Pay the 24.9% credit card</b>
                  <small>
                    A guaranteed reduction in high-cost interest is stronger
                    than uncertain market returns.
                  </small>
                </span>
              </div>
              <div className="priority">
                <strong>2</strong>
                <span>
                  <b>Build emergency reserves</b>
                  <small>
                    You currently have about one month. Target at least three
                    before increasing trading risk.
                  </small>
                </span>
              </div>
              <div className="priority muted">
                <strong>3</strong>
                <span>
                  <b>Mortgage or investing</b>
                  <small>
                    Compare after-tax mortgage cost with uncertain
                    investment-return ranges after the first two priorities.
                  </small>
                </span>
              </div>
              <div className="decision-warning">
                Investing $500 now could expose the household while expensive
                debt compounds at 24.9% APR.
              </div>
            </section>
          </div>
          <section className="household card" id="household">
            <div className="title">
              <div>
                <p>HOUSEHOLD & PERMISSIONS</p>
                <h2>Your shared financial team</h2>
              </div>
              {["owner","co_owner"].includes(householdAccess?.role||"")&&<button onClick={()=>setInviteOpen(value=>!value)}>＋ Invite member</button>}
            </div>
            {(householdAccess?.availableHouseholds?.length||0)>1&&<div className="household-switcher"><label>Active household<select value={householdAccess?.household?.id||""} onChange={event=>switchHousehold(event.target.value)}>{householdAccess?.availableHouseholds.map(item=><option key={item.id} value={item.id}>{item.name} · {item.role.replaceAll("_"," ")}</option>)}</select></label></div>}
            {inviteOpen&&<div className="invite-panel"><label>Invitation purpose<select value={invitationType} onChange={event=>setInvitationType(event.target.value as "join_household"|"create_household")}><option value="join_household">Join this household</option><option value="create_household">Create a separate household as owner</option></select></label><label>Email address<input type="email" value={inviteEmail} onChange={event=>setInviteEmail(event.target.value)} placeholder="person@example.com" /></label>{invitationType==="create_household"?<label>New household name<input value={invitedHouseholdName} onChange={event=>setInvitedHouseholdName(event.target.value)} placeholder="Example: Rivera Household" /></label>:<label>Access role<select value={inviteRole} onChange={event=>setInviteRole(event.target.value)}><option value="co_owner">Co-owner · full application access</option><option value="manager">Household manager · manage finances</option><option value="account_connector">Account connector · link own banks</option><option value="investment_manager">Investment manager · research and plans</option><option value="member">Household member · contribute records</option><option value="observer">Observer · view only</option><option value="accountant">Accountant · financial records</option><option value="student">Student / kid · Academy only</option></select></label>}<button className="primary" disabled={!inviteEmail.includes("@")||(invitationType==="create_household"&&!invitedHouseholdName.trim())||inviteNotice.includes("Creating")} onClick={inviteMember}>Send secure invitation</button><button onClick={()=>setInviteOpen(false)}>Cancel</button><small className="invite-explainer">Authentication alone never grants access. A join invitation adds the exact email to this household with the selected role. A new-household invitation creates a separate, isolated workspace owned by the recipient. No household can see another household unless that same user is explicitly invited to both.</small></div>}
            {inviteNotice&&<div className="invite-notice"><span>{inviteNotice}</span>{inviteNotice.toLowerCase().includes("sign in with the email")&&<button type="button" onClick={()=>{const token=new URLSearchParams(window.location.search).get("invite");if(token)sessionStorage.setItem("northstar-pending-invite",token);setSignedIn(false);setAccessToken("");signOutCognito()}}>Switch to invited account →</button>}</div>}
            <div className="members">
              {(householdAccess?.members||[{user_id:"self",display_name:displayName,email:accountEmail,role:"owner",status:"active"}]).map((member,index)=><span key={member.user_id}><i className={`avatar ${index%2?"rose":""}`}>{member.display_name.split(" ").map(value=>value[0]).join("").slice(0,2).toUpperCase()}</i><b>{member.display_name}<small>{member.email} · {member.role.replaceAll("_"," ")}{member.accepted_at?` · joined ${new Date(member.accepted_at).toLocaleString()}`:""}</small></b><em>{member.user_id==="local_owner"||member.email===accountEmail?"YOU":"ACTIVE"}</em>{["owner","co_owner"].includes(householdAccess?.role||"")&&member.role!=="owner"&&member.email!==accountEmail&&<button className="remove-access" type="button" onClick={()=>removeHouseholdMember(member.user_id,member.display_name)}>Remove access</button>}</span>)}
              {householdAccess?.invitations.map(invite=>{const status=invite.status==="pending"&&new Date(invite.expires_at)<=new Date()?"expired":invite.status,inviteType=invite.invitation_type||"join_household";return <span key={invite.id} className={`invitation-${status}`}><i className="avatar gold-bg">{status==="accepted"?"✓":"?"}</i><b>{invite.email}<small>{inviteType==="create_household"?`new owner · ${invite.household_name}`:invite.role.replaceAll("_"," ")} · {status==="accepted"&&invite.accepted_at?`accepted ${new Date(invite.accepted_at).toLocaleString()}`:status==="pending"?`expires ${new Date(invite.expires_at).toLocaleDateString()}`:status}</small></b><em>{status.toUpperCase()}</em>{status==="pending"&&<div className="invitation-actions"><button type="button" disabled={inviteNotice.includes("resending")} onClick={()=>createInvitation(invite.email,invite.role,true,inviteType,invite.household_name||"")}>↻ Resend</button><button className="remove-access" type="button" onClick={()=>cancelInvitation(invite.id)}>Cancel invitation</button></div>}</span>})}
            </div>
            <div className="role-note">
              <b>Role protection</b>
              <span>
                Owners manage access. Household managers can update shared finances. Investment managers can analyze portfolios and plans but cannot invite users, access provider tokens, move money, or execute trades. Viewers remain read-only. Every invitation and acceptance is logged.
              </span>
            </div>
          </section>
          <section className="attention card" id="attention-settings">
            <div className="title">
              <div>
                <p>MOBILE, TIMEZONE & BEHAVIOR GUARDRAILS</p>
                <h2>Stay informed without living in the market</h2>
              </div>
              <span className="pass">INSTALLABLE PWA</span>
            </div>
            <div className="attention-grid">
              <div className="setting-block">
                <b>Market timezone</b>
                <p>
                  Arizona uses Mountain Standard Time year-round. Northstar
                  converts exchange hours and alerts automatically.
                </p>
                <label>
                  Home timezone
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="auto">Use current device timezone</option>
                    {globalTimezones.map(zone => <option value={zone} key={zone}>{zone.replace(/_/g," ")}</option>)}
                  </select>
                </label>
                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={travelMode}
                    onChange={(e) => setTravelMode(e.target.checked)}
                  />
                  <span>
                    <b>Travel mode</b>
                    <small>
                      {travelMode
                        ? "Following device timezone; exchange times remain anchored to New York."
                        : "Home timezone stays fixed when traveling."}
                    </small>
                  </span>
                </label>
              </div>
              <div className="setting-block">
                <b>Daily analysis budget</b>
                <p>
                  Limit deliberate market analysis to reduce fatigue,
                  overtrading, and emotionally driven decisions.
                </p>
                <div className="limit-value">
                  <strong>{dailyLimit}</strong>
                  <span>minutes per market day</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="120"
                  step="10"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(+e.target.value)}
                />
                <div className="session-plan">
                  <span>
                    <b>40 min</b>Opening context
                  </span>
                  <span>
                    <b>10 min</b>Closing review
                  </span>
                  <span>
                    <b>10 min</b>Reserved for alerts
                  </span>
                </div>
              </div>
              <div className="setting-block decision-window-setting">
                <b>Live decision window</b>
                <p>Northstar recommends the first deliberate review at 10:15 a.m. New York time, after the opening volatility. The plan continues refreshing while the market is open.</p>
                <label>Primary review time (New York)<input type="time" value={decisionTime} onChange={e=>setDecisionTime(e.target.value)}/></label>
                <div className="converted-time"><span>Your selected timezone</span><strong>{decisionTimeLabel}</strong></div>
                <label>Refresh the live prediction list<select value={intradayRefreshMinutes} onChange={e=>setIntradayRefreshMinutes(Number(e.target.value))}><option value={5}>Every 5 minutes</option><option value={15}>Every 15 minutes</option><option value={30}>Every 30 minutes</option><option value={60}>Every hour</option></select></label>
                <label className="switch-row"><input type="checkbox" checked={decisionAlarmEnabled} onChange={e=>setDecisionAlarmEnabled(e.target.checked)}/><span><b>Decision-window alarm {decisionAlarmEnabled?"ON":"OFF"}</b><small>{decisionAlarmEnabled?"A browser notification will remind you at the converted review time while Northstar is open.":"Enable this after allowing browser notifications."}</small></span></label>
                <small className="setup-note">Saved on this device. Background alerts when the app is closed require deployed HTTPS Web Push; this control never places a trade.</small>
              </div>
              <div className="setting-block">
                <b>Mobile push notifications</b>
                <p>
                  Only IMPORTANT and ACT NOW TO REVIEW events interrupt you.
                  INFO and WATCH stay in the daily digest.
                </p>
                <div className="notification-actions"><button className={`primary notify ${notifyClass}`} disabled={notifyClass==="unsupported"} onClick={()=>{if(Notification.permission==="granted"){localStorage.setItem("northstar-push-enabled","true");setPushEnabled(true);setNotifyStatus("Northstar alerts ON · browser permission granted")}else enableNotifications()}}>{pushEnabled?"✓ Northstar alerts enabled":"Enable Northstar alerts"}</button><button className="notification-off" disabled={!pushEnabled} onClick={()=>{localStorage.setItem("northstar-push-enabled","false");setPushEnabled(false);setNotifyStatus("Northstar alerts OFF · browser permission remains granted")}}>Turn off alerts</button></div>
                <span className={`notify-status ${notifyClass}`} role="status"><i />{notifyStatus}</span>
                <small className="setup-note">
                  To revoke browser permission completely, open the site controls beside the address bar → Notifications → Block. Web Push delivery also requires HTTPS, a push-signing key, and a server subscription endpoint.
                </small>
              </div>
              <div className="setting-block provider-setting" id="market-data-settings">
                <b>Market Data & Clock</b>
                <p>Connect the official U.S. exchange clock for trading days, holidays, early closes, and timezone-aware countdowns.</p>
                <div className={`connection-state ${marketClock.status==="connected"?"connected":"missing"}`}><i />{marketClock.status==="connected"?"Connected · official clock active":"Not connected · setup required"}</div>
                <div className="config-keys"><span><b>ALPACA_API_KEY</b><small>Your read-only/paper Alpaca key ID</small></span><span><b>ALPACA_API_SECRET</b><small>Your secret key—server only</small></span><span><b>ALPACA_CLOCK_BASE_URL</b><small>https://paper-api.alpaca.markets</small></span></div>
                <div className="setup-steps"><b>Local setup</b><span>1. Open the Northstar Trading project’s <code>.env.local</code> file.</span><span>2. Add the three values shown above.</span><span>3. Restart the local app, then test the connection.</span></div>
                <button className="primary notify" onClick={testMarketClock}>Test market-clock connection</button>
                <small className="setup-note">Credentials are never entered into this browser page or exposed to client code.</small>
              </div>
            </div>
            <div className="discipline-rules">
              <span>✓ No alerts during sleep hours</span>
              <span>✓ Maximum 3 urgent alerts/day</span>
              <span>✓ 10-minute cooling-off before trade planning</span>
              <span>✓ Session locks after daily limit</span>
              <span>✓ Vacation digest mode</span>
            </div>
          </section>
          <section className="decision-journal card" id="decision-journal">
            <div className="journal-head"><div><span>▤ SYNCHRONIZED DECISION JOURNAL</span><h2>Record the evidence before you act</h2><p>The journal now follows the same valuation, growth, dividend, Bollinger/chart, news, portfolio-fit, and risk checks used by the advisor.</p></div><strong>{journalEntries.length}<small>saved decisions</small></strong></div>
            <div className="journal-layout"><form onSubmit={e=>{e.preventDefault();saveJournalEntry()}}><div className="journal-basics"><label>Symbol / asset<input value={journalForm.symbol} onChange={e=>setJournalForm(current=>({...current,symbol:e.target.value.toUpperCase()}))} placeholder="AAPL, VTI, SCHD…"/></label><label>Decision<select value={journalForm.decision} onChange={e=>setJournalForm(current=>({...current,decision:e.target.value}))}><option>Watch / wait</option><option>Research for possible buy</option><option>Hold</option><option>Reduce / sell review</option><option>Avoid</option><option>Paper trade only</option></select></label><label>Time horizon<select value={journalForm.timeframe} onChange={e=>setJournalForm(current=>({...current,timeframe:e.target.value}))}><option>Days / trading</option><option>2–3 years</option><option>5 years</option><option>10+ years</option></select></label><label>Emotional state<select value={journalForm.emotion} onChange={e=>setJournalForm(current=>({...current,emotion:e.target.value}))}><option>Calm</option><option>Excited / FOMO</option><option>Fearful</option><option>Recovering from a loss</option><option>Overconfident</option></select></label></div><div className="journal-fields"><label><span>✦ Observation and thesis</span><textarea value={journalForm.thesis} onChange={e=>setJournalForm(current=>({...current,thesis:e.target.value}))} placeholder="What do I believe, over what period, and why?"/></label><label><span>✓ Business quality and five-year growth</span><textarea value={journalForm.fundamentals} onChange={e=>setJournalForm(current=>({...current,fundamentals:e.target.value}))} placeholder="Revenue, EPS, free cash flow, margins, debt, market cap…"/></label><label><span>$ Valuation and dividend</span><textarea value={journalForm.valuation} onChange={e=>setJournalForm(current=>({...current,valuation:e.target.value}))} placeholder="P/E vs history/peers, margin of safety, yield, payout coverage…"/></label><label><span>⌁ Candles, Bollinger Bands and confirmation</span><textarea value={journalForm.technical} onChange={e=>setJournalForm(current=>({...current,technical:e.target.value}))} placeholder="Timeframe, bands, candle pattern, volume, support, resistance, RSI/MACD…"/></label><label><span>◉ News and catalysts</span><textarea value={journalForm.news} onChange={e=>setJournalForm(current=>({...current,news:e.target.value}))} placeholder="Verified source, financial impact, price reaction, already priced in?"/></label><label className="required"><span>! Risk and invalidation</span><textarea value={journalForm.risk} onChange={e=>setJournalForm(current=>({...current,risk:e.target.value}))} placeholder="What specific evidence proves this idea wrong? Maximum acceptable loss?"/></label></div><div className="journal-save"><p><u>Required decision structure:</u> Observation → Evidence → Risk → Recommendation → Why → Invalidation → What to monitor.</p><button className="primary" type="submit">Save decision record</button>{journalNotice&&<span>{journalNotice}</span>}</div></form><aside className="journal-history"><h3>Recent decisions</h3>{journalEntries.slice(0,6).map(entry=><article key={entry.id}><div><b>{entry.symbol}</b><em>{entry.decision}</em></div><time>{new Date(entry.createdAt).toLocaleDateString()} · {entry.timeframe}</time><p>{entry.thesis}</p><span>Invalidation: {entry.risk}</span></article>)}{!journalEntries.length&&<div className="journal-empty">No decisions recorded yet. The purpose is to preserve what you knew and felt before seeing the outcome.</div>}</aside></div>
          </section>
          <section className="help-guide card" id="help-guide">
            <div className="title">
              <div>
                <p>HELP & APP GUIDE</p>
                <h2>How to use Northstar safely and effectively</h2>
              </div>
              <span className="guide-status">8-part guide</span>
            </div>
            <div className="guide-start">
              <strong>Your focused daily workflow</strong>
              <ol>
                <li><b>Cover essentials.</b> Review bills, emergency savings, and expensive debt before taking market risk.</li>
                <li><b>Read the market.</b> Check the regime, calendar, and important alerts—not every headline.</li>
                <li><b>Investigate an opportunity.</b> Open its explanation, evidence, opposing case, and invalidation condition.</li>
                <li><b>Plan before acting.</b> Set entry, stop, target, and position size; then respect your daily time limit.</li>
              </ol>
            </div>
            <HelpVideoGuides />
            <div className="guide-grid">
              <article><span>01</span><h3>Market Intelligence</h3><p>ACT NOW TO REVIEW means time-sensitive research, not an automatic trade. IMPORTANT affects a thesis; WATCH belongs on your list; INFO stays in the digest.</p></article>
              <article><span>02</span><h3>Opportunity Scanner</h3><p>Ranks setups using trend, valuation, catalysts, sentiment, and risk. Select a symbol to see why it qualifies and what evidence could invalidate it.</p></article>
              <article><span>03</span><h3>Trade Planner</h3><p>Enter an intended entry, stop, target, and account risk. Northstar calculates risk/reward and a disciplined position-size blueprint before any order.</p></article>
              <article><span>04</span><h3>Money & Debt</h3><p>Bills, cards, loans, mortgage, savings, and investments share one financial picture. High-cost debt and weak reserves can lower investing capacity.</p></article>
              <article><span>05</span><h3>Household Access</h3><p>Invite family members and assign roles. An owner can manage everything; collaborators should receive only the permissions needed for shared finances.</p></article>
              <article><span>06</span><h3>Alerts & Focus</h3><p>Choose your timezone, travel mode, daily analysis limit, quiet hours, and alert urgency. Push alerts require HTTPS plus a configured notification service.</p></article>
              <article><span>07</span><h3>Accounts & Security</h3><p>Email or SMS verification requires a production OTP provider. The visible bypass is localhost-only for development and must never ship in production.</p></article>
              <article><span>08</span><h3>Data Connections</h3><p>Live quotes, brokerage orders, bank balances, news, email/SMS, and push delivery require approved provider credentials. Illustrative data is clearly labeled.</p></article>
            </div>
            <div className="guide-safety">
              <b>Decision rule:</b>
              <span>Northstar explains evidence and uncertainty; it does not promise profit or automatically move money. Confirm prices, fees, taxes, and account details with the connected institution before acting.</span>
            </div>
          </section>
          <section className="academy-hub card" id="academy-course">
            <div className="academy-banner"><div><p>NORTHSTAR ACADEMY · 20-WEEK GUIDE</p><h2>Read, practice, test, and improve your decisions</h2><span>Structured from your investment and trading workbook.</span></div><strong>{completedWeeks.length}<small>/20 complete</small></strong></div>
            <div className="academy-library"><div><span>PRIVATE DOCUMENT LIBRARY</span><h3>Mi Libro de Inversión y Trading · 20 Semanas</h3><p>{bookNotice}</p></div><label className="book-upload">Upload PDF<input type="file" accept="application/pdf" onChange={e=>{const file=e.target.files?.[0];if(file)uploadAcademyBook(file)}} /></label>{readerUrl&&<a href={readerUrl} target="_blank" rel="noreferrer">Open full reader ↗</a>}</div>
            {readerUrl&&<div className="book-reader"><iframe src={readerUrl} title="Investment and trading workbook reader" /></div>}
            <section className="academy-source-library"><header><div><span>BUILT-IN LEARNING PATH · NO OUTSIDE VIDEO REQUIRED</span><h3>Understand it simply, see it, practice it, then prove mastery</h3><p>Every concept stays inside Northstar and progresses from beginner language to professional application. Learners predict first; the lab reveals the next candles only after an answer.</p></div><strong>6-STEP METHOD<small>Learn at your own pace</small></strong></header><div className="source-learning-grid"><article><span>STEP 1 · PLAIN LANGUAGE</span><h4>What is price doing?</h4><p>Higher highs and higher lows suggest an uptrend. Lower highs and lower lows suggest a downtrend. Neither guarantees the next move.</p><b>Quick check</b><small>Point to the last two highs and lows. Say “up,” “down,” or “sideways” and explain why.</small></article><article><span>STEP 2 · CANDLE READING</span><h4>Who controlled this period?</h4><p>The body shows open-to-close control. Wicks show rejection. Location matters: the same candle can mean something different at support, resistance, or mid-range.</p><b>Quick check</b><small>Name the body, upper wick and lower wick; then explain who gained control and where confirmation must appear.</small></article><article><span>STEP 3 · STRUCTURE + LEVELS</span><h4>Where can price react?</h4><p>Support is an area where buyers previously responded; resistance is where sellers responded. Treat both as zones—not perfect single-price lines.</p><b>Chart task</b><small>Draw two zones, count validated reactions, and identify the price that would invalidate each zone.</small></article><article><span>STEP 4 · CONFIRMATION</span><h4>Combine trend, averages and volume</h4><p>EMA/SMA structure describes trend and dynamic support. Volume measures participation, but volume never decides direction by itself.</p><b>Chart task</b><small>Compare price with EMA 20 and SMA 50, then ask whether volume, candle close and higher timeframe agree.</small></article><article><span>STEP 5 · PREDICT + REVEAL</span><h4>Choose before seeing the answer</h4><p>Select rise, fall, range, or insufficient evidence. Record probability, confirmation and invalidation before revealing the hidden future candles.</p><b>Scoring rule</b><small>A good answer is a well-supported probability—not merely guessing the final direction correctly.</small></article><article><span>STEP 6 · PROFESSIONAL DECISION</span><h4>Turn analysis into a controlled plan</h4><p>Write Observation → Evidence → Risk → Recommendation → Why → Invalidation → What to monitor.</p><b>Graduation check</b><small>Practice in the simulator, limit size from maximum loss, and review the journal later without changing the original thesis.</small></article></div><footer><b>Learning rule:</b> Begin with the interactive prediction lab below. Repeat scenarios until you can explain both the bullish and bearish case before seeing the result.</footer></section>
            <ChartPredictionLab />
            {academyWeek===4&&<section className="week-five-lab"><div className="candle-anatomy"><i/><b>HIGH</b><span>OPEN ↔ CLOSE BODY</span><b>LOW</b><i/><p>Wicks show rejection; the body shows open-to-close control. Meaning comes from timeframe, location, trend, volume and confirmation.</p></div><div className="candle-exam"><div><b>Week 5 · Eight-question mastery exam</b><span>{Object.keys(examAnswers).length}/8 answered · {candleExam.filter((q,i)=>examAnswers[i]===q[2]).length}/8 correct</span></div>{candleExam.map((q,i)=><fieldset key={q[0]}><legend>{i+1}. {q[0]}</legend>{q[1].map((answer,j)=><button key={answer} className={examAnswers[i]===j?(j===q[2]?"correct":"incorrect"):""} onClick={()=>setExamAnswers(x=>({...x,[i]:j}))}>{String.fromCharCode(65+j)}. {answer}</button>)}{examAnswers[i]!==undefined&&<small>{examAnswers[i]===q[2]?"Correct.":`Answer: ${String.fromCharCode(65+q[2])}.`} {q[1][q[2]]}</small>}</fieldset>)}<p><b>Mastery rule:</b> 7/8 plus one journaled chart example. Answers are revealed only after an attempt.</p></div></section>}
            <ScenarioGallery />
            <BuySellGuide />
            <AdvancedStudyChart />
            <AcademyLab week={academyWeek} onJournal={text=>{sessionStorage.setItem("northstar-journal-reflection",text);navigate("Journal")}} />
            <div className="academy-layout">
              <nav className="week-list" aria-label="Academy weeks">{academyWeeks.map((week,index)=><button key={week} className={academyWeek===index?"active":""} onClick={()=>{setAcademyWeek(index);setQuizChoice("")}}><i>{completedWeeks.includes(index)?"✓":index+1}</i><span><b>Week {index+1}</b><small>{week}</small></span></button>)}</nav>
              <article className="lesson-panel"><p className="kicker">WEEK {academyWeek+1} · GUIDED LESSON</p><h2>{academyWeeks[academyWeek]}</h2><div className="lesson-objectives"><b>Learning method</b><span>Simple explanation → professional language → practice → mini-exam → journal reflection.</span></div><div className="lesson-columns"><section><small>SIMPLE EXPLANATION</small><p>{academyLessons[academyWeek].simple}</p><b>Required reading</b><p>{academyLessons[academyWeek].reading}</p></section><section><small>PROFESSIONAL VIEW</small><p>{academyLessons[academyWeek].professional}</p><b>Decision standard</b><p>Document the evidence, timeframe, uncertainty, risk, and invalidation before acting.</p></section></div><div className="academy-assignment"><span><b>Week {academyWeek+1} practice</b>{academyLessons[academyWeek].assignment}</span><button onClick={()=>navigate("Market Intel")}>Open market desk</button></div><div className="practice-box"><b>Week {academyWeek+1} knowledge test</b><p>{academyLessons[academyWeek].question}</p>{academyLessons[academyWeek].options.map((answer,index)=><button key={answer} className={quizChoice===answer?(index===academyLessons[academyWeek].correct?"correct":"incorrect"):""} onClick={()=>setQuizChoice(answer)}>{String.fromCharCode(65+index)}. {answer}</button>)}{quizChoice&&<span>{academyLessons[academyWeek].options.indexOf(quizChoice)===academyLessons[academyWeek].correct?`Correct. ${academyLessons[academyWeek].professional}`:`Review Week ${academyWeek+1}, then try again. The correct answer must follow the lesson's decision rule.`}</span>}</div><div className="lesson-actions"><button onClick={()=>{sessionStorage.setItem("northstar-journal-reflection",`Academy Week ${academyWeek+1} — ${academyWeeks[academyWeek]}: `);navigate("Journal")}}>Add journal note</button><button className="primary" onClick={()=>setCompletedWeeks(current=>current.includes(academyWeek)?current:[...current,academyWeek])}>✓ Mark complete</button></div></article>
              <aside className="academy-rail"><div><p>LEVEL</p><b>{completedWeeks.length<5?"Foundation":completedWeeks.length<13?"Developing analyst":"Advanced practice"}</b></div><div><p>WEEKLY RHYTHM</p><span>Lesson · book · charts · news case · quiz · journal</span></div><div><p>READINESS RULE</p><span>Do not increase risk until position sizing and journal discipline are consistently demonstrated.</span></div></aside>
            </div>
          </section>
          <section className="learn-strip" id="learning">
            <div>
              <p>YOUR LEARNING PATH</p>
              <h2>Build skill before increasing risk</h2>
            </div>
            {modules.slice(0, 4).map((m, i) => (
              <span key={m}>
                <i>{i < 2 ? "✓" : i + 1}</i>
                <b>{m}</b>
                <small>{i < 2 ? "Complete" : "Next lesson"}</small>
              </span>
            ))}
            <button onClick={() => {setTab("Learn");notify("Learning progress will persist after authentication is configured.")}}>Continue →</button>
          </section>
          <footer>
            Educational decision support only—not financial advice. Market data
            in this prototype is illustrative. No strategy can guarantee profit.
          </footer>
        </section>
      </div>
    </main>
  );
}
