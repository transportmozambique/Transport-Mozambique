import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Phones are stored as typed, often with spaces ("+258 84 123 4567"), so a search for "841234"
 * would not find them with a plain `contains`. When the search is a phone number (digits, spaces,
 * "+", "-"), this returns the ids of the rows whose phone, digits only, contains those digits
 * (also without a leading 258). Otherwise it returns [] and the usual text search applies.
 */
export async function idsByPhoneDigits(table: 'Motorista' | 'Utente', search: string): Promise<string[]> {
  if (!/^[\d\s+\-()]+$/.test(search)) return [];
  const digits = search.replace(/\D/g, '');
  if (digits.length < 3) return [];
  const variants = [digits];
  if (digits.startsWith('258') && digits.length > 6) variants.push(digits.slice(3));

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM ${Prisma.raw(`"${table}"`)}
    WHERE regexp_replace(telefone, '[^0-9]', '', 'g') LIKE ANY (${variants.map((v) => `%${v}%`)})
    LIMIT 500`;
  return rows.map((r) => r.id);
}
