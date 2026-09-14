import { createHash, createPublicKey, verify } from "node:crypto";
import { loadRuntimeSecrets } from "@/lib/runtime-secrets";

const host = () =>
  process.env.PLAID_ENV === "production"
    ? "https://production.plaid.com"
    : process.env.PLAID_ENV === "development"
      ? "https://development.plaid.com"
      : "https://sandbox.plaid.com";
const decode = (value: string) =>
  JSON.parse(
    Buffer.from(
      value.replace(/-/g, "+").replace(/_/g, "/"),
      "base64url",
    ).toString("utf8"),
  );

export async function verifyPlaidWebhook(
  rawBody: string,
  token: string | null,
) {
  await loadRuntimeSecrets();
  if (!token || !process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET)
    return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const header = decode(parts[0]),
    claims = decode(parts[1]);
  if (
    header.alg !== "ES256" ||
    !header.kid ||
    Math.abs(Date.now() / 1000 - Number(claims.iat || 0)) > 300
  )
    return false;
  const keyResponse = await fetch(`${host()}/webhook_verification_key/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      key_id: header.kid,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!keyResponse.ok) return false;
  const body = (await keyResponse.json()) as { key?: JsonWebKey };
  if (!body.key) return false;
  const digest = createHash("sha256").update(rawBody).digest("hex");
  if (digest !== claims.request_body_sha256) return false;
  return verify(
    "sha256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    {
      key: createPublicKey({ key: body.key as import("node:crypto").JsonWebKey, format: "jwk" }),
      dsaEncoding: "ieee-p1363",
    },
    Buffer.from(parts[2], "base64url"),
  );
}
