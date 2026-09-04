"use client";

const SESSION_KEY = "northstar-cognito-session";
const STATE_KEY = "northstar-cognito-state";
const VERIFIER_KEY = "northstar-cognito-verifier";
const NEXT_KEY = "northstar-cognito-next";

export type CognitoSession = {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
  name?: string;
};

const config = () => ({
  domain: (process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "").replace(/\/$/, ""),
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
});

const randomValue = (bytes = 48) => {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const decodeClaims = (token: string) => {
  const part = token.split(".")[1];
  if (!part) throw new Error("Cognito returned an invalid identity token.");
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  return JSON.parse(decodeURIComponent(Array.from(atob(normalized), char => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""))) as {email?:string;name?:string;exp?:number};
};

export const isCognitoConfigured = () => Boolean(config().domain && config().clientId);

export async function startCognitoLogin(identityProvider?: "Google" | "SignInWithApple") {
  const { domain, clientId } = config();
  if (!domain || !clientId) throw new Error("AWS Cognito environment variables are not configured.");
  const verifier = randomValue(64), state = randomValue(32);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const requestedPath=`${location.pathname}${location.search}${location.hash}`;
  sessionStorage.setItem(NEXT_KEY,requestedPath.startsWith("/")&&!requestedPath.startsWith("//")?requestedPath:"/workspace/dashboard");
  const params = new URLSearchParams({client_id:clientId,response_type:"code",scope:"openid email profile",redirect_uri:`${location.origin}/auth/callback`,state,code_challenge:challenge,code_challenge_method:"S256"});
  if (identityProvider) params.set("identity_provider", identityProvider);
  if(identityProvider==="Google")params.set("prompt","select_account");
  location.assign(`${domain}/oauth2/authorize?${params}`);
}

export async function completeCognitoLogin(code:string, state:string):Promise<{session:CognitoSession;next:string}> {
  const { domain, clientId } = config(), expectedState = sessionStorage.getItem(STATE_KEY), verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!domain || !clientId) throw new Error("AWS Cognito environment variables are not configured.");
  if (!state || state !== expectedState || !verifier) throw new Error("The sign-in response could not be verified. Please start again.");
  const body = new URLSearchParams({grant_type:"authorization_code",client_id:clientId,code,redirect_uri:`${location.origin}/auth/callback`,code_verifier:verifier});
  const response = await fetch(`${domain}/oauth2/token`, {method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
  const tokens = await response.json() as {id_token?:string;access_token?:string;refresh_token?:string;expires_in?:number;error_description?:string;error?:string};
  if (!response.ok || !tokens.id_token || !tokens.access_token) throw new Error(tokens.error_description || tokens.error || "Cognito could not complete sign-in.");
  const claims = decodeClaims(tokens.id_token);
  const session:CognitoSession = {idToken:tokens.id_token,accessToken:tokens.access_token,refreshToken:tokens.refresh_token,expiresAt:(claims.exp || Math.floor(Date.now()/1000)+(tokens.expires_in||3600))*1000,email:claims.email,name:claims.name};
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const requested = sessionStorage.getItem(NEXT_KEY) || "/workspace/dashboard";
  [STATE_KEY,VERIFIER_KEY,NEXT_KEY].forEach(key=>sessionStorage.removeItem(key));
  return {session,next:requested.startsWith("/")&&!requested.startsWith("//")?requested:"/workspace/dashboard"};
}

export function getCognitoSession():CognitoSession|null {
  try { const raw=sessionStorage.getItem(SESSION_KEY); if(!raw)return null; const session=JSON.parse(raw) as CognitoSession; if(!session.idToken||session.expiresAt<=Date.now()){sessionStorage.removeItem(SESSION_KEY);return null} return session; } catch { sessionStorage.removeItem(SESSION_KEY); return null; }
}

export function signOutCognito() {
  const {domain,clientId}=config();
  sessionStorage.removeItem(SESSION_KEY);
  if(domain&&clientId){const params=new URLSearchParams({client_id:clientId,logout_uri:location.origin});location.assign(`${domain}/logout?${params}`)}else location.assign("/");
}
