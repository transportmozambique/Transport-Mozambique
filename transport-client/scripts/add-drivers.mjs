#!/usr/bin/env node
/**
 * Gives every vehicle without a driver a demo driver, like the 111 drivers of the first data.
 *
 *   node scripts/add-drivers.mjs                        # dry run: what would be created
 *   node scripts/add-drivers.mjs --apply                # write to DATABASE_URL (local databases only)
 *   node scripts/add-drivers.mjs --apply --production   # also allows a remote database
 *
 * Each driver gets a name from common Mozambican first names and surnames, and the same kind of
 * record as the existing demo drivers: BI 1102…, licence CC-<year>-…, an @transport.co.mz email,
 * a phone, an address, an emergency contact and dates, status "ativo", assigned to the vehicle.
 * No photo (the apps show the initials) and no PIN: an administrator generates the PIN when the
 * driver is to sign in. The numbers continue after the highest existing ones, so nothing clashes,
 * and the same data gives the same drivers (a fixed seed).
 *
 * --apply first saves every Motorista row to osm-data/backup-drivers-<time>.json, and afterwards
 * lists the created drivers' ids in osm-data/created-drivers-<time>.json (to undo: delete those).
 * Running it again creates nothing: every vehicle then has a driver.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DATA = path.resolve(option('--data', path.join(__dirname, '..', 'osm-data')));

const MALE = ['Abel', 'Adelino', 'Alberto', 'Alfredo', 'Amade', 'Américo', 'Armando', 'Arsénio', 'Benedito', 'Bernardo', 'Carlos', 'Celso', 'Domingos', 'Edson', 'Elias', 'Ernesto', 'Eusébio', 'Felisberto', 'Fernando', 'Filipe', 'Francisco', 'Gervásio', 'Hélder', 'Henrique', 'Inácio', 'Isaías', 'Jacinto', 'Joaquim', 'Jorge', 'José', 'Júlio', 'Laurindo', 'Lourenço', 'Luís', 'Manuel', 'Marcelino', 'Mário', 'Moisés', 'Narciso', 'Nelson', 'Orlando', 'Paulo', 'Pedro', 'Raimundo', 'Rui', 'Samuel', 'Sérgio', 'Simão', 'Tomás', 'Valter', 'Xavier', 'Zacarias'];
const FEMALE = ['Alda', 'Amélia', 'Ana', 'Anabela', 'Celeste', 'Cristina', 'Delfina', 'Ermelinda', 'Esperança', 'Fátima', 'Graça', 'Helena', 'Isabel', 'Joana', 'Luísa', 'Marta', 'Neusa', 'Olga', 'Rosa', 'Sara', 'Telma', 'Vitória'];
const SURNAMES = ['Bila', 'Chambal', 'Chaúque', 'Chilaule', 'Chissano', 'Chivambo', 'Cossa', 'Cuambe', 'Guambe', 'Langa', 'Macamo', 'Machava', 'Macuácua', 'Magaia', 'Maluleque', 'Manhiça', 'Massingue', 'Matsinhe', 'Matusse', 'Mavie', 'Mazive', 'Mondlane', 'Muianga', 'Mungoi', 'Nhantumbo', 'Nhavoto', 'Nhaca', 'Nkavele', 'Sitoe', 'Tembe', 'Ubisse', 'Uamusse', 'Zandamela', 'Zimba', 'Zitha'];
const MARITAL = ['Solteiro', 'Casado', 'Casado', 'Divorciado', 'Viúvo'];
const PLACES = ['Maputo', 'Matola', 'Maputo', 'Matola', 'Boane', 'Marracuene'];
const LETTERS = 'ABCDEFGHIJKLMNPQRSTUVWXYZ';

/** A fixed-seed random generator (mulberry32), so a run on a copy of the data gives the same drivers */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const strip = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const day = (y, m, d) => new Date(Date.UTC(y, m, d));
const phone = (n) => `+258 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;

/** The demo drivers for `vehicles`, numbered from `first` */
function makeDrivers(vehicles, first, taken, phones) {
  const rand = seeded(2026);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  // Sign-in finds a driver by phone, so no two drivers share one
  const newPhone = () => {
    let p;
    do p = phone(`${pick(['84', '85', '86', '87'])}${String(int(1000000, 9999999))}`);
    while (phones.has(p.replace(/\D/g, '')));
    phones.add(p.replace(/\D/g, ''));
    return p;
  };
  const out = [];
  let n = first;
  for (const v of vehicles) {
    const female = rand() < 0.15;
    let nome;
    do nome = `${pick(female ? FEMALE : MALE)} ${pick(SURNAMES)}`;
    while (taken.has(nome));
    taken.add(nome);
    const [given, surname] = nome.split(' ');
    const born = day(int(1970, 1998), int(0, 11), int(1, 28));
    const biIssued = day(int(2020, 2025), int(0, 11), int(1, 28));
    const licence = day(int(2016, 2024), int(0, 11), int(1, 28));
    const contact = `${pick(rand() < 0.5 ? FEMALE : MALE)} ${pick(SURNAMES)} (Familiar)`;
    out.push({
      transporteId: v.id,
      matricula: v.matricula,
      nome,
      bi: `1102${String(n).padStart(8, '0')}${LETTERS[n % LETTERS.length]}`,
      cartaConducao: `CC-${licence.getUTCFullYear()}-${String(n).padStart(6, '0')}`,
      email: `${strip(given)}.${strip(surname)}.motorista${n}@transport.co.mz`,
      telefone: newPhone(),
      dataNascimento: born,
      endereco: `Av. ${surname}, ${int(10, 999)}, ${pick(PLACES)}`,
      genero: female ? 'Feminino' : 'Masculino',
      estadoCivil: pick(MARITAL),
      numeroEmergencia: phone(`84${String(int(1000000, 9999999))}`),
      contatoEmergencia: contact,
      dataEmissaoBI: biIssued,
      dataValidadeBI: day(biIssued.getUTCFullYear() + 10, biIssued.getUTCMonth(), biIssued.getUTCDate()),
      dataEmissaoCarta: licence,
      dataValidadeCarta: day(licence.getUTCFullYear() + 10, licence.getUTCMonth(), licence.getUTCDate()),
      categoriaCarta: v.lotacao > 15 ? 'D' : pick(['C', 'D']),
      experienciaAnos: int(2, 20),
      status: 'ativo',
    });
    n++;
  }
  return out;
}

(async () => {
  const url = process.env.DATABASE_URL ?? '';
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  if (flag('--apply') && !local && !flag('--production')) {
    console.error('DATABASE_URL is not a local database: add --production to write to it.');
    process.exit(1);
  }
  const { PrismaClient } = (await import('@prisma/client')).default;
  const prisma = new PrismaClient();
  try {
    const [vehicles, drivers] = await Promise.all([
      prisma.transporte.findMany({ where: { motorista: { is: null } }, select: { id: true, matricula: true, lotacao: true }, orderBy: { matricula: 'asc' } }),
      prisma.motorista.findMany({ select: { nome: true, email: true, bi: true, cartaConducao: true, telefone: true } }),
    ]);
    // Numbers after the highest in use (emails motoristaN, BI and licence numbers)
    const used = drivers.flatMap((d) => [d.email.match(/motorista(\d+)@/)?.[1], d.bi.match(/^1102(\d{8})/)?.[1], d.cartaConducao.match(/-(\d{6})$/)?.[1]]);
    const first = Math.max(drivers.length, ...used.filter(Boolean).map(Number)) + 1;
    const phones = new Set(drivers.map((d) => d.telefone.replace(/\D/g, '')));
    const created = makeDrivers(vehicles, first, new Set(drivers.map((d) => d.nome)), phones);

    console.log(`Drivers: ${drivers.length}; vehicles without a driver: ${vehicles.length}`);
    for (const d of created.slice(0, flag('--verbose') ? created.length : 8)) {
      console.log(`  + ${d.matricula.padEnd(9)} ${d.nome.padEnd(24)} ${d.telefone}  ${d.email}`);
    }
    if (!flag('--verbose') && created.length > 8) console.log(`  … (--verbose lists all ${created.length})`);
    if (!flag('--apply')) {
      console.log('\nDry run: nothing written. Add --apply to write.');
      return;
    }
    if (!created.length) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.mkdirSync(DATA, { recursive: true });
    const backupFile = path.join(DATA, `backup-drivers-${stamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify({ at: stamp, motoristas: await prisma.motorista.findMany() }));
    console.log(`\nBackup: ${drivers.length} drivers → ${backupFile}`);
    const ids = [];
    try {
      for (const { matricula, ...data } of created) {
        // One at a time: a vehicle given a driver meanwhile (transporteId is unique) is skipped
        try {
          ids.push((await prisma.motorista.create({ data, select: { id: true } })).id);
        } catch (e) {
          if (e.code === 'P2002') console.warn(`  skipped ${matricula}: ${e.meta?.target ?? 'already taken'}`);
          else throw e;
        }
      }
    } finally {
      const logFile = path.join(DATA, `created-drivers-${stamp}.json`);
      fs.writeFileSync(logFile, JSON.stringify({ at: stamp, motoristas: ids }, null, 1));
      console.log(`Written: ${ids.length} drivers, listed in ${logFile}`);
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
