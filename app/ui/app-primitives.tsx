import type {HTMLAttributes,ReactNode} from "react";

export function AppPanel({className="",children,...props}:HTMLAttributes<HTMLElement>){return <section className={`ui-panel ${className}`.trim()} {...props}>{children}</section>}
export function SectionHeader({eyebrow,title,description,action,className=""}:{eyebrow?:string;title:string;description?:string;action?:ReactNode;className?:string}){return <header className={`ui-section-header ${className}`.trim()}><div>{eyebrow&&<span>{eyebrow}</span>}<h2>{title}</h2>{description&&<p>{description}</p>}</div>{action&&<div className="ui-section-actions">{action}</div>}</header>}
export function MetricCard({label,value,detail,tone="neutral"}:{label:string;value:ReactNode;detail?:string;tone?:"neutral"|"positive"|"warning"|"danger"}){return <article className={`ui-metric ui-metric-${tone}`}><small>{label}</small><strong>{value}</strong>{detail&&<span>{detail}</span>}</article>}
export function EmptyState({title,description,action,icon="◇"}:{title:string;description:string;action?:ReactNode;icon?:string}){return <div className="ui-empty-state"><i aria-hidden="true">{icon}</i><div><b>{title}</b><p>{description}</p></div>{action}</div>}
export function StatusBadge({children,tone="neutral"}:{children:ReactNode;tone?:"neutral"|"positive"|"warning"|"danger"|"info"}){return <span className={`ui-status ui-status-${tone}`}>{children}</span>}
