import { NextResponse } from 'next/server';
import { createToken, idFromRequest, type SessionKind } from './signedToken';

/**
 * Passenger session: login and registration return a signed token, kept with the passenger in
 * localStorage and sent as "Authorization: Bearer <token>" to the /api/user endpoints, which only
 * act on that passenger's own data.
 */
const PASSENGER: SessionKind = { secretEnv: 'USER_SESSION_SECRET', maxAgeSeconds: 90 * 24 * 60 * 60 };

export function createUserToken(utenteId: string): string | null {
  return createToken(PASSENGER, utenteId);
}

/** The passenger id of a valid, unexpired "Authorization: Bearer" token, else null. */
export function utenteIdFromRequest(request: Request): string | null {
  return idFromRequest(PASSENGER, request);
}

export function unauthorized() {
  return NextResponse.json({ error: 'Sessão inválida ou expirada. Entre de novo.' }, { status: 401 });
}
