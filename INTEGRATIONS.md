# Northstar integration checklist

Northstar is read-only. Do not grant trading, transfer, withdrawal, or money-movement scopes to any provider.

## Required for production

| Service | Purpose | Environment values |
|---|---|---|
| OpenAI Platform | Investment Coach analysis through the Responses API | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Supabase | Google, Apple, email/SMS identity and signed JWTs | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_JWT_ISSUER` |
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
| NewsAPI | Broad headline discovery; verify material claims with primary sources | `NEWS_API_KEY` |
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
