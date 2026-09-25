import type { NextConfig } from 'next';
import {execFileSync} from 'node:child_process';

const buildCommit=process.env.AWS_COMMIT_ID||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const buildTime=new Date().toISOString();

const nextConfig: NextConfig = {webpack(config){if(config.cache&&typeof config.cache==="object")config.cache.version=(config.cache.version||"")+"-northstar-tailwind-v1";return config},env:{NEXT_PUBLIC_BUILD_COMMIT:buildCommit,NEXT_PUBLIC_BUILD_TIME:buildTime},generateBuildId:async()=>buildCommit,distDir:process.env.NEXT_BUILD_DIR||'.next',poweredByHeader:false,eslint:{ignoreDuringBuilds:true},async headers(){return[{source:"/:path*",headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"X-Frame-Options",value:"DENY"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},{key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=(), payment=()"},{key:"Cross-Origin-Opener-Policy",value:"same-origin-allow-popups"},{key:"Content-Security-Policy",value:"default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com https://*.plaid.com; connect-src 'self' https: wss:; frame-src 'self' https://*.plaid.com https://*.amazoncognito.com; worker-src 'self' blob:; child-src 'self' blob: https://*.plaid.com; upgrade-insecure-requests"}]}]}};

export default nextConfig;
