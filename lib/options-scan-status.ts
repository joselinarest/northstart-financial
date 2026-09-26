type Row=Record<string,any>;
export function optionAnalysisState(result:Row){
 if(["INCOMPLETE","ACCOUNT_BLOCKED"].includes(result.analysisState))return String(result.analysisState);
 const provider=result.decision?.providerStatus;
 if(provider&&provider!=='AVAILABLE')return 'INCOMPLETE';
 if(result.freshness==='STALE')return 'STALE';
 if(result.analysisState)return String(result.analysisState);
 if(result.contract&&(result.status==='CANDIDATE'||result.researchQualified))return 'QUALIFIED';
 // Older unavailable results did not record a provider status. Never count them as completed research.
 if(!provider||result.decision?.dataQuality==null)return 'INCOMPLETE';
 return 'COMPLETE';
}
export function summarizeOptionAnalysis(results:Row[]){
 const counts={reviewed:results.length,qualified:0,incomplete:0,stale:0,complete:0,accountBlocked:0};
 const reasons=new Map<string,number>();
 for(const result of results){const state=optionAnalysisState(result);if(state==='QUALIFIED')counts.qualified++;else if(state==='COMPLETE')counts.complete++;else if(state==='ACCOUNT_BLOCKED')counts.accountBlocked++;else if(state==='STALE')counts.stale++;else counts.incomplete++;}
 for(const result of results){if(optionAnalysisState(result)!=='INCOMPLETE')continue;const factors=(result.decision?.reasoningFactors||[]).filter((s:unknown)=>typeof s==='string'&&/^(Missing|Stale) /.test(s));const reason=factors.length?factors.join('; '):result.rationale?.[0]||result.decision?.interpretation||'Verified underlying research is unavailable.';reasons.set(reason,(reasons.get(reason)||0)+1);}
 return {...counts,blockers:[...reasons].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([reason,count])=>({reason,count}))};
}
export function optionScanMessage(summary:Row|null,coverage:Row|null){
 if(!summary)return 'Loading account option analysis and scan progress…';
 const pending=Number(summary.pending||0),failed=Number(summary.failed||0),incomplete=Number(summary.incomplete||0),stale=Number(summary.stale||0);
 const parts:string[]=[];
 if(incomplete)parts.push(`${incomplete} stock reviews need missing or refreshed research`);
 if(stale)parts.push(`${stale} saved reviews need revalidation`);
 if(pending)parts.push(`${pending} account reviews are queued or running`);
 if(failed)parts.push(`${failed} reviews failed and need retry`);
 if(parts.length)return `Analysis incomplete: ${parts.join('; ')}. This does not mean there are no suitable calls or puts. Use Find options to prioritize a stock.`;
 if(summary.accountBlocked)return 'The reviewed contracts exceed this account’s premium budget or permissions. Review account settings to see the limits.';
 if(!summary.reviewed)return 'Account-specific option research has not completed yet. Use Find options to prioritize a stock.';
 const remaining=Math.max(0,Number(coverage?.universe||0)-Number(coverage?.screened||0));
 return `No setup qualified among the ${summary.reviewed} stocks reviewed for this account.${remaining?` ${remaining} stocks still await the broad-market screen.`:' The rotating scan continues; this is not a conclusion about every option in the market.'}`;
}
