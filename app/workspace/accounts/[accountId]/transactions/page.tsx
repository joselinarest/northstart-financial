import { NorthstarWorkspace } from "@/app/northstar-workspace";

export default async function AccountTransactionsPage({params}:{params:Promise<{accountId:string}>}) {
  const {accountId}=await params;
  return <NorthstarWorkspace initialTab="Account Transactions" initialFinanceAccountId={accountId}/>;
}
