import { createToken, idFromRequest, type SessionKind } from './signedToken';

/**
 * Sessão do portal do motorista. O portal corre noutro domínio, por isso, em vez de um cookie
 * (que o navegador não enviaria entre domínios), a entrada devolve um token assinado que o portal
 * envia como "Authorization: Bearer <token>".
 */
const DRIVER: SessionKind = { secretEnv: 'DRIVER_SESSION_SECRET', maxAgeSeconds: 30 * 24 * 60 * 60 };

export function createDriverToken(motoristaId: string): string | null {
  return createToken(DRIVER, motoristaId);
}

/** O id do motorista de um token "Authorization: Bearer" válido e não expirado; senão null. */
export function driverIdFromRequest(request: Request): string | null {
  return idFromRequest(DRIVER, request);
}
