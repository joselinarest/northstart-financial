"use client";
import {useState,type ReactNode} from 'react';
export default function SectionAccordion({title,children,defaultOpen=false}:{title:string;children:ReactNode;defaultOpen?:boolean}){
 const [open,setOpen]=useState(defaultOpen);
 return <details open={open} onToggle={event=>setOpen(event.currentTarget.open)} className="min-w-0 rounded-lg border border-line bg-surface text-ink"><summary className="min-h-11 cursor-pointer border-b border-line p-4 font-semibold focus-visible:outline-2 focus-visible:outline-brand">{title} · {open?'hide':'show'}</summary>{children}</details>;
}
