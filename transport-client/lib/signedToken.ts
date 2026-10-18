import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Tokens de sessão assinados "<id>.<expiraEm>.<assinatura>" (HMAC-SHA256), enviados pelo navegador
 * como "Authorization: Bearer <token>". Usados no portal do motorista e pelos passageiros.
 * Porquê assim e não sessões na base de dados: verificar a assinatura não precisa de consulta, e
 * as funções serverless não guardam memória entre pedidos. Sem o segredo em produção, esse tipo
 * de sessão é recusado (falha fechada).
 */
export interface SessionKind {
  /** Variável de ambiente com o segredo HMAC */
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

/** O id de um token "Authorization: Bearer" válido e não expirado; senão null. */
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
