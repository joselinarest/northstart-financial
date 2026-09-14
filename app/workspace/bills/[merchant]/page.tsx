import {NorthstarWorkspace} from "@/app/northstar-workspace";

export default async function BillHistoryPage({params,searchParams}:{params:Promise<{merchant:string}>;searchParams:Promise<{accountId?:string}>}){
 const[{merchant},{accountId}]=await Promise.all([params,searchParams]);
 return <NorthstarWorkspace initialTab="Bill Transactions" initialBillName={decodeURIComponent(merchant)} initialFinanceAccountId={accountId||""}/>;
}
