"use client";
import {useState,type ReactNode} from 'react';
export default function SectionAccordion({title,children}:{title:string;children:ReactNode}){
 const [open,setOpen]=useState(false);
 return <details open={open} onToggle={event=>setOpen(event.currentTarget.open)} style={{minWidth:0}}><summary style={{padding:16,cursor:'pointer',fontWeight:700,borderBottom:'1px solid #b9cec4'}}>{title} · {open?'hide':'show'}</summary>{children}</details>;
}
