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

/**
 * Constant-time string compare.
 *
 * Iterates a fixed minimum length regardless of input lengths, and folds
 * the length difference itself into the diff, so the runtime and branch
 * pattern are independent of either operand's length. Safe to call with
 * attacker-controlled `a` against server-side `b`.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const FIXED_MIN = 64;
  const len = Math.max(a.length, b.length, FIXED_MIN);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ac = i < a.length ? a.charCodeAt(i) : 0;
    const bc = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ac ^ bc;
  }
  return diff === 0;
}

/**
 * Length-independent password comparison. HMACs both inputs with the
 * server secret so the comparison happens between two equal-length
 * (64-hex-char) digests. Neither length nor prefix of the expected
 * password leaks to the caller.
 */
export async function timingSafeCompareHashed(
  a: string,
  b: string,
  secret: string,
): Promise<boolean> {
  const [aMac, bMac] = await Promise.all([
    hmacSha256Hex(a, secret),
    hmacSha256Hex(b, secret),
  ]);
  return timingSafeEqual(aMac, bMac);
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
  // Both `mac` and `expected` are 64-hex-char strings from sha256 — no
  // length leak risk; this `timingSafeEqual` is safe here.
  return timingSafeEqual(mac, expected);
}
