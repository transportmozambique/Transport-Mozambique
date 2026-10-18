// As três cópias do esquema Prisma têm de descrever a mesma base de dados. prisma/schema.prisma é a
// referência; a cópia do transport-client e a do transport-admin (cujo bloco generator junta a
// funcionalidade omitApi) têm de ser iguais a ela, sem contar comentários e espaços. Sai com 1
// quando diferem. Porquê três cópias: cada aplicação é publicada sozinha na Vercel e gera o seu cliente.
//
//   node .github/scripts/check-schemas.mjs
import fs from 'node:fs';

const normalise = (file) =>
  fs
    .readFileSync(file, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/^generator client \{[\s\S]*?^\}/m, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const source = 'prisma/schema.prisma';
const expected = normalise(source);
let failed = false;
for (const copy of ['transport-client/prisma/schema.prisma', 'transport-admin/prisma/schema.prisma']) {
  const lines = normalise(copy);
  const at = expected.findIndex((line, i) => line !== lines[i]);
  if (at === -1 && lines.length === expected.length) {
    console.log(`${copy}: igual a ${source}`);
    continue;
  }
  failed = true;
  const i = at === -1 ? Math.min(lines.length, expected.length) : at;
  console.log(`${copy} difere de ${source}:\n  ${source}: ${expected[i] ?? '(fim)'}\n  ${copy}: ${lines[i] ?? '(fim)'}`);
}
process.exit(failed ? 1 : 0);
