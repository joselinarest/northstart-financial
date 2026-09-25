"use client";

import {Button} from '@/app/ui/primitives';
import {createContext,useCallback,useContext,useEffect,useId,useRef,useState,type ReactNode} from "react";

export type ConfirmVariant="default"|"warning"|"danger"|"critical";
export type ConfirmOptions={title:string;description:string;confirmLabel?:string;cancelLabel?:string;variant?:ConfirmVariant;icon?:ReactNode;context?:ReactNode;confirmationText?:string;disabled?:boolean;closeOnBackdrop?:boolean;closeOnEscape?:boolean;onConfirm?:()=>void|Promise<void>};
type ModalProps=ConfirmOptions&{open:boolean;loading?:boolean;error?:string;onCancel:()=>void;onSubmit:()=>void|Promise<void>};

const icons:Record<ConfirmVariant,ReactNode>={default:"✓",warning:"△",danger:"!",critical:"!"};

export function ConfirmationModal({open,title,description,confirmLabel="Confirm",cancelLabel="Cancel",variant="default",icon,context,confirmationText,disabled=false,closeOnBackdrop=true,closeOnEscape=true,loading=false,error,onCancel,onSubmit}:ModalProps){
 const dialogRef=useRef<HTMLDivElement>(null),cancelRef=useRef<HTMLButtonElement>(null),titleId=useId(),descriptionId=useId(),errorId=useId();
 const[typed,setTyped]=useState(""),valid=!confirmationText||typed===confirmationText;
 useEffect(()=>{if(!open){setTyped("");return}const overflow=document.body.style.overflow;document.body.style.overflow="hidden";const focusable=()=>Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')||[]);requestAnimationFrame(()=>(confirmationText?dialogRef.current?.querySelector<HTMLInputElement>("input"):cancelRef.current)?.focus());const key=(event:KeyboardEvent)=>{if(event.key==="Escape"&&closeOnEscape&&!loading){event.preventDefault();onCancel();return}if(event.key!=="Tab")return;const nodes=focusable();if(!nodes.length)return;const[first,last]=[nodes[0],nodes[nodes.length-1]];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};document.addEventListener("keydown",key);return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",key)}},[open,loading,closeOnEscape,confirmationText,onCancel]);
 if(!open)return null;
 return <div className="fixed! inset-0! z-[1500]! flex! items-center! justify-center! overflow-y-auto! bg-black/60! p-4!" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&closeOnBackdrop&&!loading)onCancel()}}><div ref={dialogRef} className="w-full! min-w-0! max-w-lg! max-h-[calc(100dvh-2rem)]! overflow-y-auto! rounded-xl! border! border-line! bg-surface! p-5! text-ink! shadow-xl! [overflow-wrap:anywhere]" role={variant==="danger"||variant==="critical"?"alertdialog":"dialog"} aria-modal="true" aria-labelledby={titleId} aria-describedby={`${descriptionId}${error?` ${errorId}`:""}`} aria-busy={loading}><div className="flex items-start gap-3"><span className="text-warning text-xl" aria-hidden="true">{icon??icons[variant]}</span><div><h2 className="m-0! text-lg! font-semibold!" id={titleId}>{title}</h2><p className="mt-2! text-sm! leading-relaxed! text-muted!" id={descriptionId}>{description}</p></div></div>{context&&<div className="my-4 rounded-lg border border-line bg-soft p-3 text-sm">{context}</div>}{confirmationText&&<label className="my-4 grid gap-2 text-sm"><span>To confirm, enter exactly <strong>{confirmationText}</strong></span><input className="min-h-11! w-full! min-w-0! rounded-lg! border! border-line! bg-surface! p-3! text-ink! focus-visible:outline-2 focus-visible:outline-brand" autoComplete="off" spellCheck={false} placeholder={`Enter ${confirmationText}`} value={typed} onChange={event=>setTyped(event.target.value)} aria-label={`Type ${confirmationText} to confirm`}/></label>}{error&&<p className="my-3 text-sm text-negative" id={errorId} role="alert">{error}</p>}<div className="mt-5 flex flex-wrap justify-end gap-3"><Button ref={cancelRef} type="button"  disabled={loading} onClick={onCancel}>{cancelLabel}</Button><Button type="button" tone={variant==="danger"||variant==="critical"?"danger":"primary"} disabled={loading||disabled||!valid} onClick={onSubmit}>{loading?"Working…":confirmLabel}</Button></div></div></div>
}

type Pending={options:ConfirmOptions;resolve:(value:boolean)=>void;trigger:HTMLElement|null};
type ConfirmFunction=(options:ConfirmOptions)=>Promise<boolean>;
const ConfirmContext=createContext<ConfirmFunction|null>(null);

export function ConfirmProvider({children}:{children:ReactNode}){
 const[pending,setPending]=useState<Pending|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const confirm=useCallback<ConfirmFunction>(options=>new Promise(resolve=>{setError("");setPending({options,resolve,trigger:document.activeElement instanceof HTMLElement?document.activeElement:null})}),[]);
 const finish=useCallback((result:boolean)=>{if(!pending||loading)return;const{resolve,trigger}=pending;resolve(result);setPending(null);setError("");requestAnimationFrame(()=>trigger?.focus())},[pending,loading]);
 const submit=useCallback(async()=>{if(!pending||loading||pending.options.disabled)return;setLoading(true);setError("");try{await pending.options.onConfirm?.();const{resolve,trigger}=pending;resolve(true);setPending(null);requestAnimationFrame(()=>trigger?.focus())}catch(cause){setError(cause instanceof Error?cause.message:"The action could not be completed. Please try again.")}finally{setLoading(false)}},[pending,loading]);
 return <ConfirmContext.Provider value={confirm}>{children}<ConfirmationModal {...(pending?.options||{title:"",description:""})} open={Boolean(pending)} loading={loading} error={error} onCancel={()=>finish(false)} onSubmit={submit}/></ConfirmContext.Provider>
}

export function useConfirm(){const context=useContext(ConfirmContext);if(!context)throw new Error("useConfirm must be used inside ConfirmProvider");return context}
