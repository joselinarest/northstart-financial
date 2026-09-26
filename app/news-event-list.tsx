"use client";
import {importantStockNews,newsTimestamp} from '@/lib/stock-news-impact';
export default function NewsEventList({symbol,items,compact=false,loading=false,error}:{symbol:string;items:Record<string,any>[];compact?:boolean;loading?:boolean;error?:string}) {
  const relevant=importantStockNews(symbol,items), visible=compact?relevant.slice(0,4):relevant;
  return <section className="news-event-list stock-impact-news" aria-label={`${symbol} important news`}>
    <h3>{symbol} · Important news &amp; stock impact</h3>
    {loading?<p role="status">Loading stock-specific news…</p>:error?<p role="status">News is unavailable: {error}</p>:!visible.length?<p>No verified stock-specific news is available. This does not establish that there are no news risks.</p>:<>
      <p className="news-impact-note">Potential impact is an interpretation, not a price forecast. Open the source to verify the report.</p>
      <div className="stock-news-cards">{visible.map((item,index)=>{
        const timestamp=newsTimestamp(item), validUrl=/^https?:\/\//i.test(item.url||'');
        return <article key={item.id||item.url||index} className={`stock-news-item impact-${item.assessment.tone}`}>
          <span className="news-impact-label">{item.assessment.label}</span>
          <h4>{validUrl?<a href={item.url} target="_blank" rel="noreferrer">{item.headline||item.title||'Company event'} ↗</a>:item.headline||item.title||'Company event'}</h4>
          <p className="news-source">{typeof item.source==='object'?item.source?.title||'Source unavailable':item.source||'Source unavailable'} · {timestamp?<time dateTime={new Date(timestamp).toISOString()}>{new Date(timestamp).toLocaleString()}</time>:'Time unavailable'}</p>
          <p><b>Why it matters:</b> {item.assessment.reason}</p>
          <small>{item.assessment.basis}</small>
          {(item.summary||item.description)&&<details><summary>Report summary</summary><p>{item.summary||item.description}</p></details>}
        </article>;
      })}</div>
    </>}
  </section>;
}
