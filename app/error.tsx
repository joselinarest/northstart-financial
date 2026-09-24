"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Northstar route error", error); }, [error]);
  return <main className="recovery-page">
    <section>
      <span>N</span>
      <p>NORTHSTAR RECOVERY</p>
      <h1>This view could not be displayed.</h1>
      <p>Your saved financial information was not deleted. Try loading this view again. If the issue repeats, report the action that triggered it.</p>
      <div><button onClick={reset}>Try again</button><button onClick={() => window.location.reload()}>Reload Northstar</button></div>
      {error.digest && <small>Reference: {error.digest}</small>}
    </section>
  </main>;
}
