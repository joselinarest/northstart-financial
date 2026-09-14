"use client";
import {useEffect,useState} from "react";

const clean=(value:string)=>value.replace(/[^\d.-]/g,"");
const display=(value:number)=>Number.isFinite(value)&&value!==0?value.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"";

export function CurrencyInput({value,onChange,placeholder="0.00",ariaLabel}:{value:number;onChange:(value:number)=>void;placeholder?:string;ariaLabel?:string}){
 const[draft,setDraft]=useState(()=>display(value)),[focused,setFocused]=useState(false);
 useEffect(()=>{if(!focused)setDraft(display(value))},[value,focused]);
 return <div className="ns-currency-input"><span aria-hidden="true">$</span><input aria-label={ariaLabel} inputMode="decimal" autoComplete="off" value={draft} placeholder={placeholder} onFocus={()=>{setFocused(true);setDraft(value?String(value):"")}} onChange={event=>{const next=clean(event.target.value);if(!/^-?\d*(?:\.\d{0,2})?$/.test(next))return;setDraft(next);const amount=Number(next);onChange(Number.isFinite(amount)?amount:0)}} onBlur={()=>{setFocused(false);setDraft(display(Number(clean(draft))))}}/></div>;
}
