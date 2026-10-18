#!/usr/bin/env node
/**
 * Imports the Maputo area's bus stops and bus routes from OpenStreetMap.
 *
 *   node scripts/import-osm.mjs --fetch                # download from Overpass into ./osm-data
 *   node scripts/import-osm.mjs                        # dry run: what would change, nothing written
 *   node scripts/import-osm.mjs --apply                # write to DATABASE_URL (local databases only)
 *   node scripts/import-osm.mjs --apply --production   # also allows a remote database
 *
 * --apply first saves every Paragem, Via, ViaParagem and Transporte row to
 * osm-data/backup-<time>.json, and afterwards lists what it created in
 * osm-data/created-<time>.json (to undo the import: delete those rows).
 *
 * What it does:
 * - Stops: every highway=bus_stop, bus platform and bus station. A stop_position becomes the
 *   bus_stop or platform within 35 m (same name first), or a stop of its own. Same-name stops
 *   within 30 m are one. A stop already in the database (same name within 30 m, or any within
 *   15 m) is reused, so nothing is duplicated; new ones get the code OSM-<node id>.
 * - Routes: the two directions of a route (X12i and X12v) are one Via, as the network treats
 *   every route as running both ways. Its path goes through the first direction's stops in
 *   order, by car on the public OSRM routers (scripts/roads.mjs, answers kept in
 *   osm-data/road-cache.json): relations often list their ways out of order or miss some, and
 *   joining them made straight jumps across the map. A relation without stops gets its ways
 *   joined in order. Its stops are the relations' stops near that path, and any stop within
 *   20 m of it.
 * - A route that is already in the database (its path within 60 m of one existing route's path
 *   for 85% of its length, and the other way round for 70%) is not added again. Its stops
 *   are attached to the existing route instead.
 * - Existing routes also get the imported stops within 20 m of their path.
 * - Only stops some route serves are imported.
 * - With --buses N, each new route gets N vehicles, as the existing routes have: Toyota Hiace
 *   for chapas, Mercedes-Benz Sprinter for EMTPM and Corujas, with the next free plates from
 *   the ADA-001M series. They move on the timetable model until a GPS device reports. The
 *   journey planner only uses routes that have a vehicle.
 *
 * Idempotent: running it again changes nothing. The data is © OpenStreetMap contributors,
 * under the Open Database License (ODbL): https://www.openstreetmap.org/copyright
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCache, routeThrough } from './roads.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DATA = path.resolve(option('--data', path.join(__dirname, '..', 'osm-data')));
const BBOX = '-26.10,32.30,-25.70,32.75'; // Maputo, Matola, Boane, Marracuene
const BUSES_PER_ROUTE = Number(option('--buses', '0'));

const STOP_POSITION_TO_STOP_M = 35;
const SAME_STOP_M = 30;
const EXISTING_SAME_NAME_M = 30;
const EXISTING_ANY_NAME_M = 15;
const STOP_ON_PATH_M = 20;
const MEMBER_ON_PATH_M = 60;
const DUPLICATE_ROUTE_M = 60;
const MATOLA_EAST_LNG = 32.505;

// ─── Geometry ────────────────────────────────────────────────────────────────

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function meters(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Local metres around Maputo, for point-to-segment distances */
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
/** A grid of the path's segments, so "distance to the path" is quick */
function pathIndex(points) {
  const cell = 0.002; // ~200 m
  const grid = new Map();
  const key = (i, j) => `${i}:${j}`;
  for (let s = 0; s < points.length - 1; s++) {
    const [a, b] = [points[s], points[s + 1]];
    const i0 = Math.floor(Math.min(a[0], b[0]) / cell) - 1;
    const i1 = Math.floor(Math.max(a[0], b[0]) / cell) + 1;
    const j0 = Math.floor(Math.min(a[1], b[1]) / cell) - 1;
    const j1 = Math.floor(Math.max(a[1], b[1]) / cell) + 1;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = key(i, j);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(s);
    }
  }
  return (p) => {
    const segs = grid.get(key(Math.floor(p[0] / cell), Math.floor(p[1] / cell))) ?? [];
    let best = Infinity;
    for (const s of segs) best = Math.min(best, toSegment(p, points[s], points[s + 1]));
    return best;
  };
}
/** Douglas–Peucker in metres */
function simplify(points, tol = 4) {
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
function samples(points, every = 100) {
  const out = [points[0]];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    acc += meters(points[i - 1], points[i]);
    if (acc >= every) {
      out.push(points[i]);
      acc = 0;
    }
  }
  return out;
}

const norm = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const similar = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
};

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function overpass(q) {
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  for (let attempt = 0, wait = 20; attempt < 6; attempt++, wait *= 2) {
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': 'TransportMozambique-import/1.0 (github.com/transportmozambique/Transport-Mozambique)', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(q),
        });
        if (res.ok) return await res.json();
        console.error(`${url}: ${res.status}`);
      } catch (e) {
        console.error(`${url}: ${e.message}`);
      }
    }
    console.error(`Overpass busy; again in ${wait}s`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  throw new Error('Overpass did not answer');
}

async function fetchData() {
  fs.mkdirSync(DATA, { recursive: true });
  const stops = await overpass(`[out:json][timeout:180];
(
  node["highway"="bus_stop"](${BBOX});
  node["public_transport"="platform"]["bus"="yes"](${BBOX});
  node["public_transport"="stop_position"]["bus"="yes"](${BBOX});
  node["amenity"="bus_station"](${BBOX});
);
out body;`);
  fs.writeFileSync(path.join(DATA, 'stops.json'), JSON.stringify(stops));
  const routes = await overpass(`[out:json][timeout:300];
relation["type"="route"]["route"~"^(bus|minibus|share_taxi|trolleybus)$"](${BBOX});
out body;
>;
out skel geom qt;`);
  fs.writeFileSync(path.join(DATA, 'routes.json'), JSON.stringify(routes));
  console.log(`Saved ${stops.elements.length} stop nodes and ${routes.elements.filter((e) => e.type === 'relation').length} routes in ${DATA}`);
}

// ─── Plan ────────────────────────────────────────────────────────────────────

function loadOsm() {
  const stops = JSON.parse(fs.readFileSync(path.join(DATA, 'stops.json'), 'utf8')).elements;
  const routes = JSON.parse(fs.readFileSync(path.join(DATA, 'routes.json'), 'utf8')).elements;
  return { stops, routes };
}

/** OSM stop nodes → stops (stop_positions folded into the stop beside them) */
function osmStops(nodes) {
  const isStop = (t) => t.highway === 'bus_stop' || t.public_transport === 'platform' || t.amenity === 'bus_station';
  const stops = [];
  const byNode = new Map();
  for (const n of nodes) {
    const t = n.tags ?? {};
    if (!isStop(t)) continue;
    const point = [n.lat, n.lon];
    const nome = (t.name ?? t['name:pt'] ?? '').trim();
    const twin = stops.find((s) => s.nome && nome && norm(s.nome) === norm(nome) && meters(s.point, point) <= SAME_STOP_M);
    if (twin) byNode.set(n.id, twin);
    else {
      const s = { osmId: n.id, nome, point };
      stops.push(s);
      byNode.set(n.id, s);
    }
  }
  for (const n of nodes) {
    const t = n.tags ?? {};
    if (isStop(t) || t.public_transport !== 'stop_position') continue;
    const point = [n.lat, n.lon];
    const nome = (t.name ?? '').trim();
    let best = null;
    for (const s of stops) {
      const m = meters(s.point, point);
      if (m > STOP_POSITION_TO_STOP_M) continue;
      const score = m - (similar(s.nome, nome) ? 100 : 0);
      if (!best || score < best.score) best = { s, score };
    }
    if (best) byNode.set(n.id, best.s);
    else {
      const s = { osmId: n.id, nome, point };
      stops.push(s);
      byNode.set(n.id, s);
    }
  }
  return { stops, byNode };
}

/** The relation's ways joined in order into one line */
/** A relation's stops in travel order: its stop positions (on the road), else its platforms */
function relationStops(rel, nodeAt) {
  const pick = (role) => rel.members.filter((m) => m.type === 'node' && m.role.startsWith(role)).map((m) => nodeAt.get(m.ref)).filter(Boolean);
  const positions = pick('stop');
  return positions.length >= 2 ? positions : pick('platform');
}

function relationPath(rel, ways) {
  const line = [];
  for (const m of rel.members) {
    if (m.type !== 'way' || !['', 'route', 'forward', 'backward'].includes(m.role)) continue;
    const w = ways.get(m.ref);
    if (!w?.geometry?.length) continue;
    let pts = w.geometry.map((g) => [g.lat, g.lon]);
    if (line.length) {
      const tail = line[line.length - 1];
      if (meters(tail, pts[pts.length - 1]) < meters(tail, pts[0])) pts = pts.reverse();
    } else {
      // Orient the first way towards the second
      const next = rel.members.find((x) => x.type === 'way' && x.ref !== m.ref && ways.get(x.ref)?.geometry?.length);
      const g = next && ways.get(next.ref).geometry;
      if (g) {
        const ends = [[g[0].lat, g[0].lon], [g[g.length - 1].lat, g[g.length - 1].lon]];
        const d = (p) => Math.min(...ends.map((e) => meters(p, e)));
        if (d(pts[0]) < d(pts[pts.length - 1])) pts = pts.reverse();
      }
    }
    for (const p of pts) {
      const last = line[line.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) line.push(p);
    }
  }
  return simplify(line);
}

const PALETTE = ['#E63946', '#2A9D8F', '#E9C46A', '#F4A261', '#264653', '#8E44AD', '#3498DB', '#16A085', '#D35400', '#C0392B', '#27AE60', '#2980B9', '#F39C12', '#7F8C8D', '#1ABC9C', '#9B59B6'];

async function plan(prisma) {
  const osm = loadOsm();
  const nodes = [...osm.stops, ...osm.routes.filter((e) => e.type === 'node' && e.tags)];
  const { stops, byNode } = osmStops(nodes);
  const ways = new Map(osm.routes.filter((e) => e.type === 'way').map((w) => [w.id, w]));
  const nodeAt = new Map([...osm.stops, ...osm.routes].filter((e) => e.type === 'node' && e.lat != null).map((n) => [n.id, [n.lat, n.lon]]));
  const rels = osm.routes.filter((e) => e.type === 'relation');

  // Existing data
  const [paragens, vias, municipios] = await Promise.all([
    prisma.paragem.findMany({ select: { id: true, nome: true, codigo: true, geoLocation: true } }),
    prisma.via.findMany({ select: { id: true, codigo: true, nome: true, geoLocationPath: true, municipioId: true, paragens: { select: { paragemId: true } } } }),
    prisma.municipio.findMany({ select: { id: true, codigo: true, nome: true } }),
  ]);
  const existingStops = paragens
    .map((p) => {
      const [lat, lng] = (p.geoLocation ?? '').split(',').map(Number);
      return { ...p, point: [lat, lng] };
    })
    .filter((p) => Number.isFinite(p.point[0]) && Number.isFinite(p.point[1]));
  const existingRoutes = vias
    .map((v) => {
      const pts = (v.geoLocationPath ?? '').split(';').map((c) => c.split(',').map(Number)).filter((c) => c.length === 2 && c.every(Number.isFinite)).map(([lng, lat]) => [lat, lng]);
      return { ...v, points: pts, near: pts.length > 1 ? pathIndex(pts) : () => Infinity, linked: new Set(v.paragens.map((x) => x.paragemId)) };
    });

  // Each OSM stop: the existing stop it is, if any
  for (const s of stops) {
    let best = null;
    for (const p of existingStops) {
      if (Math.abs(p.point[0] - s.point[0]) > 0.001 || Math.abs(p.point[1] - s.point[1]) > 0.001) continue;
      const m = meters(p.point, s.point);
      const ok = m <= EXISTING_ANY_NAME_M || (m <= EXISTING_SAME_NAME_M && similar(p.nome, s.nome));
      if (ok && (!best || m < best.m)) best = { p, m };
    }
    s.existing = best?.p ?? null;
  }

  // Routes: both directions of one ref are one route
  const groups = new Map();
  for (const r of rels) {
    const t = r.tags ?? {};
    const ref = (t.ref ?? `R${r.id}`).replace(/[iv]$/, '');
    const network = (t.network ?? '').replace(/\s+/g, '');
    const key = `${network}|${ref}`;
    if (!groups.has(key)) groups.set(key, { ref, network, rels: [] });
    groups.get(key).rels.push(r);
  }

  const usedCodes = new Set(vias.map((v) => v.codigo));
  const newRoutes = [];
  const duplicates = [];
  const attach = new Map(); // existing via id → Set of OSM stops
  const stopsOnRoutes = new Set();
  let n = 0;
  for (const g of groups.values()) {
    g.rels.sort((a, b) => (/(i)$/.test(b.tags?.ref ?? '') ? 1 : 0) - (/(i)$/.test(a.tags?.ref ?? '') ? 1 : 0));
    const main = g.rels[0];
    // Through the relation's stops by road; its ways joined in order when it has none
    const stopPoints = relationStops(main, nodeAt);
    const routed = stopPoints.length >= 2 ? await routeThrough(stopPoints) : null;
    if (routed === null && stopPoints.length >= 2) throw new Error(`The routers did not answer for ${main.tags?.ref ?? main.id}: run again.`);
    const points = routed?.points ?? relationPath(main, ways);
    if (points.length < 2) continue;
    const near = pathIndex(points);
    // The relations' stops near the path, then every stop within 20 m of it
    const routeStops = new Set();
    for (const r of g.rels) {
      for (const m of r.members) {
        if (m.type !== 'node' || !/stop|platform/.test(m.role)) continue;
        const s = byNode.get(m.ref);
        if (s && near(s.point) <= MEMBER_ON_PATH_M) routeStops.add(s);
      }
    }
    for (const s of stops) if (!routeStops.has(s) && near(s.point) <= STOP_ON_PATH_M) routeStops.add(s);

    // Already in the database? Compared by the new path, and by the ways joined in order, as
    // earlier imports drew it
    const sameAs = (pts, ptsNear) => {
      const probe = samples(pts);
      for (const v of existingRoutes) {
        if (v.points.length < 2) continue;
        const covered = probe.filter((p) => v.near(p) <= DUPLICATE_ROUTE_M).length / probe.length;
        if (covered < 0.85) continue;
        const back = samples(v.points);
        const coveredBack = back.filter((p) => ptsNear(p) <= DUPLICATE_ROUTE_M).length / back.length;
        if (coveredBack >= 0.7) return v;
      }
      return null;
    };
    const t = main.tags ?? {};
    const name = (t.name ?? '').replace(/^[^:]*:\s*/, '').trim() || `${t.from ?? ''} - ${t.to ?? ''}`;
    let dup = sameAs(points, near);
    if (!dup && routed?.points) {
      const joined = relationPath(main, ways);
      if (joined.length >= 2) dup = sameAs(joined, pathIndex(joined));
    }
    // Or a route this import added, whose path was redrawn since (snap-paths, the admin)
    const network = (g.network.split(';')[0] || 'OSM').slice(0, 3).toUpperCase();
    dup ??= existingRoutes.find((v) => [g.ref, `${g.ref}-${network}`].includes(v.codigo) && similar(v.nome, name)) ?? null;
    if (dup) {
      duplicates.push({ ref: g.ref, name, as: `${dup.codigo} ${dup.nome}` });
      if (!attach.has(dup.id)) attach.set(dup.id, new Set());
      for (const s of routeStops) {
        if (dup.near(s.point) > STOP_ON_PATH_M) continue;
        stopsOnRoutes.add(s);
        if (!(s.existing && dup.linked.has(s.existing.id))) attach.get(dup.id).add(s);
      }
      if (!attach.get(dup.id).size) attach.delete(dup.id);
      continue;
    }

    let codigo = g.ref;
    if (usedCodes.has(codigo)) codigo = `${g.ref}-${(g.network.split(';')[0] || 'OSM').slice(0, 3).toUpperCase()}`;
    if (usedCodes.has(codigo)) codigo = `OSM-${main.id}`;
    usedCodes.add(codigo);

    // The municipality where the route starts: Matola lies west of the Infulene valley
    const first = points[0];
    const inMatola = first[1] < MATOLA_EAST_LNG && first[0] > -26.05;
    const municipio = municipios.find((m) => /matola/i.test(m.nome) === inMatola) ?? municipios[0];

    // Stops in order along the path
    const along = [];
    let acc = 0;
    for (let i = 0; i < points.length; i++) {
      if (i) acc += meters(points[i - 1], points[i]);
      along.push(acc);
    }
    const at = (p) => {
      let best = { d: Infinity, a: 0 };
      for (let i = 0; i < points.length - 1; i++) {
        const d = toSegment(p, points[i], points[i + 1]);
        if (d < best.d) best = { d, a: along[i] };
      }
      return best.a;
    };
    const ordered = [...routeStops].map((s) => ({ s, a: at(s.point) })).sort((x, y) => x.a - y.a).map((x) => x.s);
    if (ordered.length < 2) continue;
    for (const s of ordered) stopsOnRoutes.add(s);
    newRoutes.push({
      codigo,
      nome: name,
      ref: g.ref,
      network: g.network,
      osmIds: g.rels.map((r) => r.id),
      terminalPartida: t.from ?? ordered[0].nome ?? '',
      terminalChegada: t.to ?? ordered[ordered.length - 1].nome ?? '',
      cor: PALETTE[n++ % PALETTE.length],
      municipio,
      points,
      km: along[along.length - 1] / 1000,
      stops: ordered,
    });
  }

  // Existing routes pick up the imported stops beside them
  for (const v of existingRoutes) {
    if (v.points.length < 2) continue;
    for (const s of stops) {
      if (s.existing || !stopsOnRoutes.has(s)) continue;
      if (v.near(s.point) <= STOP_ON_PATH_M) {
        if (!attach.has(v.id)) attach.set(v.id, new Set());
        attach.get(v.id).add(s);
      }
    }
  }

  const imported = stops.filter((s) => stopsOnRoutes.has(s));
  return {
    stops,
    imported,
    newStops: imported.filter((s) => !s.existing),
    reused: imported.filter((s) => s.existing),
    unserved: stops.filter((s) => !stopsOnRoutes.has(s)),
    newRoutes,
    duplicates,
    attach,
    vias,
  };
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** The next free plates, in Maputo's format, from the ADA-001M series on */
function plates(taken) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let second = letters.indexOf('D');
  let third = 0;
  let n = 1;
  return () => {
    for (;;) {
      const plate = `A${letters[second]}${letters[third]}-${String(n).padStart(3, '0')}M`;
      if (++n > 999) {
        n = 1;
        if (++third === letters.length) {
          third = 0;
          second++;
        }
      }
      if (!taken.has(plate)) {
        taken.add(plate);
        return plate;
      }
    }
  };
}

const vehicleFor = (network) =>
  /EMTPM|Corujas/i.test(network)
    ? { marca: 'Mercedes-Benz', modelo: 'Sprinter', lotacao: 22 }
    : { marca: 'Toyota', modelo: 'Hiace', lotacao: 15 };

async function backup(prisma, file) {
  const [paragens, vias, viaParagens, transportes] = await Promise.all([
    prisma.paragem.findMany(),
    prisma.via.findMany(),
    prisma.viaParagem.findMany(),
    prisma.transporte.findMany(),
  ]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), paragens, vias, viaParagens, transportes }));
  return { paragens: paragens.length, vias: vias.length, viaParagens: viaParagens.length, transportes: transportes.length };
}

async function apply(prisma, p, log) {
  const code = (s) => (s.existing ? s.existing.codigo : `OSM-${s.osmId}`);
  // Stops
  const before = new Set((await prisma.paragem.findMany({ where: { codigo: { startsWith: 'OSM-' } }, select: { codigo: true } })).map((x) => x.codigo));
  log.paragens = p.newStops.map((s) => `OSM-${s.osmId}`).filter((c) => !before.has(c));
  const created = await prisma.paragem.createMany({
    data: p.newStops.map((s) => ({ nome: s.nome || 'Paragem', codigo: `OSM-${s.osmId}`, geoLocation: `${s.point[0]},${s.point[1]}` })),
    skipDuplicates: true,
  });
  const allStops = await prisma.paragem.findMany({ where: { codigo: { in: p.imported.map(code) } }, select: { id: true, codigo: true } });
  const idOf = new Map(allStops.map((s) => [s.codigo, s.id]));

  // Routes
  let routes = 0;
  let links = 0;
  let buses = 0;
  let nextCodigo = ((await prisma.transporte.aggregate({ _max: { codigo: true } }))._max.codigo ?? 0) + 1;
  const nextPlate = plates(new Set((await prisma.transporte.findMany({ select: { matricula: true } })).map((t) => t.matricula)));
  for (const r of p.newRoutes) {
    const existed = await prisma.via.findUnique({ where: { codigo: r.codigo }, select: { id: true } });
    const via = await prisma.via.upsert({
      where: { codigo: r.codigo },
      update: {},
      create: {
        nome: r.nome,
        codigo: r.codigo,
        cor: r.cor,
        terminalPartida: r.terminalPartida,
        terminalChegada: r.terminalChegada,
        geoLocationPath: r.points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';'),
        codigoMunicipio: r.municipio.codigo,
        municipioId: r.municipio.id,
      },
    });
    if (!existed) {
      routes++;
      log.vias.push(r.codigo);
    }
    const res = await prisma.viaParagem.createMany({
      data: r.stops.map((s, i) => ({ viaId: via.id, paragemId: idOf.get(code(s)), codigoParagem: code(s), codigoVia: r.codigo, terminalBoolean: i === 0 || i === r.stops.length - 1 })).filter((x) => x.paragemId),
      skipDuplicates: true,
    });
    links += res.count;
    if (BUSES_PER_ROUTE > 0) {
      const have = await prisma.transporte.count({ where: { viaId: via.id } });
      for (let i = have; i < BUSES_PER_ROUTE; i++) {
        const matricula = nextPlate();
        await prisma.transporte.create({
          data: { matricula, ...vehicleFor(r.network), cor: '#FFFFFF', codigo: nextCodigo++, codigoVia: r.codigo, viaId: via.id },
        });
        log.transportes.push(matricula);
        buses++;
      }
    }
  }
  for (const [viaId, set] of p.attach) {
    const v = p.vias.find((x) => x.id === viaId);
    const rows = [...set].map((s) => ({ viaId, paragemId: idOf.get(code(s)), codigoParagem: code(s), codigoVia: v.codigo })).filter((x) => x.paragemId);
    const res = await prisma.viaParagem.createMany({ data: rows, skipDuplicates: true });
    links += res.count;
    log.ligacoesAVias.push(...rows.map((x) => ({ via: v.codigo, paragem: x.codigoParagem })));
  }
  return { stops: created.count, routes, links, buses };
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  if (flag('--fetch')) return fetchData();
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
    const p = await plan(prisma);
    const attachCount = [...p.attach.values()].reduce((n, s) => n + s.size, 0);
    console.log(`OSM stops: ${p.stops.length} (after folding stop positions and same-name pairs)`);
    console.log(`  on a route: ${p.imported.length} → ${p.newStops.length} new, ${p.reused.length} already in the database`);
    console.log(`  on no route (not imported): ${p.unserved.length}`);
    console.log(`OSM routes: ${p.newRoutes.length} new, ${p.duplicates.length} already in the database`);
    console.log(`  new routes' stops: ${p.newRoutes.reduce((n, r) => n + r.stops.length, 0)}; km: ${Math.round(p.newRoutes.reduce((n, r) => n + r.km, 0))}`);
    console.log(`  stops added to existing routes: ${attachCount} on ${p.attach.size} routes`);
    if (flag('--verbose')) {
      for (const r of p.newRoutes) console.log(`  + ${r.codigo.padEnd(10)} ${r.nome} (${r.stops.length} stops, ${r.km.toFixed(1)} km, ${r.municipio.nome}) osm ${r.osmIds.join(',')}`);
      for (const d of p.duplicates) console.log(`  = ${d.ref.padEnd(10)} ${d.name} → ${d.as}`);
    }
    if (flag('--json')) fs.writeFileSync(option('--json'), JSON.stringify({ newRoutes: p.newRoutes.map((r) => ({ ...r, stops: r.stops.map((s) => s.nome), points: undefined })), duplicates: p.duplicates }, null, 1));
    if (!flag('--apply')) {
      console.log('\nDry run: nothing written. Add --apply to write.');
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const saved = await backup(prisma, path.join(DATA, `backup-${stamp}.json`));
    console.log(`\nBackup: ${saved.paragens} stops, ${saved.vias} routes, ${saved.viaParagens} links, ${saved.transportes} vehicles → ${path.join(DATA, `backup-${stamp}.json`)}`);
    const log = { at: stamp, paragens: [], vias: [], transportes: [], ligacoesAVias: [] };
    try {
      const done = await apply(prisma, p, log);
      console.log(`Written: ${done.stops} stops, ${done.routes} routes, ${done.links} route-stop links, ${done.buses} vehicles.`);
    } finally {
      fs.writeFileSync(path.join(DATA, `created-${stamp}.json`), JSON.stringify(log, null, 1));
      console.log(`Created rows listed in ${path.join(DATA, `created-${stamp}.json`)}`);
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
