export function chartPriceTicks(low:number,high:number,height:number){
 if(!Number.isFinite(low)||!Number.isFinite(high)||high<=low)return [];
 const count=Math.max(4,Math.min(14,Math.floor(height/32))),raw=(high-low)/count,power=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].find(n=>n*power>=raw)!*power;
 const result:number[]=[];
 for(let v=Math.ceil(low/step)*step;v<=high+step*1e-8&&result.length<30;v+=step)result.push(Number(v.toFixed(8)));
 return result;
}
export function chartTimeLabel(time:string,intraday:boolean){
 const date=new Date(time);if(!Number.isFinite(date.getTime()))return 'Time unavailable';
 return new Intl.DateTimeFormat(undefined,intraday?{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}:{month:'short',day:'numeric',year:'2-digit'}).format(date);
}
