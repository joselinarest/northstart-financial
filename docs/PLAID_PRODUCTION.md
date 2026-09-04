# Plaid production setup

Northstar is configured to use `https://production.plaid.com` when `PLAID_ENV=production`.

## Required credentials and dashboard configuration

- `PLAID_CLIENT_ID`: Plaid client ID.
- `PLAID_SECRET`: the Production secret, not the Sandbox secret.
- `PLAID_PRODUCTS=transactions,investments,liabilities`: enable and obtain Production approval for every requested product.
- `PLAID_COUNTRY_CODES=US`: change only when the application and institutions support another country.
- `PLAID_WEBHOOK_URL`: a public HTTPS endpoint for the deployed application. Localhost cannot receive Plaid webhooks.
- `PLAID_REDIRECT_URI`: the public HTTPS OAuth return page, for example `https://your-domain.example/plaid/oauth`. Add the exact URI to Plaid Dashboard under **Developers → API → Allowed redirect URIs**.
- Add the deployed HTTPS callback/domain to the allowed redirect URI list in Plaid Dashboard when OAuth institutions are used.

## Transition rules

1. Restart the Next.js process after changing environment variables.
2. Do not complete Production OAuth inside an embedded/in-app webview. Use a normal supported browser or the deployed application.
3. Sandbox and Development access tokens do not work against Production.
4. Connect each real institution again through Plaid Link after signing in to Northstar.
5. Confirm that the consent screen requests only read-only products.
6. Run **Sync now** and verify accounts, transactions, liabilities, holdings, timestamps, and owner attribution.
7. Never copy access tokens into browser-visible variables or logs. Northstar encrypts them server-side.

Existing Sandbox records may remain in the local database until explicitly removed. They are not live Production connections and should not be included in financial decisions. Use the connection's **Remove** action only after confirming the exact test connection.

## Production deployment requirements

- HTTPS is mandatory.
- Use a strong, stable `TOKEN_ENCRYPTION_KEY` stored in the deployment secret manager.
- Use AWS Cognito production callback and logout URLs for the deployed domain.
- Restrict database network access, require TLS, enable backups, and rotate secrets.
- Configure monitoring for Plaid errors and webhook failures.
- Verify provider timestamps and show unavailable states instead of substituting illustrative values.
