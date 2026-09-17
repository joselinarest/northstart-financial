"use client";
import {useEffect} from "react";

export default function MobileOverflowDebug(){
 useEffect(()=>{
  if(process.env.NODE_ENV!=="development")return;
  const enabled=new URLSearchParams(location.search).has("mobileDebug")||localStorage.getItem("northstar-mobile-debug")==="true";
  if(!enabled)return;
  const inspect=()=>{const viewport=document.documentElement.clientWidth;document.querySelectorAll<HTMLElement>("body *").forEach(element=>{const box=element.getBoundingClientRect(),overflow=box.right>viewport+2||box.left<-2||element.scrollWidth>Math.max(element.clientWidth+2,viewport+2);element.toggleAttribute("data-mobile-overflow",overflow);if(overflow)console.warn("northstar.mobile_overflow",{route:location.pathname,component:element.tagName,width:Math.round(box.width),scrollWidth:element.scrollWidth,viewportWidth:viewport,className:element.className})})};
  let frame=0;const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(inspect)},observer=new MutationObserver(schedule),resize=new ResizeObserver(schedule);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});resize.observe(document.documentElement);window.addEventListener("resize",schedule);schedule();return()=>{cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();window.removeEventListener("resize",schedule);document.querySelectorAll("[data-mobile-overflow]").forEach(element=>element.removeAttribute("data-mobile-overflow"))}
 },[]);return null;
}
