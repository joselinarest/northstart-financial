"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
export default function MovableStockPanel({children,onClose}:{children:ReactNode;onClose:()=>void}){
 const [floating,setFloating]=useState(true),[position,setPosition]=useState({left:16,top:16});
 const panel=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
 const move=(left:number,top:number)=>{const rect=panel.current?.getBoundingClientRect();setPosition({left:Math.max(0,Math.min(left,window.innerWidth-(rect?.width||320))),top:Math.max(0,Math.min(top,window.innerHeight-(rect?.height||260)))})};
 useEffect(()=>{if(!floating)return;const resize=()=>setPosition(p=>({left:Math.max(0,Math.min(p.left,innerWidth-(panel.current?.offsetWidth||320))),top:Math.max(0,Math.min(p.top,innerHeight-(panel.current?.offsetHeight||260)))}));window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[floating]);
 const content=<div ref={panel} role="region" aria-label="Stock gain and loss at selected date" onKeyDown={e=>{if(e.key==='Escape')onClose()}} style={{position:floating?'fixed':'relative',...(floating?position:{}),width:floating?320:'100%',maxWidth:'100vw',maxHeight:floating?'min(360px, 100dvh)':360,overflowY:'auto',zIndex:floating?10000:1,padding:12,boxSizing:'border-box',border:'1px solid #b4c9db',borderRadius:10,background:'#fff',color:'#183047',boxShadow:'0 6px 22px #102d4033',fontSize:13,marginTop:floating?0:12}}>
 <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',position:'sticky',top:-12,background:'#fff',padding:'8px 0'}}>
 {floating&&<button aria-label="Move stock panel" style={{cursor:'move',touchAction:'none'}} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,...position}}} onPointerMove={e=>{if(drag.current)move(drag.current.left+e.clientX-drag.current.x,drag.current.top+e.clientY-drag.current.y)}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onKeyDown={e=>{const delta:Record<string,[number,number]>={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};if(delta[e.key]){e.preventDefault();move(position.left+delta[e.key][0],position.top+delta[e.key][1])}}}>⠿ Drag panel</button>}
 <button onClick={()=>{setFloating(!floating);setPosition({left:16,top:16})}}>{floating?'Dock below chart':'Float / move panel'}</button><button aria-label="Close stock panel" onClick={onClose}>Close</button></div>
 {children}</div>;
 return floating?createPortal(content,document.body):content;
}
