import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Os telefones estão guardados como foram escritos, muitas vezes com espaços ("+258 84 123 4567"),
 * por isso uma pesquisa por "841234" não os encontraria com um simples `contains`. Quando a pesquisa
 * é um número de telefone (algarismos, espaços, "+", "-"), isto devolve os ids das linhas cujo
 * telefone, só algarismos, contém esses algarismos (também sem o 258 à frente). Senão devolve [] e
 * aplica-se a pesquisa de texto habitual.
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
