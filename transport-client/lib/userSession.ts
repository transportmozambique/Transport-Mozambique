import { NextResponse } from 'next/server';
import { createToken, idFromRequest, type SessionKind } from './signedToken';

/**
 * Sessão do passageiro: a entrada e o registo devolvem um token assinado, guardado com o
 * passageiro no localStorage e enviado como "Authorization: Bearer <token>" aos endpoints
 * /api/user, que só agem sobre os dados desse passageiro.
 */
const PASSENGER: SessionKind = { secretEnv: 'USER_SESSION_SECRET', maxAgeSeconds: 90 * 24 * 60 * 60 };

export function createUserToken(utenteId: string): string | null {
  return createToken(PASSENGER, utenteId);
}

/** O id do passageiro de um token "Authorization: Bearer" válido e não expirado; senão null. */
export function utenteIdFromRequest(request: Request): string | null {
  return idFromRequest(PASSENGER, request);
}

export function unauthorized() {
  return NextResponse.json({ error: 'Sessão inválida ou expirada. Entre de novo.' }, { status: 401 });
}
