export function saleReadiness(row:any,now=Date.now()){
 let audit:any={};try{audit=typeof row?.lifecycle_audit_json==='string'?JSON.parse(row.lifecycle_audit_json):row?.lifecycle_audit_json||{}}catch{}
 const price=Number(audit.price),shares=Number(audit.shares);
 const sale=['SELL','EXIT','REDUCE','TAKE_PARTIAL_PROFIT'].includes(row?.action);
 const ready=sale&&row?.actionable===true&&row?.lifecycle==='TRIGGERED'&&Date.parse(row.expires_at)>now&&row.pipeline_status==='COMPLETE'&&audit.pipeline==='COMPLETE'&&Number.isFinite(price)&&price>0&&Number.isFinite(shares)&&shares>0;
 return{ready,audit,price:Number.isFinite(price)&&price>0?price:null,shares:Number.isFinite(shares)&&shares>0?shares:null};
}
