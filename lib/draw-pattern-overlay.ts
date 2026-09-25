import type {PatternEvidence,PatternBar} from './pattern-evidence';
export const patternColor=(pattern:PatternEvidence)=>pattern.validation==='FAIL'?'#94a3b8':pattern.direction==='UP'?'#4ade80':pattern.direction==='DOWN'?'#fb7185':'#fbbf24';
export function drawPatternOverlay(g:CanvasRenderingContext2D,p:PatternEvidence,view:PatternBar[],plot:{left:number;right:number;top:number;bottom:number;cw:number;py:(value:number)=>number},detail=true){
 const indices=view.map((b,i)=>b.time>=p.startTime&&b.time<=p.endTime?i:-1).filter(i=>i>=0);
 if(!indices.length)return false;
 const {left,right,top,bottom,cw,py}=plot,color=patternColor(p),x=(i:number)=>left+(i+.5)*cw;
 g.save();g.beginPath();g.rect(left,top,right-left,bottom-top);g.clip();
 g.fillStyle=color;g.globalAlpha=.07;g.fillRect(x(indices[0])-cw/2,top,(indices.at(-1)!-indices[0]+1)*cw,bottom-top);g.globalAlpha=1;
 g.strokeStyle=color;g.lineWidth=2.5;g.setLineDash([]);g.beginPath();let started=false;
 for(const a of p.anchors){const i=view.findIndex(b=>b.time===a.time);if(i<0){started=false;continue}if(started)g.lineTo(x(i),py(a.price));else g.moveTo(x(i),py(a.price));started=true;}g.stroke();
 for(const a of p.anchors){const i=view.findIndex(b=>b.time===a.time);if(i<0)continue;g.beginPath();g.arc(x(i),py(a.price),4,0,Math.PI*2);g.fill();}
 if(!detail){g.restore();return true;}
 g.font='bold 11px Arial';
 for(const [label,value,dash,lineColor] of [['Pattern trigger',p.confirmationLevel,[7,4],color],['Pattern invalidation',p.invalidationLevel,[2,4],'#fca5a5']] as const){
  const y=py(value);g.strokeStyle=lineColor;g.lineWidth=1.6;g.setLineDash([...dash]);g.beginPath();g.moveTo(left,y);g.lineTo(right,y);g.stroke();g.setLineDash([]);
  g.fillStyle='#07130f';g.fillRect(left+3,y-16,Math.min(230,right-left-6),18);g.fillStyle=lineColor;g.fillText(`${label} $${value.toFixed(2)}`,left+6,y-3,Math.max(1,right-left-12));
 }
 g.fillStyle='#07130f';g.fillRect(left+3,top+4,Math.min(310,right-left-6),19);g.fillStyle=color;g.fillText(`${p.name} · ${p.validation}`,left+6,top+18,Math.max(1,right-left-12));g.restore();return true;
}
