#!/usr/bin/env node
/**
 * Puts the routes' paths on the roads where they cut across the map.
 *
 *   node scripts/snap-paths.mjs                        # dry run: what would change, nothing written
 *   node scripts/snap-paths.mjs --apply                # write to DATABASE_URL (local databases only)
 *   node scripts/snap-paths.mjs --apply --production   # also allows a remote database
 *   options: --min 300 (shortest stretch checked, m), --verbose (every route listed)
 *
 * Some stored paths (Via.geoLocationPath) jump in a straight line between two points far apart:
 * where an OpenStreetMap route relation has a hole in it or lists its ways out of order (the OSM
 * import joined its ways in order), and on routes drawn stop to stop by the first data scripts,
 * whose straight lines are cut into points a few tens of metres apart. The path is read as
 * straight stretches (the points in one line, within 3 m). For every stretch of at least --min
 * metres, the script asks a public OSRM car router for the road between its two ends:
 * - the road stays within 50 m of the straight line: the road is straight, the stretch is kept;
 * - the road stays within a quarter of the stretch's length (at least 300 m) of the line, and is
 *   at most 3 times as long (+500 m): the stretch is replaced by the road;
 * - otherwise the car road is another way altogether (a ring road, the city centre). The foot
 *   router, which ignores one-way streets and takes tracks, is asked too: when its road follows
 *   the line (a dual carriageway, a one-way street, a track), the stretch is a road and is kept.
 *   Else the stretch is kept and listed: scripts/redraw-from-osm.mjs rebuilds such routes from
 *   their OpenStreetMap stops, and the others are redrawn in the admin (Vias → the route → Redesenhar percurso).
 * The new path is simplified (4 m) and written only when it changed.
 *
 * The routers' answers are kept in osm-data/road-cache.json (scripts/roads.mjs), so a second run
 * on the same data (production after a local run) asks nothing again.
 *
 * --apply first saves every route's id, code and path to osm-data/backup-paths-<time>.json (to
 * undo: write those paths back), and only updates a route whose path is still the one read.
 * Road data © OpenStreetMap contributors (ODbL), routing by OSRM / FOSSGIS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, fetchRoutes, formatPath, lengthM, meters, openCache, parsePath, simplify, stretches } from './roads.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DATA = path.resolve(option('--data', path.join(__dirname, '..', 'osm-data')));
const MIN_SEGMENT_M = Number(option('--min', '300'));
/** A route left with a straight jump this long is listed */
const LIST_JUMP_M = 1000;

function longStretches(points) {
  return stretches(points)
    .map(([i, j]) => [points[i], points[j]])
    .filter(([a, b]) => meters(a, b) >= MIN_SEGMENT_M);
}

/** The route's new path, and what was done to its long stretches */
function snapRoute(points) {
  const out = [points[0]];
  const stats = { road: 0, straight: 0, stray: 0, unknown: 0 };
  /** Lengths (m) of the stretches kept straight for want of a road along them */
  const kept = [];
  for (const [i, j] of stretches(points)) {
    const a = points[i];
    const b = points[j];
    const c = meters(a, b) >= MIN_SEGMENT_M ? classify(a, b) : null;
    if (c) {
      const kind = c.kind === 'ask-foot' ? 'unknown' : c.kind;
      stats[kind]++;
      if (kind === 'stray') kept.push(c.m);
    }
    if (c?.kind === 'road') out.push(...c.road.points, b);
    else out.push(...points.slice(i + 1, j + 1));
  }
  return { points: stats.road ? simplify(out) : points, stats, kept };
}

(async () => {
  const url = process.env.DATABASE_URL ?? '';
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  if (flag('--apply') && !local && !flag('--production')) {
    console.error('DATABASE_URL is not a local database: add --production to write to it.');
    process.exit(1);
  }
  openCache(DATA);
  const { PrismaClient } = (await import('@prisma/client')).default;
  const prisma = new PrismaClient();
  try {
    const vias = await prisma.via.findMany({ select: { id: true, codigo: true, nome: true, geoLocationPath: true }, orderBy: { codigo: 'asc' } });
    const parsed = vias.map((v) => ({ ...v, points: parsePath(v.geoLocationPath) })).filter((v) => v.points.length >= 2);
    const long = parsed.flatMap((v) => longStretches(v.points));
    await fetchRoutes(long.map((points) => ({ profile: 'car', points })), 'car roads');
    // The foot router, only where the car road strays
    await fetchRoutes(long.filter(([a, b]) => classify(a, b).kind === 'ask-foot').map((points) => ({ profile: 'foot', points })), 'foot roads');

    const changes = [];
    const toRedraw = [];
    const total = { road: 0, straight: 0, stray: 0, unknown: 0 };
    for (const v of parsed) {
      const { points, stats, kept } = snapRoute(v.points);
      const longest = Math.max(0, ...kept);
      if (longest >= LIST_JUMP_M) toRedraw.push({ v, longest });
      for (const k of Object.keys(total)) total[k] += stats[k];
      if (stats.road) changes.push({ v, points, stats, before: lengthM(v.points) / 1000, after: lengthM(points) / 1000 });
    }
    console.log(`Routes: ${vias.length}; long straight stretches (≥ ${MIN_SEGMENT_M} m): ${total.road + total.straight + total.stray + total.unknown}`);
    console.log(`  put on the road: ${total.road}; on a straight road, kept: ${total.straight}; no road along them, kept: ${total.stray}; not asked yet: ${total.unknown}`);
    console.log(`Routes changed: ${changes.length}`);
    for (const c of flag('--verbose') ? changes : changes.slice(0, 15)) {
      console.log(`  ${c.v.codigo.padEnd(10)} ${String(c.stats.road).padStart(3)} stretches, ${c.before.toFixed(1)} → ${c.after.toFixed(1)} km  ${c.v.nome}`);
    }
    if (!flag('--verbose') && changes.length > 15) console.log(`  … (--verbose lists all ${changes.length})`);
    toRedraw.sort((x, y) => y.longest - x.longest);
    console.log(`\nRoutes still with a straight jump of ${LIST_JUMP_M / 1000} km or more (redraw-from-osm.mjs, or the admin's Vias → Redesenhar percurso): ${toRedraw.length}`);
    for (const r of flag('--verbose') ? toRedraw : toRedraw.slice(0, 15)) {
      console.log(`  ${r.v.codigo.padEnd(10)} ${(r.longest / 1000).toFixed(1).padStart(5)} km  ${r.v.nome}`);
    }
    if (!flag('--verbose') && toRedraw.length > 15) console.log(`  … (--verbose lists all ${toRedraw.length})`);
    if (!flag('--apply')) {
      console.log('\nDry run: nothing written. Add --apply to write.');
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(DATA, `backup-paths-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify({ at: stamp, vias: vias.map(({ id, codigo, geoLocationPath }) => ({ id, codigo, geoLocationPath })) }));
    console.log(`\nBackup: ${vias.length} routes' paths → ${file}`);
    let written = 0;
    for (const c of changes) {
      const res = await prisma.via.updateMany({
        where: { id: c.v.id, geoLocationPath: c.v.geoLocationPath },
        data: { geoLocationPath: formatPath(c.points) },
      });
      written += res.count;
    }
    console.log(`Written: ${written} routes.`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
