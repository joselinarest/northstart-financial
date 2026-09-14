/* Northstar PWA worker. Private financial pages and API payloads are never cached. */
const VERSION = "northstar-pwa-v4";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL,"/manifest.webmanifest","/favicon.svg","/icons/northstar-192.png","/icons/northstar-512.png","/icons/northstar-maskable-192.png","/icons/northstar-maskable-512.png","/icons/apple-touch-icon.png"];

self.addEventListener("install", event => event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== STATIC_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("message", event => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", event => {
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith("/api/")||url.pathname.startsWith("/auth/"))return;
  if(request.mode==="navigate"){event.respondWith(fetch(request).catch(()=>caches.match(OFFLINE_URL)));return}
  const safe=PRECACHE.includes(url.pathname)||url.pathname.startsWith("/_next/static/");
  if(!safe)return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&response.type==="basic"){const copy=response.clone();caches.open(STATIC_CACHE).then(cache=>cache.put(request,copy))}return response})));
});
self.addEventListener("push", event => {
  let data={};try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text()}}
  const urgency=data.urgency||data.severity||"info";
  event.waitUntil(Promise.all([self.registration.showNotification(data.title||"Northstar alert",{body:data.body||"A financial event needs your review.",icon:"/icons/northstar-192.png",badge:"/icons/northstar-badge-96.png",tag:data.tag||data.eventId||"northstar-financial-alert",renotify:urgency==="critical",requireInteraction:urgency==="critical",data:{url:data.url||"/workspace/settings#transaction-notifications"}}),self.navigator.setAppBadge?.()]));
});
self.addEventListener("notificationclick",event=>{event.notification.close();self.navigator.clearAppBadge?.();const target=new URL(event.notification.data?.url||"/workspace/dashboard",self.location.origin).href;event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const client of list){if(new URL(client.url).origin===self.location.origin&&"focus" in client){client.postMessage({type:"NOTIFICATION_DEEP_LINK",url:target});return client.focus()}}return self.clients.openWindow(target)}))});
