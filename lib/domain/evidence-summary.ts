const label=(key:string)=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ');
export function evidenceSummary(value:unknown,depth=0):string {
 if(value==null)return 'Not supplied';
 if(typeof value==='boolean')return value?'Yes':'No';
 if(typeof value!=='object')return String(value);
 if(depth>=4)return 'Additional evidence available in the analysis detail';
 if(Array.isArray(value))return value.length?value.map(item=>evidenceSummary(item,depth+1)).join('; '):'None reported';
 const entries=Object.entries(value).filter(([,item])=>item!=null);
 return entries.length?entries.map(([key,item])=>`${label(key)}: ${evidenceSummary(item,depth+1)}`).join('; '):'Not supplied';
}
export function evidenceState(value:unknown):'PASS'|'FAIL'|'UNKNOWN' {
 const raw=typeof value==='object'&&value!==null?(value as any).status??(value as any).state??(value as any).passed:value;
 if(raw===true||['PASS','CONFIRMED'].includes(String(raw).toUpperCase()))return 'PASS';
 if(raw===false||['FAIL','FAILED','BLOCKED','ERROR'].includes(String(raw).toUpperCase()))return 'FAIL';
 return 'UNKNOWN';
}
