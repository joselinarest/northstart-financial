// Non-secret server settings only. Provider credentials stay in Secrets Manager.
import {appendFileSync} from 'node:fs';
const keys = ['ALPACA_CLOCK_BASE_URL', 'ALPACA_OPTIONS_FEED', 'OPENAI_MODEL', 'EMAIL_FROM', 'AUTO_MIGRATE_DATABASE', 'PLAID_LINK_CUSTOMIZATION_NAME', 'FAMILY_APPROVER_EMAILS', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_REALTIME_WS_URL'];
const lines = keys.filter(key => process.env[key]?.trim()).map(key => {
  const value = process.env[key].trim();
  if (/[\r\n"\\]/.test(value)) throw new Error(`Invalid single-line configuration: ${key}`);
  return `${key}="${value}"`;
});
if (lines.length) appendFileSync('.env.production', `\n${lines.join('\n')}\n`);
