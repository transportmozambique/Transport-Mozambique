import { createToken, idFromRequest, type SessionKind } from './signedToken';

/**
 * Driver portal session. The portal runs on another domain, so instead of a cookie the login
 * returns a signed token that the portal sends as "Authorization: Bearer <token>".
 */
const DRIVER: SessionKind = { secretEnv: 'DRIVER_SESSION_SECRET', maxAgeSeconds: 30 * 24 * 60 * 60 };

export function createDriverToken(motoristaId: string): string | null {
  return createToken(DRIVER, motoristaId);
}

/** The driver id of a valid, unexpired "Authorization: Bearer" token, else null. */
export function driverIdFromRequest(request: Request): string | null {
  return idFromRequest(DRIVER, request);
}
