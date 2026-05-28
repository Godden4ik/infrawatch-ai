/**
 * Opaque HMAC-signed session token for the shared-password gate.
 *
 * Token format: `${issuedAt}.${hex(hmac-sha256(issuedAt, secret))}`
 *
 * - `issuedAt` is ms-since-epoch when the token was minted.
 * - The HMAC is computed with a server-only secret.
 * - The cookie never contains the actual password, only an opaque
 *   non-reversible token.
 *
 * Edge-runtime compatible: uses Web Crypto (`crypto.subtle`), not Node's
 * `crypto` module.
 */

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12h, matches cookie maxAge

async function hmacSha256Hex(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string compare. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function issueAuthToken(secret: string): Promise<string> {
  const issuedAt = Date.now().toString();
  const mac = await hmacSha256Hex(issuedAt, secret);
  return `${issuedAt}.${mac}`;
}

export async function verifyAuthToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;

  const issuedAt = token.slice(0, dot);
  const mac = token.slice(dot + 1);

  const issuedAtNum = Number(issuedAt);
  if (!Number.isFinite(issuedAtNum)) return false;

  // Reject expired tokens.
  if (Date.now() - issuedAtNum > TOKEN_TTL_MS) return false;

  const expected = await hmacSha256Hex(issuedAt, secret);
  return timingSafeEqual(mac, expected);
}
