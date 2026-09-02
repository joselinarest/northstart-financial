"use client";

export default function GlobalError() {
  return <html lang="en"><body><main className="recovery-page"><section><span>N</span><p>NORTHSTAR RECOVERY</p><h1>A required app file did not load.</h1><p>Reload the page to replace the old local bundle with the current version.</p><button onClick={() => window.location.reload()}>Reload Northstar</button></section></main></body></html>;
}
