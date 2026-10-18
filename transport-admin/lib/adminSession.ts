import { createHmac, timingSafeEqual } from "crypto";

/**
 * Sessão do administrador: um cookie assinado e HttpOnly, posto na entrada e verificado pelo
 * proxy.ts em cada pedido a /api. Formato do token: "<adminId>.<expiraEm>.<assinatura>".
 * Porquê HttpOnly: o JavaScript da página não o consegue ler, por isso um script injectado não rouba a sessão.
 */
export const SESSION_COOKIE = "admin_session";
const MAX_AGE_SECONDS = 12 * 60 * 60;

function secret(): string | null {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  // Sem segredo em produção, todas as sessões são recusadas (falha fechada)
  return process.env.NODE_ENV === "production" ? null : "dev-only-admin-session-secret";
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createSessionToken(adminId: string): string | null {
  const key = secret();
  if (!key) return null;
  const payload = `${adminId}.${Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS}`;
  return `${payload}.${sign(payload, key)}`;
}

/** Devolve o id do administrador quando o token é válido e não expirou. */
export function verifySessionToken(token: string | undefined): string | null {
  const key = secret();
  if (!key || !token) return null;
  const [adminId, expiresAt, signature] = token.split(".");
  if (!adminId || !expiresAt || !signature) return null;

  const expected = Buffer.from(sign(`${adminId}.${expiresAt}`, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expiresAt) < Date.now() / 1000) return null;
  return adminId;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
