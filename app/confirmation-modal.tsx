"use client";

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
 return <div className="confirmation-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&closeOnBackdrop&&!loading)onCancel()}}><div ref={dialogRef} className={`confirmation-modal confirmation-${variant}`} role={variant==="danger"||variant==="critical"?"alertdialog":"dialog"} aria-modal="true" aria-labelledby={titleId} aria-describedby={`${descriptionId}${error?` ${errorId}`:""}`} aria-busy={loading}><header><span aria-hidden="true">{icon??icons[variant]}</span><div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div></header>{context&&<div className="confirmation-context">{context}</div>}{confirmationText&&<label className="confirmation-typed">Type <strong>{confirmationText}</strong> to continue<input autoComplete="off" spellCheck={false} value={typed} onChange={event=>setTyped(event.target.value)} aria-label={`Type ${confirmationText} to confirm`}/></label>}{error&&<p className="confirmation-error" id={errorId} role="alert">{error}</p>}<footer><button ref={cancelRef} type="button" className="confirmation-cancel" disabled={loading} onClick={onCancel}>{cancelLabel}</button><button type="button" className="confirmation-submit" disabled={loading||disabled||!valid} onClick={onSubmit}>{loading?"Working…":confirmLabel}</button></footer></div></div>
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
