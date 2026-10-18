#!/usr/bin/env node
/**
 * Puts the routes' paths on the roads where they cut across the map.
 *
 *   node scripts/snap-paths.mjs                        # dry run: what would change, nothing written
 *   node scripts/snap-paths.mjs --apply                # write to DATABASE_URL (local databases only)
 *   node scripts/snap-paths.mjs --apply --production   # also allows a remote database
 *   options: --min 300 (shortest stretch checked, m), --verbose (every route changed)
 *
 * Some stored paths (Via.geoLocationPath) jump in a straight line between two points far apart:
 * where an OpenStreetMap route relation has a hole in it (the OSM import joined its ways in
 * order), and on routes drawn stop to stop by the first data scripts, whose straight lines are
 * cut into points a few tens of metres apart. The path is first read as straight stretches (the
 * points in one line, within 3 m). For every stretch of at least --min metres, the script asks a
 * public OSRM car router for the road between its two ends:
 * - the road stays within 50 m of the straight line: the road is straight, the stretch is kept;
 * - otherwise the stretch is replaced by the road, unless the road is more than 3 times as long
 *   (+500 m), which means the two ends are not on one road (a river, a one-way street the wrong
 *   way): the stretch is then kept and counted.
 * The new path is simplified (4 m) and written only when it changed.
 *
 * The routers allow light use only, one request a second: requests alternate between the
 * FOSSGIS router and the OSRM demo router, each a request a second at most. Their answers are
 * kept in osm-data/road-cache.json, so a second run (on another copy of the same data, such as
 * production after a local run) asks nothing again.
 *
 * --apply first saves every route's id, code and path to osm-data/backup-paths-<time>.json (to
 * undo: write those paths back), and only updates a route whose path is still the one read.
 * Road data © OpenStreetMap contributors (ODbL), routing by OSRM / FOSSGIS.
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
const CACHE_FILE = path.join(DATA, 'road-cache.json');
const MIN_SEGMENT_M = Number(option('--min', '300'));
const IN_LINE_M = 3;
const STRAIGHT_ROAD_M = 50;
const MAX_DETOUR = 3;
const MAX_DETOUR_EXTRA_M = 500;
const SIMPLIFY_M = 4;
const USER_AGENT = 'TransportesMocambique/1.0 (+https://github.com/transportmozambique/Transport-Mozambique)';
const ROUTERS = [
  'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  'https://router.project-osrm.org/route/v1/driving',
];
const GAP_MS = 1100;

// ─── Geometry ([lat, lng]) ───────────────────────────────────────────────────

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function meters(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const xy = ([lat, lng]) => [rad(lng) * R * Math.cos(rad(-25.9)), rad(lat) * R];
function toSegment(p, a, b) {
  const [px, py] = xy(p);
  const [ax, ay] = xy(a);
  const [bx, by] = xy(b);
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
/** Douglas–Peucker in metres */
function simplify(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1;
    let dmax = tol;
    for (let i = a + 1; i < b; i++) {
      const d = toSegment(points[i], points[a], points[b]);
      if (d > dmax) {
        dmax = d;
        far = i;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
/** A stored path, "lng,lat;lng,lat;…", as [lat, lng] points */
const parsePath = (text) =>
  (text ?? '')
    .split(';')
    .map((p) => p.split(',').map(Number))
    .filter((p) => p.length === 2 && p.every(Number.isFinite))
    .map(([lng, lat]) => [lat, lng]);
const formatPath = (points) => points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');

// ─── Roads ───────────────────────────────────────────────────────────────────

const keyOf = (a, b) => `${a[0].toFixed(6)},${a[1].toFixed(6)};${b[0].toFixed(6)},${b[1].toFixed(6)}`;
const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
const saveCache = () => {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The road from a to b from one router: { m, points } or null (no road); throws when the router fails */
async function askRouter(router, a, b) {
  const url = `${router}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
  if (res.status === 400) return null;
  if (!res.ok) throw new Error(`${router}: HTTP ${res.status}`);
  const data = await res.json();
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route) return null;
  return { m: Math.round(route.distance), points: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]) };
}

/** Asks the routers for every segment not in the cache, one request a second per router. */
async function fetchRoads(segments) {
  const todo = segments.filter(([a, b]) => !(keyOf(a, b) in cache));
  if (!todo.length) return;
  console.log(`Asking the routers for ${todo.length} roads (about ${Math.ceil(todo.length / ROUTERS.length / 55)} min)…`);
  let next = 0;
  let done = 0;
  let failures = 0;
  const worker = async (router) => {
    while (next < todo.length) {
      const [a, b] = todo[next++];
      const started = Date.now();
      try {
        cache[keyOf(a, b)] = await askRouter(router, a, b);
      } catch (e) {
        failures++;
        if (failures <= 5) console.warn(`  ${e.message} (asked again on the next run)`);
      }
      if (++done % 100 === 0) {
        saveCache();
        console.log(`  ${done}/${todo.length}`);
      }
      await sleep(Math.max(0, GAP_MS - (Date.now() - started)));
    }
  };
  await Promise.all(ROUTERS.map(worker));
  saveCache();
  if (failures) console.log(`  ${failures} requests failed; run again to finish them.`);
}

// ─── Plan ────────────────────────────────────────────────────────────────────

/** The path as straight stretches [i, j]: the points from i to j lie within IN_LINE_M of the line i–j */
function stretches(points) {
  const out = [];
  let i = 0;
  while (i < points.length - 1) {
    let j = i + 1;
    while (j + 1 < points.length) {
      let inLine = true;
      for (let k = i + 1; k <= j && inLine; k++) inLine = toSegment(points[k], points[i], points[j + 1]) <= IN_LINE_M;
      if (!inLine) break;
      j++;
    }
    out.push([i, j]);
    i = j;
  }
  return out;
}

function longStretches(points) {
  return stretches(points)
    .map(([i, j]) => [points[i], points[j]])
    .filter(([a, b]) => meters(a, b) >= MIN_SEGMENT_M);
}

/** The route's new path, and what was done to its long stretches */
function snapRoute(points) {
  const out = [points[0]];
  const stats = { replaced: 0, straight: 0, detour: 0, unknown: 0 };
  for (const [i, j] of stretches(points)) {
    const a = points[i];
    const b = points[j];
    const m = meters(a, b);
    let road = null;
    if (m >= MIN_SEGMENT_M) {
      const key = keyOf(a, b);
      const answer = key in cache ? cache[key] : undefined;
      if (answer === undefined) stats.unknown++;
      else if (!answer) stats.detour++;
      else if (Math.max(...answer.points.map((p) => toSegment(p, a, b))) <= STRAIGHT_ROAD_M) stats.straight++;
      else if (answer.m > MAX_DETOUR * m + MAX_DETOUR_EXTRA_M) stats.detour++;
      else {
        stats.replaced++;
        road = answer;
      }
    }
    if (road) out.push(...road.points, b);
    else out.push(...points.slice(i + 1, j + 1));
  }
  return { points: stats.replaced ? simplify(out, SIMPLIFY_M) : points, stats };
}

const lengthKm = (points) => points.slice(1).reduce((s, p, i) => s + meters(points[i], p), 0) / 1000;

// ─── Main ────────────────────────────────────────────────────────────────────

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
    const vias = await prisma.via.findMany({ select: { id: true, codigo: true, nome: true, geoLocationPath: true }, orderBy: { codigo: 'asc' } });
    const parsed = vias.map((v) => ({ ...v, points: parsePath(v.geoLocationPath) })).filter((v) => v.points.length >= 2);
    await fetchRoads(parsed.flatMap((v) => longStretches(v.points)));

    const changes = [];
    const total = { replaced: 0, straight: 0, detour: 0, unknown: 0 };
    for (const v of parsed) {
      const { points, stats } = snapRoute(v.points);
      for (const k of Object.keys(total)) total[k] += stats[k];
      if (stats.replaced) changes.push({ v, points, stats, before: lengthKm(v.points), after: lengthKm(points) });
    }
    console.log(`Routes: ${vias.length}; long straight stretches (≥ ${MIN_SEGMENT_M} m): ${total.replaced + total.straight + total.detour + total.unknown}`);
    console.log(`  put on the road: ${total.replaced}; straight roads, kept: ${total.straight}; no road close enough, kept: ${total.detour}; not asked yet: ${total.unknown}`);
    console.log(`Routes changed: ${changes.length}`);
    for (const c of flag('--verbose') ? changes : changes.slice(0, 15)) {
      console.log(`  ${c.v.codigo.padEnd(10)} ${String(c.stats.replaced).padStart(3)} stretches, ${c.before.toFixed(1)} → ${c.after.toFixed(1)} km  ${c.v.nome}`);
    }
    if (!flag('--verbose') && changes.length > 15) console.log(`  … (--verbose lists all ${changes.length})`);
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
