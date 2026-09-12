"use client";
import {useEffect,useRef,useState} from "react";

export type GoogleAddressDetails={formattedAddress:string;placeId?:string;latitude?:number;longitude?:number;street?:string;city?:string;state?:string;postalCode?:string;country?:string};
type Props={value:string;onChange:(address:string,details?:GoogleAddressDetails)=>void;label?:string;placeholder?:string;required?:boolean;country?:string};
declare global{interface Window{google?:any;__northstarGooglePlaces?:Promise<void>}}

function loadPlaces(apiKey:string){
 if(window.google?.maps?.places)return Promise.resolve();
 if(window.__northstarGooglePlaces)return window.__northstarGooglePlaces;
 window.__northstarGooglePlaces=new Promise((resolve,reject)=>{
  const existing=document.querySelector<HTMLScriptElement>('script[data-northstar-google-places]');
  if(existing){existing.addEventListener("load",()=>resolve(),{once:true});existing.addEventListener("error",()=>reject(new Error("Google Places could not load")),{once:true});return}
  const script=document.createElement("script");
  script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
  script.async=true;script.defer=true;script.dataset.northstarGooglePlaces="true";
  script.onload=()=>resolve();script.onerror=()=>reject(new Error("Google Places could not load"));document.head.appendChild(script);
 });
 return window.__northstarGooglePlaces;
}
const part=(place:any,type:string)=>place.address_components?.find((item:any)=>item.types?.includes(type))?.long_name||"";

export default function GoogleAddressAutocomplete({value,onChange,label="Address",placeholder="Start typing a U.S. property address",required=false,country="us"}:Props){
 const inputRef=useRef<HTMLInputElement>(null),changeRef=useRef(onChange),[status,setStatus]=useState("Preparing address search…"),apiKey=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY||"";
 changeRef.current=onChange;
 useEffect(()=>{let active=true,listener:any;if(!apiKey){setStatus("Google address search is not configured · manual entry remains available");return}loadPlaces(apiKey).then(()=>{
  if(!active||!inputRef.current||!window.google?.maps?.places)return;
  const autocomplete=new window.google.maps.places.Autocomplete(inputRef.current,{componentRestrictions:{country},fields:["address_components","formatted_address","geometry","place_id"],types:["address"]});
  listener=autocomplete.addListener("place_changed",()=>{const place=autocomplete.getPlace(),formattedAddress=String(place.formatted_address||inputRef.current?.value||"").trim();if(!formattedAddress){setStatus("Select a complete address from the suggestions or enter it manually.");return}changeRef.current(formattedAddress,{formattedAddress,placeId:place.place_id,latitude:place.geometry?.location?.lat(),longitude:place.geometry?.location?.lng(),street:[part(place,"street_number"),part(place,"route")].filter(Boolean).join(" "),city:part(place,"locality")||part(place,"postal_town"),state:part(place,"administrative_area_level_1"),postalCode:part(place,"postal_code"),country:part(place,"country")});setStatus("✓ Verified Google address selected")});
  setStatus("Google address suggestions are ready");
 }).catch(error=>{if(active)setStatus(`${error instanceof Error?error.message:"Address search unavailable"} · enter the address manually`)});return()=>{active=false;if(listener&&window.google?.maps?.event)window.google.maps.event.removeListener(listener)}},[apiKey,country]);
 return <label className="google-address-field">{label}<span className="google-address-control"><input ref={inputRef} value={value} required={required} autoComplete="street-address" placeholder={placeholder} onChange={event=>{changeRef.current(event.target.value);setStatus(apiKey?"Keep typing or select a Google suggestion":"Manual address entry")}}/><i aria-hidden="true">⌖</i></span><small className={status.startsWith("✓")?"verified":""}>{status}</small></label>;
}
