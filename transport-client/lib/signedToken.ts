import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed session tokens "<id>.<expiresAt>.<signature>" (HMAC-SHA256), sent by the browser as
 * "Authorization: Bearer <token>". Used for the driver portal and for passengers.
 * Without its secret in production a session kind is refused (fail closed).
 */
export interface SessionKind {
  /** Environment variable holding the HMAC secret */
  secretEnv: string;
  maxAgeSeconds: number;
}

function secret(kind: SessionKind): string | null {
  const value = process.env[kind.secretEnv];
  if (value) return value;
  return process.env.NODE_ENV === 'production' ? null : `dev-only-${kind.secretEnv}`;
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

export function createToken(kind: SessionKind, id: string): string | null {
  const key = secret(kind);
  if (!key) return null;
  const payload = `${id}.${Math.floor(Date.now() / 1000) + kind.maxAgeSeconds}`;
  return `${payload}.${sign(payload, key)}`;
}

/** The id in a valid, unexpired "Authorization: Bearer" token, else null. */
export function idFromRequest(kind: SessionKind, request: Request): string | null {
  const key = secret(kind);
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!key || !token) return null;
  const [id, expiresAt, signature] = token.split('.');
  if (!id || !expiresAt || !signature) return null;

  const expected = Buffer.from(sign(`${id}.${expiresAt}`, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expiresAt) < Date.now() / 1000) return null;
  return id;
}
