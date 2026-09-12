import { NorthstarWorkspace } from "@/app/northstar-workspace";

export const dynamic = "force-dynamic";

/**
 * Plaid OAuth institutions (including Chase) return to this exact route with
 * an oauth_state_id. Rendering the Accounts workspace here preserves the full
 * received redirect URI so Plaid Link can resume the original Link session.
 */
export default function PlaidOAuthCallback() {
  return <NorthstarWorkspace initialTab="Accounts" />;
}
