type Row=Record<string,any>;
const time=(v:unknown)=>v?new Date(String(v)).toLocaleString():'Not yet completed';
const labels:Record<string,string>={universe:'Supported universe',screened_today:'Screened today',queued:'Due for refresh',deep_researched:'Company research',account_scored:'Scored for this account',option_chain_analyzed:'Chains analyzed',chain_qualified:'Passed chain screen',near_miss:'Screen near misses',rejected:'Research rejected',stale:'Screen older than one day',failed:'Retrying',unavailable:'No price history',priority_lane:'Priority lane'};
export default function IntelligenceCoverage({proof}:{proof?:Row|null}){
 const rotation=proof?.rotation,workers:Row[]=proof?.workers||[];
 const healthy=workers.some(w=>w.worker_name==='aws-scanner-worker'&&Date.now()-Date.parse(w.heartbeat_at)<10*60000);
 return <details open className="account-research-results"><summary><span><span className="research-eyebrow">ALWAYS-ON MARKET INTELLIGENCE</span><b>{healthy?'Server scanning is active':'Server scanning · awaiting current heartbeat'}</b></span></summary><div className="research-panel-body">
 <p>Research runs on the server while Northstar is closed. Priority work and a reserved background lane share each scan batch.</p>
 {rotation&&<><div className="research-progress-heading"><strong>Current universe rotation</strong><span>{Number(rotation.attempted).toLocaleString()} / {Number(rotation.universe).toLocaleString()} attempted</span></div><progress aria-label="Universe rotation attempted" value={rotation.attempted} max={rotation.universe||1}/><p>{rotation.screened} successful price screens · {rotation.unavailable} missing history · {rotation.failed} failed attempts. Started {time(rotation.startedAt)}.</p></>}
 <div className="research-metrics">{Object.entries(labels).map(([key,label])=><div key={key}><strong>{proof?.counts?.[key]==null?'—':Number(proof.counts[key]).toLocaleString()}</strong><span>{label}</span></div>)}</div>
 <p>Last completed rotation: <b>{time(proof?.lastCompletedRotation?.completed_at)}</b>. A completed rotation means every member was attempted; missing evidence does not count as qualified research. Counts other than “today” and the current rotation describe the latest stored state.</p>
 <details><summary>Worker health and industry / market-cap coverage</summary>{workers.map(w=><p key={w.worker_name}>{w.worker_name==='aws-scanner-worker'?'Discovery scanner':'Account and Options research'} · last heartbeat {time(w.heartbeat_at)}</p>)}<p>Provider industry classifications; unknown coverage remains explicit.</p><div className="research-metrics">{(proof?.groups||[]).map((g:Row)=><div key={g.sector+g.cap_bucket}><strong>{g.count}</strong><span>{g.sector} · {g.cap_bucket}</span></div>)}</div></details>
 </div></details>;
}
