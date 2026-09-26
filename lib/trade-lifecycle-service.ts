import {contributionAction} from '@/lib/long-term-contribution';
import {investmentCash} from "@/lib/investment-cash";
import {detectPatternEvidence} from "@/lib/pattern-evidence";
import {reviewClosedTrades} from "@/lib/post-trade-review-service";
import type {DecisionOutput} from "@/lib/ai-investment-decision-engine";
import {reasonLifecycle} from "@/lib/ai-lifecycle-reasoning";
import type {AIProvider} from "@/lib/ai-provider";
import {measureCentralDecisionOutcomes} from "@/lib/ai-decision-outcomes";
import {sectorBenchmarkForIndustry} from "@/lib/sector-benchmark";
import { id, type PostgresDatabase } from "@/lib/db";
import { marketDataProvider } from "@/lib/providers/alpaca-market-data";
import { researchRecommendation as authoritativeRecommendation } from "@/lib/authoritative-recommendation";
import {loadLifecycleOption,underlyingForContract} from "@/lib/lifecycle-options";
import { STRATEGY_VERSION, sizeReentry, evaluatePosition, monitorReentry, makeReentry, evaluateOutcome, compareCapital, type PositionState, type Evidence, type AccountRisk, type Action, type ReentryPlan, type RotationCandidate } from "@/lib/trade-lifecycle";

// Legacy provider and JSONB rows are normalized into typed lifecycle contracts below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const json = <T=Row>(value: unknown): T => (typeof value === "string" ? JSON.parse(value) : value || {}) as T;
const avg = (values: number[]) => values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
const round = (n:number) => Math.round(n*100)/100;

/** Comparable target/stop scenarios are conservative estimates, not guaranteed returns. */
function rotationCandidate(row:Row,risk:AccountRisk):RotationCandidate|null{
  const c=json(row.checks_json),p=Number(c.technical?.price),target=Number(json(row.targets_json)?.[0])/100,stop=Number(row.invalidation_cents)/100;
  if(!p||!target||!stop||target<=p||stop>=p||risk.taxRate===null)return null;
  const estimate=c.aiEvidence?.returnEstimate;
  if(c.aiEvidence?.providerStatus!=="AVAILABLE"||!estimate||![estimate.expectedReturn,estimate.downside,estimate.price].every(Number.isFinite)||estimate.downside<=0)return null;
  return {ticker:row.ticker,horizonDays:estimate.horizonDays,modelVersion:c.aiEvidence.modelVersion,strategyVersion:c.aiEvidence.strategyVersion,expectedReturn:estimate.expectedReturn,downside:estimate.downside,costs:Math.max(0,estimate.expectedReturn)*risk.taxRate+risk.slippageBps/10000*2+risk.commission/Math.max(1,risk.cash),valuation:Number(c.fundamentalThesis?.valuationAttractiveness)>=55,technical:c.technical?.state==="BULLISH",fundamentals:["VALID","INTACT","STRONG"].includes(c.fundamentalThesis?.thesisStatus),accountFit:row.actionable===true,concentration:c.portfolioFit?.state==="GOOD",asOf:estimate.asOf};
}

async function event(db:PostgresDatabase, account:string, security:string, key:string, type:string, snapshot:unknown) {
  await db.prepare("INSERT INTO trade_lifecycle_events(id,account_id,security_id,event_key,event_type,snapshot_json) VALUES(?,?,?,?,?,?) ON CONFLICT(event_key) DO NOTHING").bind(id("lifecycle_event"),account,security,key,type,JSON.stringify(snapshot)).run();
}
async function alert(db:PostgresDatabase, household:string, account:string, key:string, title:string, detail:Record<string,unknown>={}) {
  const alertId=`lifecycle_${key}`;
  await db.prepare("INSERT INTO alerts(id,household_id,severity,type,title,explanation,evidence_json) VALUES(?,?,'important','trade_lifecycle',?,?,?) ON CONFLICT(id) DO NOTHING").bind(alertId,household,title,title,JSON.stringify({...detail,accountId:account,deepLink:`/workspace/daily-action-plan?accountId=${encodeURIComponent(account)}`})).run();
  const users = await db.prepare("SELECT hm.user_id,np.in_app_enabled,np.browser_push_enabled,np.email_enabled FROM household_members hm LEFT JOIN notification_preferences np ON np.household_id=hm.household_id AND np.user_id=hm.user_id WHERE hm.household_id=? AND hm.status='active'").bind(household).all<Row>();
  for (const user of users.results) for (const channel of [user.in_app_enabled!==false?"IN_APP":null,user.browser_push_enabled?"BROWSER_PUSH":null,user.email_enabled?"EMAIL":null].filter(Boolean)) await db.prepare("INSERT INTO alert_deliveries(id,alert_id,user_id,channel,status,available_at) VALUES(?,?,?,?,'QUEUED',CURRENT_TIMESTAMP) ON CONFLICT(alert_id,user_id,channel) DO NOTHING").bind(id("delivery"),alertId,user.user_id,channel).run();
  await db.prepare("INSERT INTO background_jobs(id,household_id,job_type,idempotency_key,payload_json) VALUES(?,?,'NOTIFICATION_DELIVERY',?,?) ON CONFLICT(idempotency_key) DO NOTHING").bind(id("job"),household,alertId,"{}").run();
}

/** Scheduled independently of holdings: historical SELL transactions and exit episodes remain in the universe. */
export async function runTradeLifecycle(db:PostgresDatabase, householdId:string, accountId:string, dependencies: {provider?:ReturnType<typeof marketDataProvider>;research?:typeof authoritativeRecommendation;symbol?:string;aiProvider?:AIProvider} = {}) {
  const account = await db.prepare(`SELECT a.id,COALESCE(s.strategy_type,a.investment_purpose) strategy,COALESCE(s.available_cash_cents,a.available_balance_cents,0)::text cash_cents,s.maximum_position_bps,s.maximum_risk_bps,s.goal_name,s.horizon_months,s.share_mode,s.policy_json FROM accounts a JOIN entities e ON e.id=a.entity_id LEFT JOIN investment_account_settings s ON s.account_id=a.id WHERE a.id=? AND e.household_id=?`).bind(accountId,householdId).first<Row>();
  if (!account) throw new Error("LIFECYCLE_ACCOUNT_NOT_FOUND");
  const cashMapping=await investmentCash(db,householdId,accountId);account.cash_cents=String(cashMapping.cashCents);
  const policy=json(account.policy_json), provider=dependencies.provider||marketDataProvider(), research=dependencies.research||authoritativeRecommendation;
  const universe = (await db.prepare(`SELECT DISTINCT sec.id security_id,sec.ticker,sec.type FROM securities sec WHERE sec.ticker IS NOT NULL AND sec.id IN (SELECT security_id FROM holdings WHERE account_id=? AND quantity>0 UNION SELECT security_id FROM position_states WHERE account_id=? UNION SELECT security_id FROM investment_transactions WHERE account_id=? AND transaction_type='SELL' UNION SELECT security_id FROM recommendations WHERE account_id=? AND lifecycle IN ('MONITORING','TRIGGERED')) AND (?::text IS NULL OR sec.ticker=?) ORDER BY sec.ticker`).bind(accountId,accountId,accountId,accountId,dependencies.symbol||null,dependencies.symbol||null).all<Row>()).results;
  const value = await db.prepare("SELECT COALESCE(SUM(quantity*price_cents),0)::text value FROM holdings WHERE account_id=?").bind(accountId).first<Row>();
  const risk: AccountRisk = {cash:Number(account.cash_cents)/100,value:Number(account.cash_cents)/100+(Number(value?.value||0)-cashMapping.mappedCents)/100,maxPositionBps:Number(account.maximum_position_bps??1000),maxRiskBps:Number(account.maximum_risk_bps??50),taxRate:policy.taxRatePct==null?null:Number(policy.taxRatePct)/100,slippageBps:Number(policy.slippageBps??15),commission:Number(policy.commissionCents??0)/100,reservedElsewhere:0};
  const allocationHoldings=(await db.prepare("SELECT s.ticker symbol,s.type,s.name,h.quantity*h.price_cents/100.0 value,h.price_cents/100.0 price FROM holdings h JOIN securities s ON s.id=h.security_id WHERE h.account_id=?").bind(accountId).all<Row>()).results.filter(h=>h.type!=='cash'&&!cashMapping.symbols.includes(h.symbol)).map(h=>({symbol:String(h.symbol),type:String(h.type),name:String(h.name),value:Number(h.value),price:Number(h.price)}));
  const allocationTargets=(await db.prepare("SELECT category,target_bps FROM account_allocation_targets WHERE account_id=?").bind(accountId).all<Row>()).results;
  const savedTargets=allocationTargets.length?Object.fromEntries(allocationTargets.map(t=>[t.category,Number(t.target_bps)])):undefined;
  let monitored=0;
  for (const security of universe) {
    if(security.type==="cash"||cashMapping.symbols.includes(security.ticker))continue;
    const underlying=underlyingForContract(security.ticker),isOption=Boolean(underlying)||/option/i.test(security.type),researchTicker=underlying||security.ticker;
    // Refresh research even when holdings are zero. A provider failure remains an explicit evidence gap.
    let researchError:string|null=null;
    try { await research(db,{householdId,accountId,symbol:researchTicker}); } catch(error) {researchError=error instanceof Error?error.message:"Research unavailable";}
    const rec=await db.prepare("SELECT r.* FROM recommendations r JOIN securities sec ON sec.id=r.security_id WHERE r.household_id=? AND r.account_id=? AND sec.ticker=? ORDER BY r.created_at DESC LIMIT 1").bind(householdId,accountId,researchTicker).first<Row>();
    const checks=json(rec?.checks_json), technical=checks.technical||{}, fund=checks.fundamentalThesis||{};
    const capacity=checks.portfolioFit||{};risk.cashReserveBps=Number(capacity.riskPolicy?.cashReserveBps??policy.tradingPolicy?.cashReserveBps??0);risk.sectorRoom=capacity.sectorRoomCents==null?null:Number(capacity.sectorRoomCents)/100;risk.remainingOpenRisk=capacity.remainingOpenRiskCents==null?null:Number(capacity.remainingOpenRiskCents)/100;risk.liquidityShares=capacity.liquidityShares??null;if(capacity.riskPolicy){risk.maxRiskBps=capacity.riskPolicy.swingRiskBps;risk.maxPositionBps=capacity.riskPolicy.maxPositionBps;}
    const thesis=await db.prepare("SELECT state,reviewed_at FROM investment_theses WHERE account_id=? AND security_id=?").bind(accountId,security.security_id).first<Row>();
    const holding=await db.prepare("SELECT COALESCE(SUM(quantity),0)::text shares,COALESCE(SUM(cost_basis_cents),0)::text basis,COUNT(*) FILTER(WHERE quantity>0 AND cost_basis_cents IS NULL)::int missing_basis FROM holdings WHERE account_id=? AND security_id=?").bind(accountId,security.security_id).first<Row>();
    const sectorBenchmark=policy.sectorBenchmarks?.[researchTicker]||sectorBenchmarkForIndustry(checks.company?.industry);
    const symbols=[researchTicker,"SPY",...(sectorBenchmark?[sectorBenchmark]:[])];
    const quotes=await provider.getQuotes(symbols);
    const bars=(await provider.getBars(researchTicker,{timeframe:"1Day",start:new Date(Date.now()-365*86400000).toISOString(),limit:250})).bars;
    const entryBars=isOption?[]:(await provider.getBars(researchTicker,{timeframe:"1Min",start:new Date(Date.now()-20*60000).toISOString(),limit:1000}).catch(()=>({bars:[]}))).bars;
    const option=isOption?await loadLifecycleOption(security.ticker):null;
    const quote=quotes.quotes[researchTicker], closes=bars.map(b=>b.close), price=isOption?(option?.premium||0)*100:Number(quote?.last||0), asOf=option?.asOf||quote?.timestamp||quotes.asOf;
    const atr=avg(bars.slice(-14).map((b,i,all)=>Math.max(b.high-b.low,Math.abs(b.high-(all[i-1]?.close??b.open)),Math.abs(b.low-(all[i-1]?.close??b.open)))));
    const market=quotes.quotes.SPY, sectorQuote=sectorBenchmark?quotes.quotes[sectorBenchmark]:null;
    const thesisStatus:PositionState["thesisStatus"]=thesis?.state==="BROKEN"||fund.thesisStatus==="BROKEN"?"BROKEN":(["STRONG","INTACT","VALID","CONSTRUCTIVE"].includes(thesis?.state)||["STRONG","INTACT","VALID","CONSTRUCTIVE"].includes(fund.thesisStatus))?"VALID":"RESEARCH_REQUIRED";
    const evidence:Evidence={asOf,complete:!researchError && !checks.freshness?.stale && Boolean(checks.freshness) && bars.length>=50,thesis:thesisStatus,price,support:Number(technical.support||Math.min(...bars.slice(-20).map(b=>b.low))),resistance:Number(technical.resistance||Math.max(...bars.slice(-40,-1).map(b=>b.high))),sma20:avg(closes.slice(-20)),sma50:avg(closes.slice(-50)),atr,volumeRatio:Number(technical.relativeVolume||0),relativeStrength:Number(quote?.changePct||0)-Number(market?.changePct||0),marketStrong:Boolean(market&&Number(market.changePct)>=0),sectorStrong:Boolean(sectorQuote&&Number(sectorQuote.changePct)>=0),newsClear:checks.news?.state!=="UNAVAILABLE" && checks.catalysts?.pass===true && technical.adverseNewsCount===0,valuationAttractive:Number(fund.valuationAttractiveness)>=55,majorValuationRisk:fund.valuationAttractiveness!=null&&Number(fund.valuationAttractiveness)<20,momentumBroken:technical.state==="BEARISH",goalChanged:policy.goalChanged===true,targetReached:false,sellConfirmations:[technical.state==="BEARISH",Number(technical.relativeVolume)>=1.5,Number(technical.threeDayReturnPct)<-4,Number(technical.adverseNewsCount)>0,fund.valuationAttractiveness!=null&&Number(fund.valuationAttractiveness)<20].filter(Boolean).length};
    if(isOption){
      const contracts=Number(holding?.shares||0),entryPremium=contracts?Number(holding?.basis||0)/100/contracts/100:0,entryIv=Number(policy.optionEntryIv?.[security.ticker]);
      evidence.complete=evidence.complete&&Boolean(option)&&Number.isFinite(entryIv);
      if(option)evidence.options={...option,entryPremium,entryIv,underlyingInvalid:Number(quote?.last||0)<evidence.support,catalystRisk:checks.catalysts?.pass!==true};
    }
    const tactical=await db.prepare("SELECT evidence_json,pullback_probability,expected_pullback_high_cents FROM tactical_rebuy_plans WHERE account_id=? AND security_id=? ORDER BY created_at DESC LIMIT 1").bind(accountId,security.security_id).first<Row>();
    if(tactical){const te=json(tactical.evidence_json);if(te.economicsPass){evidence.pullbackProbability=Number(tactical.pullback_probability)/100;evidence.expectedPullback=price-Number(tactical.expected_pullback_high_cents)/100;evidence.breakoutRisk=atr*2;evidence.sellConfirmations=Math.max(evidence.sellConfirmations,Number(te.sellEvidence||0));}}
    let reasoningSnapshot:{position:PositionState;action:Action}|null=null;
    const pendingAlerts:{key:string;text:string}[]=[];
    await db.transaction(async tx=>{
      // Account lock serializes reservations, execution matching and alert transitions across workers.
      await tx.prepare("SELECT id FROM accounts WHERE id=? FOR UPDATE").bind(accountId).first();
      const prior=await tx.prepare("SELECT state_json FROM position_states WHERE account_id=? AND security_id=? FOR UPDATE").bind(accountId,security.security_id).first<Row>();
      const previous:PositionState|undefined=prior?json(prior.state_json):undefined;
      const shares=Number(holding?.shares||0), basis=Number(holding?.basis||0)/100;
      const position:PositionState={entryPlan:previous&&shares<=previous.shares?previous.entryPlan:undefined,investmentAccountId:accountId,ticker:security.ticker,basisKnown:Number(holding?.missing_basis||0)===0,strategy:isOption?"OPTIONS":/SWING|MIXED|DAY.?TRADE|OPTIONS/i.test(account.strategy)?"SWING":"LONG_TERM",shares,averageCost:shares?basis/shares:previous?.averageCost||0,currentPrice:price,thesisStatus,positionState:shares?"OPEN":"CANDIDATE",recommendationId:rec?.id||null,sellReason:previous?.sellReason||null,exitPrice:previous?.exitPrice||null,exitDate:previous?.exitDate||null,proceeds:previous?.proceeds||0,reservedReentryCash:0,reentryLow:null,reentryHigh:null,reentryTrigger:null,reentryInvalidation:null,target1:previous?.target1??(Array.isArray(rec?.targets_json)?Number(rec.targets_json[0])/100||null:null),target2:previous?.target2||null,stop:previous?.stop??(Number(rec?.invalidation_cents)/100||null),lastAnalysisAt:new Date().toISOString(),strategyVersion:STRATEGY_VERSION,modelVersion:rec?.model_version||"lifecycle-rules-1"};
      const recent=entryBars.filter(b=>Date.parse(b.time)>=Date.now()-5*60000&&Date.parse(b.time)<=Date.now()),last=recent.at(-1),before=recent.at(-2);
      evidence.ask=Number(quote?.ask)||undefined;
      evidence.entryObservation={asOf,price,lowSinceSetup:recent.length>=2?Math.min(...entryBars.filter(b=>Date.parse(b.time)>=Date.now()-20*60000&&Date.parse(b.time)<=Date.now()).map(b=>b.low)):null,supportHeld:recent.length>=2&&recent.every(b=>b.low>Number(previous?.entryPlan?.cancelBelow??evidence.support-evidence.atr*.5)),sellingPressureWeakening:Boolean(last&&before&&last.close>before.close&&last.close>=last.open),reclaimed:price>=Number(previous?.entryPlan?.trigger??price)&&Boolean(last&&last.close>=Number(previous?.entryPlan?.trigger??price)),volumeConfirmed:evidence.volumeRatio>=1.2,newsClear:evidence.newsClear,thesisValid:thesisStatus==="VALID"};
      evidence.targetReached=Boolean(position.target1&&price>=position.target1);
      const sold=(await tx.prepare(`SELECT t.*,COALESCE((SELECT SUM(d.realized_pnl_cents) FROM tax_lot_disposals d WHERE d.sell_transaction_id=t.id),NULL)::text realized_pnl FROM investment_transactions t LEFT JOIN trade_lifecycle_exits x ON x.exit_transaction_id=t.id WHERE t.account_id=? AND t.security_id=? AND t.transaction_type='SELL' AND t.reverses_transaction_id IS NULL AND NOT EXISTS(SELECT 1 FROM investment_transactions reversal WHERE reversal.reverses_transaction_id=t.id) AND x.id IS NULL ORDER BY t.trade_at,t.id`).bind(accountId,security.security_id).all<Row>()).results;
      for(const trade of sold){
        const historical=await tx.prepare("SELECT * FROM recommendations WHERE account_id=? AND security_id=? AND action IN ('SELL','EXIT','REDUCE','TAKE_PARTIAL_PROFIT','THESIS_BROKEN') AND created_at<=? AND expires_at>=? ORDER BY created_at DESC LIMIT 1").bind(accountId,security.security_id,trade.trade_at,trade.trade_at).first<Row>();
        const audit:Action|undefined=historical?json(historical.lifecycle_audit_json):undefined;
        const exitPrice=Number(trade.price_cents)/100,quantity=Number(trade.quantity),gross=Math.abs(Number(trade.amount_cents))/100,fee=Number(trade.fee_cents||0)/100;
        const realized=trade.realized_pnl==null?null:Number(trade.realized_pnl)/100;
        const exit={price:exitPrice,shares:quantity,netProceeds:round(gross-fee-Math.max(0,realized??quantity*(exitPrice-position.averageCost))*(risk.taxRate??0)),basis:realized===null?position.averageCost*quantity:gross-realized,tradeAt:new Date(trade.trade_at).toISOString(),strategyVersion:historical?.strategy_version||STRATEGY_VERSION,modelVersion:historical?.model_version||"UNATTRIBUTED",basisKnown:realized!==null};
        const reason=historical?.sell_reason||null;
        // Unknown historical sells remain visible and incomplete rather than inventing a reason.
        let plan:ReentryPlan|null=null;
        if(reason && reason!=="THESIS BROKEN" && reason!=="GOAL/REBALANCE" && position.strategy!=="OPTIONS") {
          const basePlan=audit?.reentry;
          plan=basePlan?{...basePlan,reservedCash:Math.max(0,Math.min(exit.netProceeds,risk.cash)),status:"WATCH",expiresAt:new Date(new Date(trade.trade_at).getTime()+(position.strategy==="SWING"?14:90)*86400000).toISOString()}:makeReentry(position,evidence,risk,Math.max(0,Math.min(exit.netProceeds,risk.cash)),new Date(trade.trade_at).getTime());
        }
        const exitId=id("exit");
        await tx.prepare("INSERT INTO trade_lifecycle_exits(id,household_id,account_id,security_id,exit_transaction_id,recommendation_id,sell_reason,status,exit_json,plan_json,allocation_json) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(exit_transaction_id) DO NOTHING").bind(exitId,householdId,accountId,security.security_id,trade.id,historical?.id||null,reason,plan?"REENTRY_WATCH":reason?"CLOSED":"INCOMPLETE",JSON.stringify(exit),plan?JSON.stringify(plan):null,JSON.stringify({choice:plan?"REBUY SAME STOCK LATER":"HOLD CASH",reason:reason==="THESIS BROKEN"?"Research required before any new investment.":plan?"Reserved for confirmed reentry.":"Review sale classification and account capital allocation before redeployment."})).run();
        await event(tx,accountId,security.security_id,`sell:${trade.id}`,"EXIT",{trade,exit,reason,plan});
        if(historical)await tx.prepare("UPDATE recommendations SET lifecycle='COMPLETED' WHERE id=?").bind(historical.id).run();
        Object.assign(position,{exitPrice,exitDate:exit.tradeAt,proceeds:exit.netProceeds,sellReason:reason});
      }
      const episodes=(await tx.prepare("SELECT * FROM trade_lifecycle_exits WHERE account_id=? AND security_id=? ORDER BY created_at,id FOR UPDATE").bind(accountId,security.security_id).all<Row>()).results;
      const reserved=await tx.prepare("SELECT COALESCE(SUM(CASE WHEN status='ROTATION_READY' THEN (allocation_json->>'reservedCash')::numeric ELSE (plan_json->>'reservedCash')::numeric END),0)::text total FROM trade_lifecycle_exits WHERE account_id=? AND security_id<>? AND status IN ('REENTRY_WATCH','REENTRY_READY','ROTATION_READY')").bind(accountId,security.security_id).first<Row>();
      risk.reservedElsewhere=Number(reserved?.total||0);
      let reentryAction:Action|null=null;
      for(const episode of episodes){
        const exit=json<{price:number;shares:number;netProceeds:number;basis:number;tradeAt:string;basisKnown:boolean}>(episode.exit_json),plan:ReentryPlan|null=episode.plan_json?json(episode.plan_json):null;
        let rebuy=episode.rebuy_json?json<{transactionId:string;price:number;shares:number;cost:number}>(episode.rebuy_json):undefined;
        if(!rebuy && plan && ["REENTRY_WATCH","REENTRY_READY"].includes(episode.status)){
          const buy=await tx.prepare(`SELECT t.* FROM investment_transactions t WHERE t.account_id=? AND t.security_id=? AND t.transaction_type='BUY' AND t.trade_at>? AND t.reverses_transaction_id IS NULL AND NOT EXISTS(SELECT 1 FROM investment_transactions r WHERE r.reverses_transaction_id=t.id) AND NOT EXISTS(SELECT 1 FROM trade_lifecycle_exits x WHERE x.rebuy_json->>'transactionId'=t.id) ORDER BY t.trade_at,t.id LIMIT 1`).bind(accountId,security.security_id,exit.tradeAt).first<Row>();
          if(buy){rebuy={transactionId:buy.id,price:Number(buy.price_cents)/100,shares:Number(buy.quantity),cost:(Math.abs(Number(buy.amount_cents))+Number(buy.fee_cents||0))/100};plan.status="REENTERED";plan.reservedCash=0;await event(tx,accountId,security.security_id,`rebuy:${buy.id}`,"REENTER",rebuy);await tx.prepare("UPDATE trade_lifecycle_exits SET status='REENTERED',rebuy_json=?,plan_json=? WHERE id=?").bind(JSON.stringify(rebuy),JSON.stringify(plan),episode.id).run();position.positionState="REENTER";}
        }
        if(plan && !rebuy && !["ROTATION_READY","ROTATED"].includes(episode.status)){
          plan.reservedCash=Math.max(0,Math.min(plan.reservedCash,risk.cash-risk.reservedElsewhere));
          const monitored=monitorReentry(plan,position,evidence,risk),status=monitored.plan.status;
          const candidateRows=(await tx.prepare("SELECT DISTINCT ON (r.security_id) r.*,s.ticker FROM recommendations r JOIN securities s ON s.id=r.security_id WHERE r.account_id=? AND r.actionable=TRUE AND r.action IN ('BUY','ACCUMULATE','STRONG_BUY','BUY_PARTIAL') AND r.expires_at>CURRENT_TIMESTAMP ORDER BY r.security_id,r.created_at DESC").bind(accountId).all<Row>()).results;
          const candidates:RotationCandidate[]=candidateRows.map(row=>rotationCandidate(row,risk)).filter((v):v is RotationCandidate=>v!==null);
          const originalRow=await tx.prepare("SELECT * FROM recommendations WHERE account_id=? AND security_id=? AND checks_json->'aiEvidence'->'returnEstimate' IS NOT NULL AND expires_at>CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1").bind(accountId,security.security_id).first<Row>();
          const original=originalRow?rotationCandidate({...originalRow,ticker:security.ticker,actionable:evidence.thesis==="VALID"},risk):null;
          const allocation:Row=["WATCH","READY"].includes(status)?compareCapital(Number(policy.cashExpectedReturn||0),original,candidates):{choice:"HOLD CASH",ticker:null,reason:monitored.plan.reason};
          if(allocation.choice==="ROTATE"){
            const candidate=candidateRows.find(r=>r.ticker===allocation.ticker),c=json(candidate?.checks_json),entry=Number(c.technical?.price),stop=Number(candidate?.invalidation_cents)/100;
            const held=await tx.prepare("SELECT COALESCE(SUM(quantity),0)::text shares FROM holdings h JOIN securities s ON s.id=h.security_id WHERE h.account_id=? AND s.ticker=?").bind(accountId,allocation.ticker).first<Row>();
            const budget=Math.min(plan.reservedCash,Math.max(0,risk.cash-risk.reservedElsewhere)),quantity=sizeReentry(budget,entry,stop,{...position,ticker:allocation.ticker,shares:Number(held?.shares||0)},risk);
            if(!quantity)Object.assign(allocation,{choice:"REBUY SAME STOCK LATER",ticker:security.ticker,reason:"Replacement does not fit reserved cash, concentration or risk limits."});
            else Object.assign(allocation,{shares:quantity,price:entry,stop,targets:json(candidate?.targets_json),reservedCash:budget,cost:round(quantity*entry*(1+risk.slippageBps/10000)+risk.commission),cashBefore:risk.cash,cashAfter:round(risk.cash-quantity*entry*(1+risk.slippageBps/10000)-risk.commission),expiresAt:plan.expiresAt,proposedAt:new Date().toISOString()});
          }
          if(allocation.choice==="ROTATE" && status!=="CANCELLED") {monitored.plan.status="CANCELLED";monitored.plan.reservedCash=0;monitored.plan.reason=`Reserve released for reviewed rotation into ${allocation.ticker}.`}
          const nextStatus=allocation.choice==="ROTATE"?"ROTATION_READY":status==="READY"?"REENTRY_READY":status==="WATCH"?"REENTRY_WATCH":"CLOSED";
          await tx.prepare("UPDATE trade_lifecycle_exits SET status=?,plan_json=?,allocation_json=?,last_analysis_at=CURRENT_TIMESTAMP WHERE id=?").bind(nextStatus,JSON.stringify(monitored.plan),JSON.stringify(allocation.choice==="HOLD CASH"&&status==="WATCH"?{...allocation,choice:"REBUY SAME STOCK LATER",reason:plan.reason}:allocation),episode.id).run();
          if(episode.status!==nextStatus)await event(tx,accountId,security.security_id,`${episode.id}:${nextStatus}:${asOf}`,nextStatus,monitored);
          if(monitored.shares>0 && nextStatus==="REENTRY_READY")pendingAlerts.push({key:`${episode.id}:${monitored.plan.mode}:ready`,text:monitored.alert||`${position.ticker} REENTRY READY — Buy ${monitored.shares} shares at or below $${price.toFixed(2)}. Estimated cost $${(monitored.shares*price).toFixed(2)}. Cash after $${(risk.cash-monitored.shares*price).toFixed(2)}.`});
          if(nextStatus==="ROTATION_READY" && episode.status!==nextStatus)await alert(tx,householdId,accountId,`${episode.id}:rotate`,`${security.ticker}: compare rotation into ${allocation.ticker}; ${allocation.reason}`);
          if(["REENTRY_WATCH","REENTRY_READY"].includes(nextStatus)){
            position.positionState=nextStatus as PositionState["positionState"];
            Object.assign(position,{reservedReentryCash:position.reservedReentryCash+monitored.plan.reservedCash,reentryLow:plan.low,reentryHigh:plan.high,reentryTrigger:plan.trigger,reentryInvalidation:plan.invalidation});
            risk.reservedElsewhere+=monitored.plan.reservedCash;
            const cost=monitored.shares?round(monitored.shares*price*(1+risk.slippageBps/10000)+risk.commission):0;
            reentryAction={...evaluatePosition(position,evidence,risk),action:"REBUY IF",shares:monitored.shares,price:monitored.price,cost,cashAfter:round(risk.cash-cost),reentry:{...monitored.plan,estimatedShares:monitored.shares},reason:monitored.plan.trigger,allocation:"REBUY SAME STOCK LATER",pipeline:evidence.complete&&evidence.sectorStrong&&evidence.newsClear?"COMPLETE":"INCOMPLETE"};
          } else if(!shares) position.positionState="CLOSED";
        }
        let rotation=episode.rotation_json?json(episode.rotation_json):undefined,rotationValue:number|undefined;
        if(["ROTATION_READY","ROTATED"].includes(episode.status)){
          const allocation=json(episode.allocation_json);
          if(episode.status==="ROTATION_READY"&&Date.parse(allocation.expiresAt)<=Date.now()){
            await tx.prepare("UPDATE trade_lifecycle_exits SET status='CLOSED',allocation_json=? WHERE id=?").bind(JSON.stringify({...allocation,choice:"HOLD CASH",reservedCash:0,reason:"Rotation window expired before execution; reassess opportunities."}),episode.id).run();
            continue;
          }
          if(!rotation){
            const fill=await tx.prepare("SELECT t.* FROM investment_transactions t JOIN securities s ON s.id=t.security_id WHERE t.account_id=? AND s.ticker=? AND t.transaction_type='BUY' AND t.trade_at>? AND t.reverses_transaction_id IS NULL AND NOT EXISTS(SELECT 1 FROM investment_transactions v WHERE v.reverses_transaction_id=t.id) AND NOT EXISTS(SELECT 1 FROM trade_lifecycle_exits x WHERE x.rotation_json->>'transactionId'=t.id OR x.rebuy_json->>'transactionId'=t.id) ORDER BY t.trade_at,t.id LIMIT 1").bind(accountId,allocation.ticker,exit.tradeAt).first<Row>();
            if(fill){rotation={ticker:allocation.ticker,transactionId:fill.id,shares:Number(fill.quantity),cost:(Math.abs(Number(fill.amount_cents))+Number(fill.fee_cents||0))/100};await tx.prepare("UPDATE trade_lifecycle_exits SET status='ROTATED',rotation_json=?,allocation_json=? WHERE id=?").bind(JSON.stringify(rotation),JSON.stringify({...allocation,reservedCash:0}),episode.id).run();await event(tx,accountId,security.security_id,`rotation:${fill.id}`,"ROTATED",rotation);}
          }
          if(rotation){const mark=await provider.getQuotes([rotation.ticker]),q=mark.quotes[rotation.ticker];if(q?.last)rotationValue=rotation.shares*Number(q.last)+exit.netProceeds-rotation.cost;}
        }
        const post=isOption?[]:bars.filter(b=>new Date(b.time).getTime()>Date.parse(exit.tradeAt)),priorOutcome=json(episode.outcome_json);
        const prices=[...post.flatMap(b=>[b.high,b.low]),...(priorOutcome.high?[priorOutcome.high,priorOutcome.low]:[]),price].filter(x=>x>0);
        const outcome={...evaluateOutcome(exit,prices,rebuy,rotationValue),high:Math.max(exit.price,...prices),low:Math.min(exit.price,...prices),sellReason:episode.sell_reason,asOf,basisKnown:exit.basisKnown};
        await tx.prepare("UPDATE trade_lifecycle_exits SET outcome_json=?,last_analysis_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(outcome),episode.id).run();
      }
      if(thesisStatus==="BROKEN"&&!shares)position.positionState="CLOSED";
      const review=await tx.prepare("SELECT evidence_json FROM trade_lifecycle_reviews WHERE account_id=? AND strategy_version=? AND status='APPROVED' ORDER BY created_at DESC LIMIT 1").bind(accountId,STRATEGY_VERSION).first<Row>();
      const measured=await tx.prepare("SELECT COUNT(*)::int samples,COALESCE(SUM((outcome_json->>'excessVsHold')::numeric),0)::text excess,COUNT(*) FILTER(WHERE (outcome_json->>'excessVsHold')::numeric>0)::int wins FROM trade_lifecycle_exits WHERE account_id=? AND sell_reason='TACTICAL SELL FOR EXPECTED PULLBACK' AND status IN ('REENTERED','CLOSED','ROTATED') AND outcome_json->>'excessVsHold' IS NOT NULL").bind(accountId).first<Row>();
      const underperform=Number(measured?.samples)>=5&&Number(measured?.excess)<0&&Number(measured?.wins)/Number(measured?.samples)<.4;
      const penalty=Math.max(underperform?100:0,Math.max(0,Math.min(300,Number(json(review?.evidence_json).tacticalPenaltyBps||0))));
      if(underperform)await tx.prepare("INSERT INTO trade_lifecycle_reviews(id,household_id,account_id,strategy_version,status,evidence_json) VALUES(?,?,?,?,'SAFETY_GATE_APPLIED',?) ON CONFLICT(id) DO NOTHING").bind(`tactical_gate:${accountId}:${STRATEGY_VERSION}:${measured?.samples}`,householdId,accountId,STRATEGY_VERSION,JSON.stringify({...measured,tacticalPenaltyBps:100,policy:"Versioned conservative gate; no model fitting or production parameter mutation. Further changes require review."})).run();
      let action=reentryAction||evaluatePosition(position,evidence,risk,Date.now(),penalty);
      if(position.strategy==='LONG_TERM'&&!reentryAction)action=contributionAction({account:{strategy:account.strategy,goal:account.goal_name||'',horizonMonths:Number(account.horizon_months),fractional:account.share_mode==='FRACTIONAL'},holdings:allocationHoldings,targets:savedTargets,security:{symbol:security.ticker,type:security.type},position,evidence,risk,previous:action});
      if(!reentryAction && action.action==="HOLD")position.positionState=shares?"HOLD":position.positionState;
      if(!reentryAction && action.action==="TRIM")position.positionState="TRIM";
      // Proposed trades never mutate holdings, cash, or executed exit history.
      await tx.prepare("INSERT INTO position_states(account_id,security_id,household_id,state_json,action_json) VALUES(?,?,?,?,?) ON CONFLICT(account_id,security_id) DO UPDATE SET state_json=EXCLUDED.state_json,action_json=EXCLUDED.action_json,last_analysis_at=CURRENT_TIMESTAMP").bind(accountId,security.security_id,householdId,JSON.stringify(position),JSON.stringify(action)).run();
      reasoningSnapshot={position,action};
      await event(tx,accountId,security.security_id,`analysis:${security.security_id}:${accountId}:${asOf}`,"ANALYSIS",{position,action,evidence,researchError});
    });
    if(reasoningSnapshot){
      const snapshot=reasoningSnapshot as {position:PositionState;action:Action};
      checks.patterns=detectPatternEvidence(bars.filter(b=>Date.parse(b.time)+86400000<=Date.now()),{timeframe:"1Day",market:market?(evidence.marketStrong?"UP":"DOWN"):undefined,sector:sectorQuote?(evidence.sectorStrong?"UP":"DOWN"):undefined,newsClear:evidence.newsClear,fundamentalsValid:thesisStatus==="VALID",riskApproved:false,dataFresh:evidence.complete});
      const decision=await reasonLifecycle(db,householdId,security.security_id,snapshot.position,snapshot.action,evidence,risk,{checks,fundamentals:fund,fundamentalAsOf:checks.sources?.fundamental?.asOf||fund.dataTimestamp,newsAsOf:checks.sources?.news?.asOf,news:checks.news?.state==='UNAVAILABLE'?null:checks.news,valuation:checks.valuation?.state==='UNAVAILABLE'?null:checks.valuation||{score:fund.valuationAttractiveness},technical:checks.technical,marketRegime:market?{market,sector:sectorQuote,sectorStatus:sectorQuote?'AVAILABLE':'UNAVAILABLE'}:null,accountPolicy:{...policy,strategy:account.strategy,goal:account.goal_name,horizonMonths:account.horizon_months,targetAllocation:savedTargets},researchComplete:evidence.complete},dependencies.aiProvider);
      if(decision.providerStatus==='AVAILABLE'&&decision.action==='REBUY_IF')for(const notification of pendingAlerts)await db.transaction(tx=>alert(tx,householdId,accountId,notification.key,decision.entryPlan?positionAlert(decision,snapshot.position):notification.text,{ticker:snapshot.position.ticker,recommendationId:decision.decisionId,decisionId:decision.decisionId,asOf:decision.dataTimestamp}));
    }
    if(!isOption)await measureCentralDecisionOutcomes(db,accountId,security.ticker,bars);
    await reviewClosedTrades(db,accountId,security.security_id,isOption?[]:bars);
    monitored++;
  }
  return {monitored};
}

export async function lifecycleAccountView(db:PostgresDatabase,householdId:string,accountId:string){
  const positions=(await db.prepare("SELECT state_json,action_json,last_analysis_at FROM position_states WHERE household_id=? AND account_id=? ORDER BY last_analysis_at DESC").bind(householdId,accountId).all<Row>()).results.map(r=>({state:json(r.state_json),action:json(r.action_json),lastAnalysisAt:r.last_analysis_at}));
  const exits=(await db.prepare("SELECT x.*,s.ticker FROM trade_lifecycle_exits x JOIN securities s ON s.id=x.security_id WHERE x.household_id=? AND x.account_id=? ORDER BY x.created_at DESC").bind(householdId,accountId).all<Row>()).results;
  const audits=(await db.prepare("SELECT r.id,s.ticker,r.reason,r.sell_reason,r.pipeline_status,r.lifecycle_audit_json,r.checks_json FROM recommendations r JOIN securities s ON s.id=r.security_id WHERE r.household_id=? AND r.account_id=? AND r.action IN ('SELL','EXIT','REDUCE','TAKE_PARTIAL_PROFIT','THESIS_BROKEN') ORDER BY r.created_at DESC LIMIT 100").bind(householdId,accountId).all<Row>()).results;
  const priority:Record<string,number>={SELL:0,TRIM:1,"REBUY IF":2,ADD:3,"BUY NOW":4,"BUY IF":5,HOLD:6,"NO ACTION":7};
  // Allocate today's spend sequentially across tickers; proposed sales do not finance purchases.
  let available=Math.max(0,(positions[0]?.action.cashBefore||0)-positions.reduce((sum,p)=>sum+Number(p.state.reservedReentryCash||0),0));
  const actions=positions.sort((a,b)=>(priority[a.action.action]??8)-(priority[b.action.action]??8)).map(p=>{const action={...p.action};if(["ADD","BUY NOW"].includes(action.action)){if(action.cost>available){action.action="BUY IF";action.shares=0;action.cost=0;action.reason="Wait for account cash after existing reservations and higher priority actions.";}else available-=action.cost;}return {...p,action};});
  const outcomesByReason=Object.entries(Object.groupBy(exits,x=>x.sell_reason||"UNCLASSIFIED")).map(([reason,rows])=>({reason,decisions:rows!.length,excessVsHold:round(rows!.reduce((sum,r)=>sum+Number(json(r.outcome_json).excessVsHold||0),0)),reentries:rows!.filter(r=>r.status==="REENTERED").length,rotations:rows!.filter(r=>r.status==="ROTATED").length}));
  const reviews=(await db.prepare("SELECT p.review_json,s.ticker FROM post_trade_reviews p JOIN trade_lifecycle_exits x ON x.id=p.exit_id JOIN securities s ON s.id=x.security_id WHERE x.household_id=? AND x.account_id=? ORDER BY p.updated_at DESC").bind(householdId,accountId).all()).results;
  return {reviews,positions,actions:actions.slice(0,5),exits,audits,outcomesByReason,cashDeployment:exits.map(x=>({ticker:x.ticker,status:x.status,plan:json(x.plan_json),allocation:json(x.allocation_json)})),unreservedCash:available,cashReason:"Unreserved cash waits for a fresh thesis, attractive valuation, confirmed setup and account risk capacity; proposed sale proceeds are not spendable until execution sync.",pipeline:!positions.length||audits.some(x=>x.pipeline_status!=="COMPLETE")||positions.some(x=>x.action.pipeline!=="COMPLETE")?"INCOMPLETE":"COMPLETE"};
}

function positionAlert(d:DecisionOutput,p:PositionState){return p.ticker+" — REENTRY READY — "+p.investmentAccountId+". Trigger $"+d.entryPlan?.trigger+" confirmed. Proposed "+d.shares+" shares; order "+d.entryPlan?.orderType+" limit $"+d.entryPlan?.orderPrice+". Cost $"+d.expectedCostProceeds+". Cash after $"+d.cashAfter+". Cancel if confirmation fails. User confirmation required.";}
