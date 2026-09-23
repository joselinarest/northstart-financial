import {createHash} from 'node:crypto';
import type {PostgresDatabase} from '@/lib/db';
import {buildPostTradeReview,type ReviewInput} from '@/lib/post-trade-review';
import type {PatternBar} from '@/lib/pattern-evidence';

export async function reviewClosedTrades(db:PostgresDatabase,accountId:string,securityId:string,bars:PatternBar[]){
  const rows=(await db.prepare(`SELECT x.id,x.exit_json,x.sell_reason,x.recommendation_id,r.checks_json,r.reason,r.invalidation_cents FROM trade_lifecycle_exits x LEFT JOIN recommendations r ON r.id=x.recommendation_id WHERE x.account_id=? AND x.security_id=?`).bind(accountId,securityId).all<{id:string;exit_json:{shares:number;price:number;tradeAt:string;netProceeds:number;basis:number;basisKnown:boolean;strategyVersion:string;modelVersion:string};sell_reason:string|null;recommendation_id:string|null;checks_json:Record<string,unknown>|null;reason:string|null;invalidation_cents:number|null}>()).results;
  for(const row of rows){
    const prior=await db.prepare('SELECT input_json,review_json FROM post_trade_reviews WHERE exit_id=?').bind(row.id).first<{input_json:ReviewInput;review_json:ReturnType<typeof buildPostTradeReview>}>();
    // Preserve the original prediction. A later model run must never rewrite what was predicted.
    const input:ReviewInput=prior?.input_json??{exitId:row.id,shares:row.exit_json.shares,exitPrice:row.exit_json.price,exitAt:row.exit_json.tradeAt,netProceeds:row.exit_json.netProceeds,basis:row.exit_json.basisKnown?row.exit_json.basis:null,entryAt:null,entryPrice:null,entryConfirmed:null,stop:null,predicted:row.checks_json?.aiEvidence??{reason:row.reason,attribution:row.recommendation_id?'Contemporaneous sale recommendation; execution linkage not proven':'No original recommendation available'},patterns:(row.checks_json?.patterns as {name:string;direction:string}[])??[],modelVersion:row.exit_json.modelVersion,strategyVersion:row.exit_json.strategyVersion,sellReason:row.sell_reason};
    if(!prior){
      const lots=(await db.prepare(`SELECT l.acquired_at,t.price_cents FROM tax_lot_disposals d JOIN tax_lots l ON l.id=d.lot_id JOIN investment_transactions t ON t.id=l.opening_transaction_id JOIN trade_lifecycle_exits x ON x.exit_transaction_id=d.sell_transaction_id WHERE x.id=?`).bind(row.id).all<{acquired_at:string;price_cents:number}>()).results;
      // Multi-lot trades need lot-weighted paths; never assign one lot's excursions to all shares.
      if(lots.length===1&&Number(lots[0].price_cents)>0){input.entryAt=new Date(lots[0].acquired_at).toISOString();input.entryPrice=Number(lots[0].price_cents)/100;}
    }
    const review=buildPostTradeReview(input,bars);
    // A provider outage or shorter rolling history must not erase previously measured results.
    if(prior&&Date.parse(prior.review_json.asOf)>Date.parse(review.asOf))continue;
    if(prior?.review_json.maximumFavorableExcursionBps!=null&&review.maximumFavorableExcursionBps===null){
      review.maximumFavorableExcursionBps=prior.review_json.maximumFavorableExcursionBps;
      review.maximumAdverseExcursionBps=prior.review_json.maximumAdverseExcursionBps;
      review.stopAssessment=prior.review_json.stopAssessment;
    }
    const hash=createHash('sha256').update(JSON.stringify(review)).digest('hex');
    await db.prepare('INSERT INTO post_trade_reviews(exit_id,input_json,review_json,revision_hash) VALUES(?,?,?,?) ON CONFLICT(exit_id) DO UPDATE SET review_json=EXCLUDED.review_json,revision_hash=EXCLUDED.revision_hash,updated_at=CURRENT_TIMESTAMP WHERE post_trade_reviews.revision_hash<>EXCLUDED.revision_hash').bind(row.id,JSON.stringify(input),JSON.stringify(review),hash).run();
    await db.prepare('INSERT INTO post_trade_review_revisions(exit_id,revision_hash,review_json) VALUES(?,?,?) ON CONFLICT(exit_id,revision_hash) DO NOTHING').bind(row.id,hash,JSON.stringify(review)).run();
  }
}
