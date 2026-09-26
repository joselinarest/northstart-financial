/** Apple rejects localhost-style VAPID subjects. Use an actual configured contact or public app URL.
 * https://github.com/web-push-libs/web-push#using-vapid-key-for-applicationserverkey
 */
export function vapidSubject(env:Record<string,string|undefined>){
 const valid=(value:string)=>{try{const url=new URL(value),host=url.protocol==='mailto:'?url.pathname.split('@')[1]:url.hostname;return ['https:','mailto:'].includes(url.protocol)&&Boolean(host?.includes('.'))&&!/(?:^localhost$|\.localhost$|\.local$)/i.test(host);}catch{return false;}};
 const email=(env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1]||env.EMAIL_FROM||'').trim(),values=[env.VAPID_SUBJECT||'',email?'mailto:'+email:'',env.APP_URL||''];const found=values.find(valid);if(!found)throw Error('PUBLIC_VAPID_SUBJECT_REQUIRED');return found;
}
