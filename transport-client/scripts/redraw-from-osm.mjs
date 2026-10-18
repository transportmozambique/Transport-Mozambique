#!/usr/bin/env node
/**
 * Redesenha as rotas cujo percurso ainda salta em linha recta, a partir das suas paragens do
 * OpenStreetMap.
 *
 *   node scripts/redraw-from-osm.mjs                        # ensaio: o que mudaria, nada é escrito
 *   node scripts/redraw-from-osm.mjs --apply                # escreve em DATABASE_URL (só bases de dados locais)
 *   node scripts/redraw-from-osm.mjs --apply --production   # permite também uma base de dados remota
 *   opções: --routes 214,504 (estas rotas em vez das encontradas), --verbose,
 *           --unlink-far 503,X05 (desligar as paragens destas rotas longe do percurso, ver abaixo)
 *
 * Corre depois de scripts/snap-paths.mjs, com os dados do OSM de `import-osm.mjs --fetch` em
 * osm-data/. Pega nas rotas com um salto em linha recta de 1 km ou mais que nenhuma estrada segue
 * (o mesmo teste do snap-paths) e que têm uma relação de rota no OpenStreetMap com o mesmo número
 * (214 → 214i e 214v). Um salto desses vem da própria relação: o OSM lista as suas vias fora de
 * ordem, ou faltam-lhe algumas, e a importação juntou-as por ordem.
 *
 * O novo percurso passa pelas paragens da relação pela ordem de viagem, de carro, nos routers OSRM
 * públicos (scripts/roads.mjs): os stop positions na estrada, ou as plataformas quando a relação
 * não os tem. Como na importação, o percurso é de um sentido, o da relação "i" (os autocarros
 * voltam por ele), por isso a rota mantém o seu sentido. Uma paragem a que o router só chega
 * dando a volta a um quarteirão (do outro lado de uma estrada com separador) é saltada.
 *
 * As paragens das relações que agora ficam no percurso (uma paragem da base de dados a menos de
 * 35 m da paragem do OSM, e a menos de 30 m do novo percurso) são ligadas à rota se não estavam;
 * as paragens que o salto antigo tinha apanhado continuam ligadas, e as que agora ficam longe do
 * percurso são listadas.
 *
 * --unlink-far 503,X05 desliga, das rotas indicadas, as paragens ligadas a mais de 100 m do seu
 * percurso: o desenhado nesta corrida, ou o actual para uma rota redesenhada antes. Uma paragem
 * longe que é paragem das próprias relações OSM da rota fica: o autocarro volta por outra rua
 * nesse sítio (o sentido "v"), e o percurso só tem um sentido. Só as rotas indicadas perdem
 * paragens, para cada remoção ser uma decisão tomada rota a rota.
 *
 * --apply guarda primeiro os percursos e as ligações às paragens das rotas em
 * osm-data/backup-redraw-<hora>.json, só escreve um percurso se ainda for o que foi lido, e lista
 * as ligações juntadas e removidas em osm-data/created-redraw-<hora>.json (para desfazer:
 * escrever os percursos de volta, apagar as ligações juntadas, criar outra vez as removidas).
 * Dados © contribuidores do OpenStreetMap (ODbL), caminhos por OSRM / FOSSGIS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, fetchRoutes, formatPath, lengthM, meters, openCache, parsePath, routeThrough, stretches, toSegment } from './roads.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DATA = path.resolve(option('--data', path.join(__dirname, '..', 'osm-data')));
const ONLY = option('--routes', '').split(',').map((s) => s.trim()).filter(Boolean);
const UNLINK = option('--unlink-far', '').split(',').map((s) => s.trim()).filter(Boolean);
const MIN_SEGMENT_M = 300;
const JUMP_M = 1000;
/** Uma paragem da base de dados tão perto de uma paragem do OSM é essa paragem */
const SAME_STOP_M = 35;
/** Uma paragem tão perto do novo percurso está nele */
const ON_PATH_M = 30;
/** Uma paragem ligada tão longe do novo percurso é listada */
const FAR_M = 100;

const nearestOn = (points) => (p) => {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) best = Math.min(best, toSegment(p, points[i], points[i + 1]));
  return best;
};
const latLng = (text) => {
  const [lat, lng] = (text ?? '').split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

/** O salto em linha recta mais longo que nenhuma estrada segue, em metros (0 quando não há), e o que perguntar primeiro */
function longestJump(points) {
  let longest = 0;
  for (const [i, j] of stretches(points)) {
    if (meters(points[i], points[j]) < MIN_SEGMENT_M) continue;
    const c = classify(points[i], points[j]);
    if (c.kind === 'stray') longest = Math.max(longest, c.m);
  }
  return longest;
}

(async () => {
  const url = process.env.DATABASE_URL ?? '';
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  if (flag('--apply') && !local && !flag('--production')) {
    console.error('DATABASE_URL não é uma base de dados local: juntar --production para escrever nela.');
    process.exit(1);
  }
  for (const f of ['routes.json', 'stops.json']) {
    if (!fs.existsSync(path.join(DATA, f))) {
      console.error(`${path.join(DATA, f)} não existe: correr primeiro node scripts/import-osm.mjs --fetch.`);
      process.exit(1);
    }
  }
  openCache(DATA);
  const osmRoutes = JSON.parse(fs.readFileSync(path.join(DATA, 'routes.json'), 'utf8')).elements;
  const osmStops = JSON.parse(fs.readFileSync(path.join(DATA, 'stops.json'), 'utf8')).elements;
  const nodes = new Map([...osmRoutes, ...osmStops].filter((e) => e.type === 'node' && e.lat != null).map((n) => [n.id, [n.lat, n.lon]]));
  const relations = osmRoutes.filter((e) => e.type === 'relation' && e.tags?.ref);
  const relationsOf = (codigo) => relations.filter((r) => r.tags.ref.replace(/[iv]$/, '') === codigo);
  const stopsOf = (rel) => {
    const pick = (role) => rel.members.filter((m) => m.type === 'node' && m.role.startsWith(role)).map((m) => nodes.get(m.ref)).filter(Boolean);
    const positions = pick('stop');
    return positions.length >= 2 ? positions : pick('platform');
  };

  const { PrismaClient } = (await import('@prisma/client')).default;
  const prisma = new PrismaClient();
  try {
    const vias = await prisma.via.findMany({
      select: { id: true, codigo: true, nome: true, geoLocationPath: true, paragens: { select: { paragemId: true } } },
      orderBy: { codigo: 'asc' },
    });
    const paragens = (await prisma.paragem.findMany({ select: { id: true, codigo: true, nome: true, geoLocation: true } }))
      .map((p) => ({ ...p, point: latLng(p.geoLocation) }))
      .filter((p) => p.point);

    // Que rotas: as pedidas, ou as que ainda saltam
    let chosen;
    if (ONLY.length) chosen = vias.filter((v) => ONLY.includes(v.codigo));
    else {
      const parsed = vias.map((v) => ({ v, points: parsePath(v.geoLocationPath) })).filter((x) => x.points.length >= 2);
      const long = parsed.flatMap(({ points }) => stretches(points).map(([i, j]) => [points[i], points[j]]).filter(([a, b]) => meters(a, b) >= MIN_SEGMENT_M));
      await fetchRoutes(long.map((points) => ({ profile: 'car', points })), 'car roads');
      await fetchRoutes(long.filter(([a, b]) => classify(a, b).kind === 'ask-foot').map((points) => ({ profile: 'foot', points })), 'foot roads');
      chosen = parsed.filter(({ points }) => longestJump(points) >= JUMP_M).map(({ v }) => v);
    }

    const changes = [];
    const skipped = [];
    for (const v of chosen) {
      const current = parsePath(v.geoLocationPath);
      const rels = relationsOf(v.codigo).filter((r) => stopsOf(r).length >= 2);
      if (!rels.length) {
        skipped.push({ v, why: 'no OpenStreetMap route with stops: redraw it in the admin (Vias → the route → Redesenhar percurso)' });
        continue;
      }
      // A relação de onde a importação desenhou a rota: o sentido "i" quando existe
      const rel = rels.sort((a, b) => (/i$/.test(b.tags.ref) ? 1 : 0) - (/i$/.test(a.tags.ref) ? 1 : 0))[0];
      const stops = stopsOf(rel);
      const routed = await routeThrough(stops);
      if (!routed) {
        skipped.push({ v, why: 'the routers have not answered yet: run again' });
        continue;
      }
      if (!routed.points) {
        skipped.push({ v, why: `no road through the stops of ${rel.tags.ref}` });
        continue;
      }
      const points = routed.points;
      const dropped = routed.dropped;
      const near = nearestOn(points);
      const linked = new Set(v.paragens.map((p) => p.paragemId));
      // As paragens das relações no novo percurso, como paragens da base de dados
      const add = new Map();
      for (const r of relationsOf(v.codigo)) {
        for (const m of r.members) {
          const at = m.type === 'node' && /stop|platform/.test(m.role) ? nodes.get(m.ref) : null;
          if (!at) continue;
          const own = paragens.find((p) => p.codigo === `OSM-${m.ref}`);
          const p = own ?? paragens.reduce((best, x) => (meters(x.point, at) < (best ? meters(best.point, at) : SAME_STOP_M) ? x : best), null);
          if (p && !linked.has(p.id) && near(p.point) <= ON_PATH_M) add.set(p.id, p);
        }
      }
      const far = paragens.filter((p) => linked.has(p.id) && near(p.point) > FAR_M);
      changes.push({ v, rel, points, dropped, add: [...add.values()], far, before: lengthM(current) / 1000, after: lengthM(points) / 1000 });
    }

    // Paragens longe do percurso, nas rotas indicadas em --unlink-far
    const unlinks = [];
    for (const codigo of UNLINK) {
      const v = vias.find((x) => x.codigo === codigo);
      if (!v) {
        console.error(`--unlink-far: nenhuma rota com o código ${codigo}.`);
        process.exit(1);
      }
      const change = changes.find((c) => c.v.id === v.id);
      const near = nearestOn(change?.points ?? parsePath(v.geoLocationPath));
      const linked = new Set(v.paragens.map((p) => p.paragemId));
      // Que relações OSM têm uma paragem a menos de 35 m dela: diz em que estava uma paragem longe
      const onRelation = (p) =>
        relationsOf(codigo)
          .filter((r) => r.members.some((m) => m.type === 'node' && /stop|platform/.test(m.role) && nodes.has(m.ref) && meters(nodes.get(m.ref), p.point) <= SAME_STOP_M))
          .map((r) => r.tags.ref);
      const all = paragens
        .filter((p) => linked.has(p.id))
        .map((p) => ({ ...p, m: near(p.point), on: onRelation(p) }))
        .filter((p) => p.m > FAR_M);
      unlinks.push({ v, far: all.filter((p) => !p.on.length), kept: all.filter((p) => p.on.length), redrawn: Boolean(change) });
    }

    console.log(`Rotas com um salto recto de ${JUMP_M / 1000} km ou mais${ONLY.length ? ' (pedidas)' : ''}: ${chosen.length}`);
    for (const c of changes) {
      console.log(
        `  ${c.v.codigo.padEnd(8)} from ${c.rel.tags.ref.padEnd(7)} ${c.before.toFixed(1).padStart(5)} → ${c.after.toFixed(1).padStart(5)} km` +
          `; stops passed by: ${c.dropped}; stops linked: +${c.add.length}; linked stops now over ${FAR_M} m away: ${c.far.length}  ${c.v.nome}`,
      );
      if (flag('--verbose') && c.far.length) console.log(`           longe: ${c.far.map((p) => `${p.codigo} ${p.nome}`).join(', ')}`);
    }
    for (const s of skipped) console.log(`  ${s.v.codigo.padEnd(8)} mantida: ${s.why}  ${s.v.nome}`);
    if (unlinks.length) console.log(`\nParagens a desligar, a mais de ${FAR_M} m do percurso (--unlink-far):`);
    for (const u of unlinks) {
      console.log(`  ${u.v.codigo.padEnd(8)} ${u.far.length} de ${u.v.paragens.length} paragens ligadas${u.redrawn ? ' (pelo percurso desenhado agora)' : ''}  ${u.v.nome}`);
      for (const p of u.far) console.log(`           ${p.codigo} ${p.nome}, ${Math.round(p.m)} m`);
      for (const p of u.kept) console.log(`           mantida: ${p.codigo} ${p.nome}, ${Math.round(p.m)} m, paragem do OSM ${p.on.join(', ')} (o sentido de volta)`);
    }
    if (!flag('--apply')) {
      console.log('\nEnsaio: nada foi escrito. Juntar --apply para escrever.');
      return;
    }
    if (!changes.length && !unlinks.some((u) => u.far.length)) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ids = [...new Set([...changes, ...unlinks].map((c) => c.v.id))];
    const links = await prisma.viaParagem.findMany({ where: { viaId: { in: ids } } });
    const backup = path.join(DATA, `backup-redraw-${stamp}.json`);
    fs.writeFileSync(backup, JSON.stringify({ at: stamp, vias: changes.map(({ v }) => ({ id: v.id, codigo: v.codigo, geoLocationPath: v.geoLocationPath })), viaParagem: links }));
    console.log(`\nCópia de segurança: percursos de ${changes.length} rotas e ${links.length} ligações a paragens → ${backup}`);
    let written = 0;
    const created = [];
    const removed = [];
    const notWritten = new Set();
    for (const c of changes) {
      const res = await prisma.via.updateMany({ where: { id: c.v.id, geoLocationPath: c.v.geoLocationPath }, data: { geoLocationPath: formatPath(c.points) } });
      written += res.count;
      if (!res.count) {
        console.log(`  ${c.v.codigo}: o percurso mudou depois de ser lido, ficou como estava`);
        notWritten.add(c.v.id);
        continue;
      }
      for (const p of c.add) {
        const row = await prisma.viaParagem
          .create({ data: { viaId: c.v.id, paragemId: p.id, codigoVia: c.v.codigo, codigoParagem: p.codigo } })
          .catch((e) => (e.code === 'P2002' ? null : Promise.reject(e)));
        if (row) created.push({ id: row.id, via: c.v.codigo, paragem: p.codigo });
      }
    }
    // Desligar só de um percurso que foi escrito (ou que já lá estava)
    for (const u of unlinks) {
      if (notWritten.has(u.v.id) || !u.far.length) continue;
      const rows = links.filter((l) => l.viaId === u.v.id && u.far.some((p) => p.id === l.paragemId));
      await prisma.viaParagem.deleteMany({ where: { id: { in: rows.map((l) => l.id) } } });
      removed.push(...rows.map((l) => ({ ...l, via: u.v.codigo })));
    }
    const log = path.join(DATA, `created-redraw-${stamp}.json`);
    fs.writeFileSync(log, JSON.stringify({ at: stamp, viaParagem: created, removed }, null, 1));
    console.log(`Escrito: ${written} rotas, ${created.length} ligações a paragens juntadas, ${removed.length} tiradas (listadas em ${log}).`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
