"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Northstar route error", error); }, [error]);
  return <main className="recovery-page">
    <section>
      <span>N</span>
      <p>NORTHSTAR RECOVERY</p>
      <h1>The dashboard needs to reconnect.</h1>
      <p>Your saved financial information was not deleted. This usually happens when the local app updates while an older tab is still open.</p>
      <div><button onClick={reset}>Try again</button><button onClick={() => window.location.reload()}>Reload Northstar</button></div>
      {error.digest && <small>Reference: {error.digest}</small>}
    </section>
  </main>;
}
