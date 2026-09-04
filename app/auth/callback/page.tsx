"use client";

import { useEffect, useState } from "react";
import { completeCognitoLogin } from "@/lib/cognito-client";

export default function AuthCallback() {
  const [message, setMessage] = useState("Completing secure sign-in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search), code = params.get("code"), state=params.get("state"), error = params.get("error_description") || params.get("error");
    if (error) { setMessage(`Sign-in was not completed: ${error}`); return; }
    if (!code) { setMessage("The authentication response did not contain a secure authorization code."); return; }
    completeCognitoLogin(code,state||"").then(({next})=>window.location.replace(next)).catch(error=>setMessage(`Unable to complete sign-in: ${error instanceof Error?error.message:"Unknown error"}`));
  }, []);

  return <main className="recovery-page"><section><span>N</span><p>NORTHSTAR SECURE ACCESS</p><h1>AWS Cognito authentication</h1><p role="status">{message}</p><div><button onClick={() => window.location.replace("/")}>Return to sign in</button></div><small>Passwords and federated identity are handled by AWS Cognito.</small></section></main>;
}
