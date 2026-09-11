import { id, type PostgresDatabase, workspace } from "@/lib/db";
import { formatQuantity, parseInvestmentTransaction, parseQuantity, quantityPriceAmount, quantityScale } from "@/lib/domain/investment-ledger";
import {allocationCategories,classifyHolding} from "@/lib/domain/portfolio";

export const dynamic = "force-dynamic";

type AccountRow = { id:string; investment_purpose:string|null; share_mode:"WHOLE"|"FRACTIONAL"; available_cash_cents:string };
type LotRow = { id:string; remaining_quantity:string; remaining_basis_cents:string };

const defaultStrategy = (purpose:string|null) => /swing|option/i.test(purpose||"")
  ? "SWING"
  : /retirement|401|ira/i.test(purpose||"")
    ? "RETIREMENT"
    : /dividend|income/i.test(purpose||"")
      ? "DIVIDEND_INCOME"
      : "GROWTH_5_7";

async function ownedAccount(db:PostgresDatabase,householdId:string,accountId:string,lock=false){
  return db.prepare(`SELECT a.id,a.investment_purpose,COALESCE(s.share_mode,'WHOLE') share_mode,COALESCE(s.available_cash_cents,0) available_cash_cents
    FROM accounts a JOIN entities e ON e.id=a.entity_id LEFT JOIN investment_account_settings s ON s.account_id=a.id
    WHERE a.id=? AND e.household_id=? AND a.type='investment' ${lock?"FOR UPDATE OF a":""}`).bind(accountId,householdId).first<AccountRow>();
}

async function persistPortfolioSnapshot(db:PostgresDatabase,householdId:string,accountId:string,capturedAt:string){
  const[rows,settings,realized]=await Promise.all([db.prepare("SELECT h.quantity::text,h.price_cents::text,h.cost_basis_cents::text,s.ticker,s.name,s.type FROM holdings h JOIN securities s ON s.id=h.security_id WHERE h.account_id=? AND h.quantity>0").bind(accountId).all<any>(),db.prepare("SELECT COALESCE(available_cash_cents,0)::text cash FROM investment_account_settings WHERE account_id=?").bind(accountId).first<{cash:string}>(),db.prepare("SELECT COALESCE(SUM(d.realized_pnl_cents),0)::text total FROM tax_lot_disposals d JOIN investment_transactions t ON t.id=d.sell_transaction_id WHERE t.account_id=?").bind(accountId).first<{total:string}>()]);
  const allocation=Object.fromEntries(allocationCategories.map(category=>[category,"0"]))as Record<string,string>;let market=0n,cost=0n;for(const row of rows.results){const value=quantityPriceAmount(parseQuantity(row.quantity),BigInt(row.price_cents||0)),basis=BigInt(row.cost_basis_cents||0),category=classifyHolding({securityType:row.type,name:row.name,ticker:row.ticker});market+=value;cost+=basis;allocation[category]=(BigInt(allocation[category])+value).toString()}const cash=BigInt(settings?.cash||0);allocation.CASH=(BigInt(allocation.CASH)+cash).toString();
  await db.prepare("INSERT INTO portfolio_snapshots(id,household_id,account_id,captured_at,market_value_cents,cash_cents,cost_basis_cents,realized_pnl_cents,unrealized_pnl_cents,allocation_json,source_freshness_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(id("portfolio_snapshot"),householdId,accountId,capturedAt,market.toString(),cash.toString(),cost.toString(),realized?.total||"0",(market-cost).toString(),JSON.stringify(allocation),JSON.stringify({kind:"transaction_refresh",prices:"stored",asOf:capturedAt})).run();
}

export async function GET(request:Request){
  try{
    const{db,householdId}=await workspace(request),url=new URL(request.url),accountId=url.searchParams.get("accountId");
    if(accountId&&!await ownedAccount(db,householdId,accountId))return Response.json({error:"Investment account not found"},{status:404});
    const rows=await db.prepare(`SELECT t.id,t.account_id,t.transaction_type,t.trade_at,t.settle_at,t.quantity::text,t.price_cents,t.amount_cents,t.fee_cents,t.currency,t.source,t.notes,t.created_at,s.ticker,s.name
      FROM investment_transactions t LEFT JOIN securities s ON s.id=t.security_id JOIN accounts a ON a.id=t.account_id JOIN entities e ON e.id=a.entity_id
      WHERE e.household_id=? AND (? IS NULL OR t.account_id=?) ORDER BY t.trade_at DESC,t.created_at DESC LIMIT 1000`).bind(householdId,accountId,accountId).all();
    return Response.json({transactions:rows.results},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Investment transactions unavailable"},{status:500})}
}

export async function POST(request:Request){
  try{
    const{db,householdId,userId}=await workspace(request),body=await request.json() as Record<string,unknown>,accountId=String(body.accountId||"");
    if(!accountId)return Response.json({error:"accountId is required"},{status:400});
    const result=await db.transaction(async tx=>{
      let account=await ownedAccount(tx,householdId,accountId,true);
      if(!account)throw new Error("Investment account not found");
      await tx.prepare(`INSERT INTO investment_account_settings(account_id,strategy_type,share_mode,goal_name,risk_profile)
        VALUES(?,?,'WHOLE',?,'BALANCED') ON CONFLICT(account_id) DO NOTHING`).bind(accountId,defaultStrategy(account.investment_purpose),account.investment_purpose||"Long-term growth").run();
      account=await ownedAccount(tx,householdId,accountId,true);
      if(!account)throw new Error("Investment account not found");
      const parsed=parseInvestmentTransaction(body,account.share_mode),transactionId=id("itxn");
      let securityId:string|null=null;
      if(parsed.symbol){
        const security=await tx.prepare(`INSERT INTO securities(id,ticker,name,type,currency) VALUES(?,?,?,'stock','USD')
          ON CONFLICT(ticker,type) DO UPDATE SET name=CASE WHEN excluded.name='' THEN securities.name ELSE excluded.name END RETURNING id`)
          .bind(id("security"),parsed.symbol,parsed.securityName||parsed.symbol).first<{id:string}>();
        securityId=security?.id||null;
      }
      const cashBefore=BigInt(account.available_cash_cents||0),gross=parsed.amountCents,fee=parsed.feeCents;
      let cashDelta=0n;
      if(parsed.transactionType==="BUY")cashDelta=-(gross+fee);
      else if(parsed.transactionType==="SELL")cashDelta=gross-fee;
      else if(["DIVIDEND","DEPOSIT","INTEREST"].includes(parsed.transactionType))cashDelta=gross;
      else if(["WITHDRAWAL","FEE","TRANSFER"].includes(parsed.transactionType))cashDelta=-gross;
      if(cashBefore+cashDelta<0n)throw new Error(`Insufficient account cash. Available $${(Number(cashBefore)/100).toFixed(2)}; transaction requires $${(Number(-cashDelta)/100).toFixed(2)}.`);
      if(parsed.transactionType==="TRANSFER"){
        if(!parsed.transferAccountId||parsed.transferAccountId===accountId)throw new Error("A different destination investment account is required");
        const destination=await ownedAccount(tx,householdId,parsed.transferAccountId,true);if(!destination)throw new Error("Destination investment account not found");
        await tx.prepare(`INSERT INTO investment_account_settings(account_id,strategy_type,share_mode,goal_name,risk_profile)
          VALUES(?,?,'WHOLE',?,'BALANCED') ON CONFLICT(account_id) DO NOTHING`).bind(destination.id,defaultStrategy(destination.investment_purpose),destination.investment_purpose||"Long-term growth").run();
        await tx.prepare("UPDATE investment_account_settings SET available_cash_cents=available_cash_cents+?,updated_at=CURRENT_TIMESTAMP WHERE account_id=?").bind(gross.toString(),destination.id).run();
      }
      await tx.prepare(`INSERT INTO investment_transactions(id,household_id,account_id,security_id,transaction_type,trade_at,settle_at,quantity,price_cents,amount_cents,fee_cents,currency,source,transfer_account_id,split_numerator,split_denominator,notes,created_by_user_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,'USD','MANUAL',?,?,?,?,?)`).bind(transactionId,householdId,accountId,securityId,parsed.transactionType,parsed.tradeAt,parsed.settleAt,parsed.quantityText,parsed.priceCents?.toString()||null,gross.toString(),fee.toString(),parsed.transferAccountId,parsed.splitNumerator,parsed.splitDenominator,parsed.notes,userId).run();
      if(cashDelta!==0n)await tx.prepare("UPDATE investment_account_settings SET available_cash_cents=available_cash_cents+?,updated_at=CURRENT_TIMESTAMP WHERE account_id=?").bind(cashDelta.toString(),accountId).run();
      if(parsed.transactionType==="BUY"&&securityId&&parsed.quantity&&parsed.priceCents){
        const totalBasis=gross+fee;
        await tx.prepare(`INSERT INTO tax_lots(id,account_id,security_id,opening_transaction_id,acquired_at,original_quantity,remaining_quantity,total_basis_cents,remaining_basis_cents)
          VALUES(?,?,?,?,?,?,?,?,?)`).bind(id("lot"),accountId,securityId,transactionId,parsed.tradeAt,parsed.quantityText,parsed.quantityText,totalBasis.toString(),totalBasis.toString()).run();
        await tx.prepare(`INSERT INTO holdings(id,account_id,security_id,quantity,cost_basis_cents,price_cents,price_at) VALUES(?,?,?,?,?,?,?)
          ON CONFLICT(account_id,security_id) DO UPDATE SET quantity=holdings.quantity+excluded.quantity,cost_basis_cents=COALESCE(holdings.cost_basis_cents,0)+excluded.cost_basis_cents,price_cents=excluded.price_cents,price_at=excluded.price_at`)
          .bind(id("holding"),accountId,securityId,parsed.quantityText,totalBasis.toString(),parsed.priceCents.toString(),parsed.tradeAt).run();
      }
      if(parsed.transactionType==="SELL"&&securityId&&parsed.quantity&&parsed.priceCents){
        const lots=(await tx.prepare(`SELECT id,remaining_quantity::text,remaining_basis_cents::text FROM tax_lots
          WHERE account_id=? AND security_id=? AND remaining_quantity>0 ORDER BY acquired_at,id FOR UPDATE`).bind(accountId,securityId).all<LotRow>()).results;
        const available=lots.reduce((sum,lot)=>sum+parseQuantity(lot.remaining_quantity),0n);
        if(available<parsed.quantity)throw new Error(`Cannot sell ${parsed.quantityText} shares; recorded tax lots contain ${formatQuantity(available)}.`);
        let remaining=parsed.quantity,allocatedProceeds=0n,allocatedBasis=0n;
        for(const lot of lots){
          if(remaining===0n)break;
          const lotQuantity=parseQuantity(lot.remaining_quantity),dispose=remaining<lotQuantity?remaining:lotQuantity,lotBasis=BigInt(lot.remaining_basis_cents),basis=dispose===lotQuantity?lotBasis:(lotBasis*dispose+lotQuantity/2n)/lotQuantity,proceeds=(gross*dispose+parsed.quantity/2n)/parsed.quantity;
          allocatedProceeds+=proceeds;allocatedBasis+=basis;
          await tx.prepare("UPDATE tax_lots SET remaining_quantity=remaining_quantity-?::numeric,remaining_basis_cents=remaining_basis_cents-? WHERE id=?").bind(formatQuantity(dispose),basis.toString(),lot.id).run();
          await tx.prepare(`INSERT INTO tax_lot_disposals(id,lot_id,sell_transaction_id,quantity,basis_cents,proceeds_cents,realized_pnl_cents,disposed_at)
            VALUES(?,?,?,?,?,?,?,?)`).bind(id("disposal"),lot.id,transactionId,formatQuantity(dispose),basis.toString(),proceeds.toString(),(proceeds-basis).toString(),parsed.tradeAt).run();
          remaining-=dispose;
        }
        await tx.prepare(`UPDATE holdings SET quantity=quantity-?::numeric,cost_basis_cents=GREATEST(0,COALESCE(cost_basis_cents,0)-?),price_cents=?,price_at=?
          WHERE account_id=? AND security_id=?`).bind(parsed.quantityText,allocatedBasis.toString(),parsed.priceCents.toString(),parsed.tradeAt,accountId,securityId).run();
        if(allocatedProceeds!==gross)await tx.prepare("UPDATE tax_lot_disposals SET proceeds_cents=proceeds_cents+?,realized_pnl_cents=realized_pnl_cents+? WHERE sell_transaction_id=? AND id=(SELECT id FROM tax_lot_disposals WHERE sell_transaction_id=? ORDER BY id LIMIT 1)").bind((gross-allocatedProceeds).toString(),(gross-allocatedProceeds).toString(),transactionId,transactionId).run();
      }
      if(parsed.transactionType==="SPLIT"&&securityId&&parsed.splitNumerator&&parsed.splitDenominator){
        await tx.prepare("UPDATE tax_lots SET original_quantity=original_quantity*?::numeric/?::numeric,remaining_quantity=remaining_quantity*?::numeric/?::numeric WHERE account_id=? AND security_id=?").bind(parsed.splitNumerator,parsed.splitDenominator,parsed.splitNumerator,parsed.splitDenominator,accountId,securityId).run();
        await tx.prepare("UPDATE holdings SET quantity=quantity*?::numeric/?::numeric WHERE account_id=? AND security_id=?").bind(parsed.splitNumerator,parsed.splitDenominator,accountId,securityId).run();
      }
      await tx.prepare("INSERT INTO audit_log(id,household_id,user_id,action,target_type,target_id,metadata_json) VALUES(?,?,?,?,?,?,?)").bind(id("audit"),householdId,userId,"investment_transaction.created","investment_transaction",transactionId,JSON.stringify({accountId,type:parsed.transactionType,symbol:parsed.symbol})).run();
      await persistPortfolioSnapshot(tx,householdId,accountId,new Date().toISOString());
      if(parsed.transactionType==="TRANSFER"&&parsed.transferAccountId)await persistPortfolioSnapshot(tx,householdId,parsed.transferAccountId,new Date().toISOString());
      return{transactionId,type:parsed.transactionType,symbol:parsed.symbol,quantity:parsed.quantityText,amountCents:gross.toString(),cashAfterCents:(cashBefore+cashDelta).toString()};
    });
    return Response.json({ok:true,transaction:result},{status:201});
  }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"Investment transaction could not be saved"},{status:400})}
}
