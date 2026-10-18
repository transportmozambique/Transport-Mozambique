import { prisma } from './prisma';

/**
 * Números de telefone dos passageiros. O USSD guarda "+258…"; o formulário web guardava o número
 * como escrito, com espaços ("+258 84 000 0000", como o exemplo do campo mostra). Um número é
 * comparado pelos seus dígitos, com ou sem o indicativo 258.
 */

/** O número sem espaços nem indicativo: "84 000 0000" e "+258840000000" dão "840000000" */
export function localPhone(raw: string) {
  return String(raw).replace(/\s+/g, '').replace(/^\+?258/, '');
}

/** O número como passa a ser guardado: sem espaços, e +258 à frente de um número móvel moçambicano */
export function storedPhone(raw: string) {
  const local = localPhone(raw);
  return /^8\d{8}$/.test(local) ? `+258${local}` : String(raw).replace(/\s+/g, '');
}

/**
 * O id do passageiro com este número, seja como for que foi escrito, ou null. Antes de os números
 * serem comparados assim, um número podia ter dois passageiros (um do USSD e um do site): o que
 * tem palavra-passe vem primeiro.
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
