import type {PostgresDatabase} from '@/lib/db';
/** Plaid security IDs differ between Items; reuse the canonical ticker/type identity. */
export async function plaidSecurityId(db:PostgresDatabase,security:Record<string,any>){
 const providerId=String(security.security_id||'');if(!providerId)throw Error('PLAID_SECURITY_ID_MISSING');const id='plaid_sec_'+providerId,ticker=security.ticker_symbol||null,type=security.type||null;
 await db.prepare('INSERT INTO securities(id,ticker,name,type,currency,provider_security_id) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(id,ticker,security.name||'Unknown security',type,security.iso_currency_code||'USD',providerId).run();
 const row=await db.prepare('SELECT id FROM securities WHERE id=? OR (ticker=? AND type IS NOT DISTINCT FROM ?) ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END LIMIT 1').bind(id,ticker,type,id).first<{id:string}>();if(!row)throw Error('PLAID_SECURITY_MAPPING_FAILED');return row.id;
}
