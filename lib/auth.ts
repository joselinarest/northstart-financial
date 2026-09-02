type Claims = { sub:string; email?:string; name?:string; aud?:string|string[]; exp:number; iss:string };
let jwksCache: { keys: JsonWebKey[]; expires:number } | null = null;
const decode=(value:string)=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0))));
async function verifySupabaseJwt(token:string):Promise<Claims>{
  const issuer=process.env.SUPABASE_JWT_ISSUER || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;
  if(!issuer || issuer.startsWith("undefined")) throw new Error("Authentication is not configured");
  const [h,p,s]=token.split("."); if(!h||!p||!s) throw new Error("Invalid token");
  const header=decode(h) as {kid?:string;alg?:string}; const claims=decode(p) as Claims;
  if(header.alg!=="RS256" || !header.kid) throw new Error("Unsupported token algorithm");
  if(claims.iss!==issuer || claims.exp*1000<=Date.now()) throw new Error("Expired or invalid token");
  const audience=Array.isArray(claims.aud)?claims.aud:[claims.aud]; if(!audience.includes("authenticated")) throw new Error("Invalid token audience");
  if(!jwksCache || jwksCache.expires<Date.now()){const response=await fetch(`${issuer}/.well-known/jwks.json`);if(!response.ok)throw new Error("Unable to verify identity");jwksCache={keys:((await response.json()) as {keys:JsonWebKey[]}).keys,expires:Date.now()+3600000};}
  const jwk=jwksCache.keys.find(k=>(k as JsonWebKey & {kid?:string}).kid===header.kid); if(!jwk) throw new Error("Unknown signing key");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);const signature=Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
  if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,signature,new TextEncoder().encode(`${h}.${p}`)))throw new Error("Invalid token signature");return claims;
}
export async function requireUser(request:Request){const url=new URL(request.url);const local=["localhost","127.0.0.1"].includes(url.hostname);if(local&&process.env.ALLOW_LOCAL_DEV_AUTH==="true")return{userId:"local_owner",email:"owner@localhost",name:"Local Owner"};const auth=request.headers.get("authorization");if(!auth?.startsWith("Bearer "))throw new Response(JSON.stringify({error:"Authentication required"}),{status:401,headers:{"Content-Type":"application/json"}});try{const c=await verifySupabaseJwt(auth.slice(7));return{userId:c.sub,email:c.email||`${c.sub}@private.invalid`,name:c.name||c.email?.split("@")[0]||"Account Owner"}}catch(error){throw new Response(JSON.stringify({error:error instanceof Error?error.message:"Authentication failed"}),{status:401,headers:{"Content-Type":"application/json"}})}}
