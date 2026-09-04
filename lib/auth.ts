type Claims={sub:string;email?:string;name?:string;"cognito:username"?:string;aud?:string|string[];client_id?:string;token_use?:"id"|"access";exp:number;iss:string};
let jwksCache:{keys:JsonWebKey[];expires:number}|null=null;
const decode=(value:string)=>{const normalized=value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"=");return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(normalized),c=>c.charCodeAt(0))))};
async function verifyCognitoJwt(token:string):Promise<Claims>{
  const region=process.env.AWS_REGION,poolId=process.env.COGNITO_USER_POOL_ID,issuer=(process.env.COGNITO_ISSUER||(region&&poolId?`https://cognito-idp.${region}.amazonaws.com/${poolId}`:"")).replace(/\/$/,""),clientId=process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID||process.env.COGNITO_CLIENT_ID;
  if(!issuer)throw new Error("AWS Cognito token verification is missing COGNITO_ISSUER");
  if(!clientId)throw new Error("AWS Cognito token verification is missing COGNITO_CLIENT_ID");
  const [h,p,s]=token.split(".");if(!h||!p||!s)throw new Error("Invalid token");
  const header=decode(h) as {kid?:string;alg?:string},claims=decode(p) as Claims;
  if(header.alg!=="RS256"||!header.kid)throw new Error("Unsupported token algorithm");
  if(claims.iss!==issuer||claims.exp*1000<=Date.now())throw new Error("Expired or invalid token");
  const audience=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(claims.token_use==="id"&&!audience.includes(clientId))throw new Error("Invalid identity token audience");
  if(claims.token_use==="access"&&claims.client_id!==clientId)throw new Error("Invalid access token client");
  if(!["id","access"].includes(claims.token_use||""))throw new Error("Invalid Cognito token use");
  if(!jwksCache||jwksCache.expires<Date.now()){const response=await fetch(`${issuer}/.well-known/jwks.json`);if(!response.ok)throw new Error("Unable to verify identity");jwksCache={keys:((await response.json()) as {keys:JsonWebKey[]}).keys,expires:Date.now()+3600000}}
  const jwk=jwksCache.keys.find(item=>(item as JsonWebKey&{kid?:string}).kid===header.kid);if(!jwk)throw new Error("Unknown signing key");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]),signature=Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
  if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,signature,new TextEncoder().encode(`${h}.${p}`)))throw new Error("Invalid token signature");return claims;
}
export async function requireUser(request:Request){const url=new URL(request.url),local=["localhost","127.0.0.1"].includes(url.hostname),auth=request.headers.get("authorization");if(auth?.startsWith("Bearer ")){try{const claims=await verifyCognitoJwt(auth.slice(7));return{userId:claims.sub,email:claims.email||`${claims.sub}@private.invalid`,name:claims.name||claims.email?.split("@")[0]||claims["cognito:username"]||"Account Owner"}}catch(error){throw new Response(JSON.stringify({error:error instanceof Error?error.message:"Authentication failed"}),{status:401,headers:{"Content-Type":"application/json"}})}}if(local&&process.env.ALLOW_LOCAL_DEV_AUTH==="true")return{userId:"local_owner",email:"owner@localhost",name:"Local Owner"};throw new Response(JSON.stringify({error:"Authentication required"}),{status:401,headers:{"Content-Type":"application/json"}})}
