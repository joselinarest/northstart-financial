import type {FlowMarker} from './flow-evidence';
export function flowCoordinates(marker:FlowMarker,bars:{time:string}[],left:number,cw:number,py:(p:number)=>number){
 if(!Number.isFinite(marker.price)||marker.price<=0||!bars.length)return null;
 if(marker.time===null)return {x:null,y:py(marker.price)};
 const time=Date.parse(marker.time),first=Date.parse(bars[0].time),last=Date.parse(bars.at(-1)!.time),step=bars.length>1?Date.parse(bars.at(-1)!.time)-Date.parse(bars.at(-2)!.time):0;
 if(!Number.isFinite(time)||time<first||time>=last+step)return null;
 let index=bars.findIndex((b,i)=>time>=Date.parse(b.time)&&(i===bars.length-1||time<Date.parse(bars[i+1].time)));
 if(index<0)return null;const start=Date.parse(bars[index].time),end=index+1<bars.length?Date.parse(bars[index+1].time):start+step;return {x:left+(index+.5+(time-start)/(end-start))*cw,y:py(marker.price)};
}
export function drawFlowOverlay(g:CanvasRenderingContext2D,markers:FlowMarker[],bars:{time:string}[],bounds:{left:number;right:number;top:number;bottom:number;cw:number;py:(p:number)=>number}){
 g.save();g.beginPath();g.rect(bounds.left,bounds.top,bounds.right-bounds.left,bounds.bottom-bounds.top);g.clip();
 for(const m of markers){const p=flowCoordinates(m,bars,bounds.left,bounds.cw,bounds.py);if(!p||p.y<bounds.top||p.y>bounds.bottom)continue;
 g.strokeStyle=g.fillStyle=m.kind==='DARK_POOL_LEVEL'?'#60a5fa':m.kind.includes('WALL')?'#c084fc':'#fbbf24';g.lineWidth=1;
 if(p.x===null){g.setLineDash([2,6]);g.beginPath();g.moveTo(bounds.left,p.y);g.lineTo(bounds.right,p.y);g.stroke();g.setLineDash([]);g.font='10px Arial';g.fillText(m.label,bounds.left+8,p.y-3,Math.max(1,bounds.right-bounds.left-16));}
 else {g.beginPath();g.arc(p.x,p.y,4,0,Math.PI*2);g.fill();}
 }g.restore();
}
