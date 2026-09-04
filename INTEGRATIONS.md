# Northstar integration checklist

Northstar is read-only. Do not grant trading, transfer, withdrawal, or money-movement scopes to any provider.

## Required for production

| Service | Purpose | Environment values |
|---|---|---|
| OpenAI Platform | Investment Coach analysis through the Responses API | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| AWS Cognito | Managed login, Google/Apple federation, MFA and signed JWTs | `AWS_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_ISSUER`, `COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_DOMAIN` |
| Plaid | Read-only bank, card, transaction, liability and investment sync | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_PRODUCTS`, `PLAID_COUNTRY_CODES`, `PLAID_WEBHOOK_URL` |
| Northstar server | Encrypt provider access tokens | `TOKEN_ENCRYPTION_KEY` (32 random bytes, base64 encoded) |
| AWS PostgreSQL | Sole relational database and private Academy PDF storage | `DATABASE_URL`, `DATABASE_POOL_MAX`, `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED` |

### AWS PostgreSQL note

`DATABASE_URL` is server-only and must never be exposed with a `NEXT_PUBLIC_` prefix. Use an AWS security group that permits only the application network, require TLS, rotate the database password, and use a least-privilege application user rather than the PostgreSQL administrator account.

Northstar now reads and writes exclusively through AWS PostgreSQL. The application initializes its required tables on first database access. Academy PDFs are stored privately in the `documents.data` `BYTEA` column; no R2 or other object store is used.

Deploy the Next.js server in an environment with private network access to the RDS/Aurora endpoint, such as AWS App Runner, ECS/Fargate, Elastic Beanstalk, or Amplify with the appropriate VPC configuration. Require TLS, restrict the RDS security group to the application, rotate credentials with AWS Secrets Manager, and use a least-privilege application user.

If `DATABASE_SSL_REJECT_UNAUTHORIZED=false`, traffic remains encrypted but the client does not verify the database server's identity. Use this only behind a trusted private AWS network and a tightly restricted security group; certificate verification remains the stronger production configuration.

## Market and research data

| Service | Purpose | Environment values |
|---|---|---|
| Alpaca Market Data | Quotes, bars, clock and indicative/OPRA options data | `ALPACA_API_KEY`, `ALPACA_API_SECRET`, `ALPACA_DATA_FEED`, `ALPACA_CLOCK_BASE_URL`, `ALPACA_OPTIONS_FEED` |
| Finnhub | Company fundamentals, filings and company news expansion | `FINNHUB_API_KEY` |
| FRED | Rates, yields and macroeconomic series | `FRED_API_KEY` |
| NewsAPI.ai / Event Registry | Structured market-news discovery; verify material claims with primary sources | `NEWSAPI_AI_KEY` (preferred) or `NEWS_API_KEY` (compatible) |
| YouTube Data API | Academy video discovery | `YOUTUBE_API_KEY` |

## Communication and reliability

| Service | Purpose | Environment values |
|---|---|---|
| Twilio Verify | SMS verification | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` |
| Resend | Transactional email and alerts | `RESEND_API_KEY`, `EMAIL_FROM` |
| Web Push | Browser notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Scheduler | Protected synchronization jobs | `CRON_SECRET` |
| Sentry | Production error monitoring | `SENTRY_DSN` |

Use `.env.local` for local secrets. Never add real credentials to `.env.example`, client-side variables, screenshots, or commits. The app reports `not_configured` until each provider is available; it does not substitute fabricated live data.

## AWS Cognito authentication

1. Create a Cognito user pool and a **public** app client without a client secret. Enable authorization-code grant and the `openid`, `email`, and `profile` scopes.
2. Create a Cognito managed-login domain. Set `NEXT_PUBLIC_COGNITO_DOMAIN` to its full HTTPS URL, and set both client-ID variables to the app client ID.
   In AWS Amplify Hosting, add `NEXT_PUBLIC_COGNITO_DOMAIN` and `NEXT_PUBLIC_COGNITO_CLIENT_ID` under **Hosting → Environment variables** for the production branch. The committed build specification copies only these public values into `.env.production` before `next build`; missing values now stop deployment with a precise error instead of publishing a disabled sign-in button.
3. Add `http://localhost:3100/auth/callback` and the production equivalent to allowed callback URLs. Add `http://localhost:3100` and the production origin to allowed sign-out URLs.
4. Set `COGNITO_USER_POOL_ID`, `AWS_REGION`, and `COGNITO_ISSUER`; the issuer format is `https://cognito-idp.REGION.amazonaws.com/USER_POOL_ID`.
5. For Google, create a Web OAuth client in Google Cloud. Its authorized redirect URI is `https://YOUR_COGNITO_DOMAIN/oauth2/idpresponse`. Store the Google client ID and secret in Cognito, enable the Google provider on the app client, and map `email` and `name`.
6. Configure Apple in Cognito in the same way before exposing Apple login in production. Cognito controls password policy, account recovery, MFA, passkeys, and email verification.

Northstar uses OAuth Authorization Code + PKCE. `/auth/callback` verifies the one-time state, exchanges the code directly with Cognito, stores the short-lived session in browser session storage, and sends Cognito JWTs to the server. The server verifies signature, issuer, expiration, token use, and app-client audience against Cognito JWKS.
