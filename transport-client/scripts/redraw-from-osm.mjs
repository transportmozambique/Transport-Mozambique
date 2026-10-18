#!/usr/bin/env node
/**
 * Redraws routes whose path still jumps in a straight line, from their OpenStreetMap stops.
 *
 *   node scripts/redraw-from-osm.mjs                        # dry run: what would change, nothing written
 *   node scripts/redraw-from-osm.mjs --apply                # write to DATABASE_URL (local databases only)
 *   node scripts/redraw-from-osm.mjs --apply --production   # also allows a remote database
 *   options: --routes 214,504 (these routes instead of the ones found), --verbose,
 *            --unlink-far 503,X05 (unlink these routes' stops far from their path, below)
 *
 * Run it after scripts/snap-paths.mjs, with the OSM data from `import-osm.mjs --fetch` in
 * osm-data/. It takes the routes with a straight jump of 1 km or more that no road follows
 * (the same test as snap-paths), and that have an OpenStreetMap route relation with the same
 * number (214 → 214i and 214v). Such a jump comes from the relation itself: OSM lists its ways
 * out of order, or misses some, and the import joined them in order.
 *
 * The new path goes through the relation's stops in travel order, by car, on the public OSRM
 * routers (scripts/roads.mjs): stop positions on the road, or the platforms when the relation
 * has none. As in the import, the path is one direction, the "i" relation's (the buses come
 * back along it), so the route keeps its direction. A stop the router only reaches by going
 * round a block (on the far side of a dual carriageway) is passed by.
 *
 * The relations' stops that now lie on the path (a stop in the database within 35 m of the OSM
 * stop, and within 30 m of the new path) are linked to the route if they were not; the stops
 * the old jump had picked up stay linked, and the ones now far from the path are listed.
 *
 * --unlink-far 503,X05 unlinks, from the routes named, the linked stops more than 100 m from
 * their path: the path drawn in this run, or the current one for a route redrawn before. A far
 * stop that is a stop of the route's own OSM relations is kept: the bus comes back by another
 * street there (the "v" direction), and the path holds only one direction. Only the routes
 * named lose stops, so each removal is a decision taken route by route.
 *
 * --apply first saves the routes' paths and stop links to osm-data/backup-redraw-<time>.json,
 * writes a path only if it is still the one read, and lists the links it added and removed in
 * osm-data/created-redraw-<time>.json (to undo: write the paths back, delete the links added,
 * create the links removed again).
 * Data © OpenStreetMap contributors (ODbL), routing by OSRM / FOSSGIS.
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
/** A stop in the database this close to an OSM stop is that stop */
const SAME_STOP_M = 35;
/** A stop this close to the new path is on it */
const ON_PATH_M = 30;
/** A linked stop this far from the new path is listed */
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

/** The longest straight jump no road follows, in metres (0 when none), and what to ask first */
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
    console.error('DATABASE_URL is not a local database: add --production to write to it.');
    process.exit(1);
  }
  for (const f of ['routes.json', 'stops.json']) {
    if (!fs.existsSync(path.join(DATA, f))) {
      console.error(`${path.join(DATA, f)} is missing: run node scripts/import-osm.mjs --fetch first.`);
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

    // Which routes: the ones asked for, or the ones still jumping
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
      // The relation the import drew the route from: the "i" direction when there is one
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
      // The relations' stops on the new path, as stops in the database
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

    // Stops far from the path, on the routes named by --unlink-far
    const unlinks = [];
    for (const codigo of UNLINK) {
      const v = vias.find((x) => x.codigo === codigo);
      if (!v) {
        console.error(`--unlink-far: no route with the code ${codigo}.`);
        process.exit(1);
      }
      const change = changes.find((c) => c.v.id === v.id);
      const near = nearestOn(change?.points ?? parsePath(v.geoLocationPath));
      const linked = new Set(v.paragens.map((p) => p.paragemId));
      // Which OSM relations have a stop within 35 m of it: tells what a far stop was on
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

    console.log(`Routes with a straight jump of ${JUMP_M / 1000} km or more${ONLY.length ? ' (asked for)' : ''}: ${chosen.length}`);
    for (const c of changes) {
      console.log(
        `  ${c.v.codigo.padEnd(8)} from ${c.rel.tags.ref.padEnd(7)} ${c.before.toFixed(1).padStart(5)} → ${c.after.toFixed(1).padStart(5)} km` +
          `; stops passed by: ${c.dropped}; stops linked: +${c.add.length}; linked stops now over ${FAR_M} m away: ${c.far.length}  ${c.v.nome}`,
      );
      if (flag('--verbose') && c.far.length) console.log(`           far: ${c.far.map((p) => `${p.codigo} ${p.nome}`).join(', ')}`);
    }
    for (const s of skipped) console.log(`  ${s.v.codigo.padEnd(8)} kept: ${s.why}  ${s.v.nome}`);
    if (unlinks.length) console.log(`\nStops to unlink, more than ${FAR_M} m from the path (--unlink-far):`);
    for (const u of unlinks) {
      console.log(`  ${u.v.codigo.padEnd(8)} ${u.far.length} of ${u.v.paragens.length} linked stops${u.redrawn ? ' (from the path drawn now)' : ''}  ${u.v.nome}`);
      for (const p of u.far) console.log(`           ${p.codigo} ${p.nome}, ${Math.round(p.m)} m`);
      for (const p of u.kept) console.log(`           kept: ${p.codigo} ${p.nome}, ${Math.round(p.m)} m, a stop of OSM ${p.on.join(', ')} (the way back)`);
    }
    if (!flag('--apply')) {
      console.log('\nDry run: nothing written. Add --apply to write.');
      return;
    }
    if (!changes.length && !unlinks.some((u) => u.far.length)) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ids = [...new Set([...changes, ...unlinks].map((c) => c.v.id))];
    const links = await prisma.viaParagem.findMany({ where: { viaId: { in: ids } } });
    const backup = path.join(DATA, `backup-redraw-${stamp}.json`);
    fs.writeFileSync(backup, JSON.stringify({ at: stamp, vias: changes.map(({ v }) => ({ id: v.id, codigo: v.codigo, geoLocationPath: v.geoLocationPath })), viaParagem: links }));
    console.log(`\nBackup: ${changes.length} routes' paths and ${links.length} stop links → ${backup}`);
    let written = 0;
    const created = [];
    const removed = [];
    const notWritten = new Set();
    for (const c of changes) {
      const res = await prisma.via.updateMany({ where: { id: c.v.id, geoLocationPath: c.v.geoLocationPath }, data: { geoLocationPath: formatPath(c.points) } });
      written += res.count;
      if (!res.count) {
        console.log(`  ${c.v.codigo}: its path changed since it was read, left alone`);
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
    // Unlink only from a path that was written (or was already there)
    for (const u of unlinks) {
      if (notWritten.has(u.v.id) || !u.far.length) continue;
      const rows = links.filter((l) => l.viaId === u.v.id && u.far.some((p) => p.id === l.paragemId));
      await prisma.viaParagem.deleteMany({ where: { id: { in: rows.map((l) => l.id) } } });
      removed.push(...rows.map((l) => ({ ...l, via: u.v.codigo })));
    }
    const log = path.join(DATA, `created-redraw-${stamp}.json`);
    fs.writeFileSync(log, JSON.stringify({ at: stamp, viaParagem: created, removed }, null, 1));
    console.log(`Written: ${written} routes, ${created.length} stop links added, ${removed.length} removed (listed in ${log}).`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
