"use client";
import {Component,type ErrorInfo,type ReactNode} from "react";
import RealEstateWorkspace from "./real-estate-workspace";

class PropertyWorkspaceBoundary extends Component<{children:ReactNode},{failed:boolean,message:string}>{
 state={failed:false,message:""};
 static getDerivedStateFromError(error:Error){return{failed:true,message:error.message}}
 componentDidCatch(error:Error,info:ErrorInfo){console.error("Real Estate workspace failed",error,info)}
 render(){return this.state.failed?<section className="property-module-error" role="alert"><span>PROPERTY DATA RECOVERY</span><h3>The property workspace could not finish loading</h3><p>Your saved property records were not changed. Refresh this module after the current deployment or database migration completes.</p><small>{this.state.message}</small><button type="button" onClick={()=>this.setState({failed:false,message:""})}>Retry property workspace</button></section>:this.props.children}
}

export default function RealEstateCommandCenter(){return <section className="real-estate-command-center">
 <header className="property-command-head"><div><span>HOUSEHOLD REAL ESTATE</span><h2>Property portfolio command center</h2><p>Track where you live, rental operations, property-linked cash flow, debt, reserves, projects, and potential purchases in one place.</p></div><div className="property-command-actions"><a href="#owned-properties">Manage properties</a><a href="#property-opportunities">Analyze a purchase</a></div></header>
 <div className="property-workflow-grid" aria-label="Real estate workflows">
  <article><i>01</i><div><b>Owned & occupied</b><p>Home value, mortgage, equity, insurance, maintenance, affordability, and sell/hold timing.</p></div></article>
  <article><i>02</i><div><b>Rental operations</b><p>Rent, occupancy, expenses, reserves, repairs, NOI, cash flow, cap rate, and tenant activity.</p></div></article>
  <article><i>03</i><div><b>Payment accounts</b><p>Connect central Household accounts to each property without duplicating transactions.</p></div></article>
  <article><i>04</i><div><b>Buy / sell decisions</b><p>Model financing, downside, returns, household safety, due diligence, and maximum offer.</p></div></article>
 </div>
 <div id="owned-properties"><PropertyWorkspaceBoundary><RealEstateWorkspace/></PropertyWorkspaceBoundary></div>
 </section>}
