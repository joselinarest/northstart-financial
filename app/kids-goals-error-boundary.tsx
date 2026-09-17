"use client";

import React from "react";

type Props = { children: React.ReactNode };
type State = { error: string };

export default class KidsGoalsErrorBoundary extends React.Component<Props, State> {
  state: State = { error: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      error: error instanceof Error ? error.message : "The child planner could not render.",
    };
  }

  componentDidCatch(error: unknown) {
    console.error("Kids / Goals render failure", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="kids-render-error" role="alert">
        <b>Child planner could not load</b>
        <p>{this.state.error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload child planner
        </button>
      </section>
    );
  }
}
