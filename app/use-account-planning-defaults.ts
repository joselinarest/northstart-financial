"use client";
import {useEffect,useState} from 'react';
const cache={at:0,promise:null as Promise<any[]>|null};
export function useAccountPlanningDefaults(accountId:string){
 const[state,setState]=useState<{id:string;account:any;error:string}>({id:'',account:null,error:''});
 useEffect(()=>{let active=true;setState({id:accountId,account:null,error:''});if(!accountId)return;
 if(!cache.promise||Date.now()-cache.at>15000){cache.at=Date.now();cache.promise=fetch('/api/investment-accounts',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Account defaults unavailable');return (await r.json()).accounts||[];}).catch(e=>{cache.promise=null;throw e;});}
 cache.promise.then(accounts=>{if(active)setState({id:accountId,account:accounts.find(a=>String(a.id)===accountId)||null,error:''});}).catch(()=>{if(active)setState({id:accountId,account:null,error:'Account defaults unavailable'});});return()=>{active=false;};
 },[accountId]);
 const account=state.id===accountId?state.account:null;
 const policy=typeof account?.policy_json==='string'?JSON.parse(account.policy_json):account?.policy_json||{};
 return {account,policy,risk:policy.tradingPolicy||{},error:state.id===accountId?state.error:''};
}
