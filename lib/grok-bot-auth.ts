import { createHash, timingSafeEqual } from "node:crypto";

function parseBearerToken(authorizationHeader: string | null | undefined) {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(\S+)/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}

export function hasValidGrokBotBearer(authorizationHeader: string | null | undefined) {
  const secret = process.env.GROK_BOT_SECRET;
  const token = parseBearerToken(authorizationHeader);

  if (!secret || !token) {
    return false;
  }

  const expected = createHash("sha256").update(secret).digest();
  const provided = createHash("sha256").update(token).digest();
  return timingSafeEqual(expected, provided);
}
