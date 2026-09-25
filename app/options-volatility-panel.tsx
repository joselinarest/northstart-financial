import type {assessOptionVolatility} from '@/lib/options-volatility';
const percent=(v:number|null)=>v==null?'Unavailable':`${(v*100).toFixed(1)}%`;
export default function OptionsVolatilityPanel({assessment:a}:{assessment?:ReturnType<typeof assessOptionVolatility>}){
 if(!a)return <p>Volatility assessment unavailable. No volatility-based entry authorization.</p>;
 return <section className="rounded-lg border border-line bg-soft p-3 text-ink"><h4>Volatility assessment · {a.allowed?'PASS':'WAIT'}</h4><dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
 <div><dt>Market realized volatility (SPY)</dt><dd>{percent(a.context.marketRealized)}</dd></div><div><dt>Underlying realized volatility</dt><dd>{percent(a.context.realized)}</dd></div><div><dt>Contract IV</dt><dd>{percent(a.iv)}</dd></div>
 <div><dt>ATR (daily, 14 sessions)</dt><dd>{a.context.atr==null?'Unavailable':`$${a.context.atr.toFixed(2)}`}</dd></div><div><dt>Volatility opportunity</dt><dd>{a.score==null?'Unavailable':`${a.score}/100 · policy score`}</dd></div><div><dt>Risk capacity multiplier</dt><dd>{a.riskMultiplier}×</dd></div></dl>
 <p>IV contraction scenario: {a.crushLossPerContract==null?'Unavailable':`approximately $${a.crushLossPerContract.toFixed(2)} premium loss per contract`}. {a.crushAssumption} Direction, Gamma and Theta are not included in this sensitivity.</p>
 <p>Unavailable inputs: {a.context.missing.join(', ')}. No values are inferred for these fields.</p>{a.reasons.map(reason=><p key={reason}>{reason}</p>)}
 </section>;
}
