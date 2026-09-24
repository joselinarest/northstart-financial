/** A pointer selection can outlive its visible window after zoom, pan or refresh. */
export function selectedChartBar<T>(bars:readonly T[],index?:number|null):T|undefined{
 if(!bars.length)return undefined;
 const safe=index==null||!Number.isFinite(index)?bars.length-1:Math.trunc(index);
 return bars[Math.max(0,Math.min(bars.length-1,safe))];
}
