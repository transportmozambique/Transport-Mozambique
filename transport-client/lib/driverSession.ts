import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Driver portal session. The portal runs on another domain, so instead of a cookie the login
 * returns a signed token that the portal sends as "Authorization: Bearer <token>".
 * Token format: "<motoristaId>.<expiresAt>.<signature>".
 */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function secret(): string | null {
  if (process.env.DRIVER_SESSION_SECRET) return process.env.DRIVER_SESSION_SECRET;
  // Without a secret in production every session is rejected (fail closed)
  return process.env.NODE_ENV === 'production' ? null : 'dev-only-driver-session-secret';
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

export function createDriverToken(motoristaId: string): string | null {
  const key = secret();
  if (!key) return null;
  const payload = `${motoristaId}.${Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS}`;
  return `${payload}.${sign(payload, key)}`;
}

/** The driver id of a valid, unexpired "Authorization: Bearer" token, else null. */
export function driverIdFromRequest(request: Request): string | null {
  const key = secret();
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!key || !token) return null;
  const [motoristaId, expiresAt, signature] = token.split('.');
  if (!motoristaId || !expiresAt || !signature) return null;

  const expected = Buffer.from(sign(`${motoristaId}.${expiresAt}`, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expiresAt) < Date.now() / 1000) return null;
  return motoristaId;
}
