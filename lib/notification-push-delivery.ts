import type {PostgresDatabase} from "@/lib/db";
/** Accepted per device, not merely per user. A failed device never hides behind a successful one. */
export async function deliverPushDevices(db:PostgresDatabase,delivery:{id:string;household_id:string;user_id:string},send:(encrypted:string)=>Promise<void>){
  const subscriptions=await db.prepare("SELECT id,encrypted_subscription FROM push_subscriptions WHERE household_id=? AND user_id=? AND active=TRUE").bind(delivery.household_id,delivery.user_id).all<{id:string;encrypted_subscription:string}>();
  if(!subscriptions.results.length)throw Error("PUSH_SUBSCRIPTION_MISSING");
  let failed=0;const failures=new Set<string>();
  for(const subscription of subscriptions.results){
    if(await db.prepare("SELECT delivery_id FROM notification_push_receipts WHERE delivery_id=? AND subscription_id=?").bind(delivery.id,subscription.id).first())continue;
    try{await send(subscription.encrypted_subscription);await db.prepare("INSERT INTO notification_push_receipts(delivery_id,subscription_id) VALUES(?,?) ON CONFLICT DO NOTHING").bind(delivery.id,subscription.id).run();}
    catch(error){failed++;const status=Number((error as {statusCode?:number})?.statusCode);let reason='';try{const parsed=JSON.parse(String((error as any)?.body||'{}'));if(/^[A-Za-z0-9_-]{1,48}$/.test(parsed.reason||''))reason=':'+parsed.reason;}catch{}failures.add(status?`PUSH_HTTP_${status}${reason}`:/^[A-Z0-9_]{2,50}$/.test(String((error as any)?.code||''))?String((error as any).code):'PUSH_TRANSPORT_ERROR');if([404,410].includes(status))await db.prepare("UPDATE push_subscriptions SET active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(subscription.id).run();}
  }
  if(failed)throw Error("PUSH_DELIVERY_FAILED:"+[...failures].join(","));
}
