import type{HTMLAttributes,ReactNode}from"react";

const join=(base:string,value?:string)=>`${base}${value?` ${value}`:""}`;
export function PageContainer({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={join("ui-page-container",className)} {...props}/>}
export function ResponsiveGrid({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={join("ui-responsive-grid",className)} {...props}/>}
export function MobileCard({className,...props}:HTMLAttributes<HTMLElement>){return <article className={join("ui-mobile-card",className)} {...props}/>}
export function MobileList({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={join("ui-mobile-list",className)} {...props}/>}
export function ScrollableTabs({className,...props}:HTMLAttributes<HTMLElement>){return <nav className={join("ui-scrollable-tabs",className)} {...props}/>}
export function ResponsiveTable({labels,children,className}:{labels:string[];children:ReactNode;className?:string}){return <div className={join("ui-responsive-table",className)} style={{"--mobile-labels":labels.join("|")} as React.CSSProperties}>{children}</div>}
export function BottomSheet({title,children,className}:HTMLAttributes<HTMLElement>&{title:string}){return <section className={join("ui-bottom-sheet",className)} role="dialog" aria-modal="true" aria-label={title}>{children}</section>}
export function ResponsiveDialog({title,children,className}:HTMLAttributes<HTMLElement>&{title:string}){return <section className={join("ui-responsive-dialog",className)} role="dialog" aria-modal="true" aria-label={title}>{children}</section>}
export function FilterSheet(props:HTMLAttributes<HTMLElement>){return <BottomSheet title="Filters" {...props}/>}
export function FullscreenChart({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={join("ui-fullscreen-chart",className)} {...props}/>}
