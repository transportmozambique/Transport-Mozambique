import { prisma } from './prisma';

/**
 * Passengers' phone numbers. USSD stores "+258…"; the web form used to store the number as typed,
 * spaces included ("+258 84 000 0000", as its placeholder shows). A number is matched on its
 * digits, with or without the 258 country code.
 */

/** The number without spaces or the country code: "84 000 0000" and "+258840000000" give "840000000" */
export function localPhone(raw: string) {
  return String(raw).replace(/\s+/g, '').replace(/^\+?258/, '');
}

/** The number as stored from now on: no spaces, and +258 in front of a Mozambican mobile number */
export function storedPhone(raw: string) {
  const local = localPhone(raw);
  return /^8\d{8}$/.test(local) ? `+258${local}` : String(raw).replace(/\s+/g, '');
}

/**
 * The id of the passenger with this number, however it was written, or null. Before numbers were
 * matched this way, one number could get two passengers (a USSD one and a website one): the one
 * with a password comes first.
 */
export async function findUtenteIdByPhone(raw: string): Promise<string | null> {
  const local = localPhone(raw);
  if (!local) return null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Utente"
    WHERE regexp_replace(regexp_replace(telefone, '\\s', '', 'g'), '^\\+?258', '') = ${local}
    ORDER BY (senha ~ '^\\$2[aby]\\$') DESC, "createdAt"
    LIMIT 1`;
  return rows[0]?.id ?? null;
}
