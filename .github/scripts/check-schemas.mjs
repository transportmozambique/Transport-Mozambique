// The three copies of the Prisma schema must describe the same database. prisma/schema.prisma is
// the source of truth; transport-client's copy and transport-admin's (whose generator block adds
// the omitApi preview feature) must match it, comments and spacing aside. Exits 1 when they differ.
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
    console.log(`${copy}: same as ${source}`);
    continue;
  }
  failed = true;
  const i = at === -1 ? Math.min(lines.length, expected.length) : at;
  console.log(`${copy} differs from ${source}:\n  ${source}: ${expected[i] ?? '(end)'}\n  ${copy}: ${lines[i] ?? '(end)'}`);
}
process.exit(failed ? 1 : 0);
