import { createHash, randomBytes } from "node:crypto";

export const API_KEY_PREFIX = "vq_live_";

export function hashApiKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateApiKey() {
  const secret = randomBytes(32).toString("base64url");
  const token = `${API_KEY_PREFIX}${secret}`;
  return {
    token,
    hash: hashApiKey(token),
    prefix: token.slice(0, 16),
  };
}

export function bearerToken(header: string | null) {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  if (!token.startsWith(API_KEY_PREFIX)) return null;
  return token;
}
