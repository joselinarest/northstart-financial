import {Buffer} from 'node:buffer';
export type ConfigurationIssue={key:string;code:string};
/** Only field names/error codes may leave this module, never secret values. */
export function inspectServerConfiguration(env:Record<string,string|undefined>){
 const required:ConfigurationIssue[]=[],optional:ConfigurationIssue[]=[];
 if(!env.DATABASE_URL)required.push({key:'DATABASE_URL',code:'REQUIRED'});
 else {try{if(!['postgres:','postgresql:'].includes(new URL(env.DATABASE_URL).protocol))throw Error()}catch{required.push({key:'DATABASE_URL',code:'INVALID_POSTGRES_URL'})}}
 if(env.APP_URL){try{const url=new URL(env.APP_URL);if(!['http:','https:'].includes(url.protocol)||env.NODE_ENV==='production'&&url.protocol!=='https:'||url.username||url.password)throw Error()}catch{required.push({key:'APP_URL',code:'INVALID_APP_ORIGIN'})}}
 if(env.COGNITO_CLIENT_ID&&env.NEXT_PUBLIC_COGNITO_CLIENT_ID&&env.COGNITO_CLIENT_ID!==env.NEXT_PUBLIC_COGNITO_CLIENT_ID)required.push({key:'COGNITO_CLIENT_ID',code:'CLIENT_ALIAS_MISMATCH'});
 if(env.TOKEN_ENCRYPTION_KEY&&Buffer.from(env.TOKEN_ENCRYPTION_KEY,'base64').length!==32)optional.push({key:'TOKEN_ENCRYPTION_KEY',code:'EXPECTED_32_BYTE_BASE64'});
 for(const pair of [['ALPACA_API_KEY','ALPACA_API_SECRET'],['PLAID_CLIENT_ID','PLAID_SECRET'],['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY'],['OPTIONS_FLOW_PROVIDER_URL','OPTIONS_FLOW_PROVIDER_TOKEN']])if(pair.some(k=>env[k])&&!pair.every(k=>env[k]))optional.push({key:pair.join('+'),code:'INCOMPLETE_PROVIDER_CONFIGURATION'});
 if(env.PLAID_ENV&&!['sandbox','production'].includes(env.PLAID_ENV))optional.push({key:'PLAID_ENV',code:'UNSUPPORTED_ENVIRONMENT'});
 return {required,optional};
}
export function validateRequiredServerConfiguration(env=process.env){const result=inspectServerConfiguration(env);if(result.required.length)throw new Error('SERVER_CONFIGURATION_INVALID: '+result.required.map(i=>`${i.key}:${i.code}`).join(', '));return result;}
