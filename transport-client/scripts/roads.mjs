/**
 * Partilhado pelos scripts de dados que põem os percursos das rotas nas estradas (snap-paths,
 * redraw-from-osm, import-osm): geometria em pontos [lat, lng], o formato guardado dos percursos e
 * os routers OSRM públicos, cujas respostas ficam em osm-data/road-cache.json.
 *
 * Os routers só permitem uso leve, um pedido por segundo cada: os pedidos de carro alternam entre o
 * router da FOSSGIS e o router de demonstração do OSRM, os pedidos a pé vão para o router a pé da
 * FOSSGIS. Porquê guardar as respostas: uma segunda corrida (a produção depois de uma corrida local)
 * não pergunta nada outra vez. Dados das estradas © contribuidores do OpenStreetMap (ODbL),
 * caminhos por OSRM / FOSSGIS.
 */
import fs from 'node:fs';
import path from 'node:path';

// ─── Geometry ([lat, lng]) ───────────────────────────────────────────────────

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
export function meters(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const lengthM = (points) => points.slice(1).reduce((s, p, i) => s + meters(points[i], p), 0);
const xy = ([lat, lng]) => [rad(lng) * R * Math.cos(rad(-25.9)), rad(lat) * R];
/** Distância em metros de p ao segmento a–b */
export function toSegment(p, a, b) {
  const [px, py] = xy(p);
  const [ax, ay] = xy(a);
  const [bx, by] = xy(b);
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
/** Quanto os pontos de uma estrada se afastam da linha recta a–b, em metros */
export const strayM = (road, a, b) => Math.max(...road.points.map((p) => toSegment(p, a, b)));
/** Douglas–Peucker em metros */
export function simplify(points, tol = 4) {
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
/** Um percurso guardado, "lng,lat;lng,lat;…", como pontos [lat, lng] */
export const parsePath = (text) =>
  (text ?? '')
    .split(';')
    .map((p) => p.split(',').map(Number))
    .filter((p) => p.length === 2 && p.every(Number.isFinite))
    .map(([lng, lat]) => [lat, lng]);
export const formatPath = (points) => points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');

/**
 * O percurso como troços rectos [i, j]: os pontos de i a j ficam a menos de inLineM da linha
 * i–j. As linhas rectas das primeiras rotas estão cortadas em pontos a poucas dezenas de metros
 * uns dos outros; isto lê cada uma delas como um só troço.
 */
export function stretches(points, inLineM = 3) {
  const out = [];
  let i = 0;
  while (i < points.length - 1) {
    let j = i + 1;
    while (j + 1 < points.length) {
      let inLine = true;
      for (let k = i + 1; k <= j && inLine; k++) inLine = toSegment(points[k], points[i], points[j + 1]) <= inLineM;
      if (!inLine) break;
      j++;
    }
    out.push([i, j]);
    i = j;
  }
  return out;
}

// ─── Routers ─────────────────────────────────────────────────────────────────

const USER_AGENT = 'TransportesMocambique/1.0 (+https://github.com/transportmozambique/Transport-Mozambique)';
const ROUTERS = {
  car: ['https://routing.openstreetmap.de/routed-car/route/v1/driving', 'https://router.project-osrm.org/route/v1/driving'],
  foot: ['https://routing.openstreetmap.de/routed-foot/route/v1/foot'],
};
const GAP_MS = 1100;
/** Pontos de passagem por pedido; listas mais longas são divididas, partilhando as pontas */
export const MAX_WAYPOINTS = 25;

let cacheFile = null;
let cache = {};
/** Lê as respostas guardadas de corridas anteriores em <dataDir>/road-cache.json */
export function openCache(dataDir) {
  cacheFile = path.join(dataDir, 'road-cache.json');
  cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
}
function saveCache() {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
}
const pointKey = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
/** As respostas de carro entre dois pontos mantêm a chave das primeiras corridas ("lat,lng;lat,lng") */
const keyOf = (profile, points) => `${profile === 'car' ? '' : `${profile}:`}${points.map(pointKey).join(';')}`;

/**
 * A resposta guardada para este pedido: { m, points, legs } (legs: metros entre pontos de
 * passagem seguidos), null quando o router não encontrou estrada, undefined quando ainda não se perguntou.
 */
export const cached = (profile, points) => cache[keyOf(profile, points)];

async function ask(base, points) {
  const url = `${base}/${points.map(([lat, lng]) => `${lng},${lat}`).join(';')}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20000) });
  if (res.status === 400) return null;
  if (!res.ok) throw new Error(`${base}: HTTP ${res.status}`);
  const data = await res.json();
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route) return null;
  return {
    m: Math.round(route.distance),
    points: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    ...(points.length > 2 ? { legs: route.legs.map((l) => Math.round(l.distance)) } : {}),
  };
}

/**
 * Pergunta aos routers todos os pedidos ({ profile: 'car' | 'foot', points }) que não estão na
 * cache, um pedido por segundo por router, e guarda as respostas.
 */
export async function fetchRoutes(requests, label = 'roads') {
  const seen = new Set();
  const todo = requests.filter((r) => {
    const key = keyOf(r.profile, r.points);
    if (key in cache || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!todo.length) return;
  const routers = Object.values(ROUTERS).flat().length;
  if (todo.length > 10) console.log(`A pedir aos routers ${todo.length} ${label} (cerca de ${Math.ceil(todo.length / Math.min(routers, 2) / 55)} min)…`);
  let done = 0;
  let failures = 0;
  const queues = { car: todo.filter((r) => r.profile === 'car'), foot: todo.filter((r) => r.profile === 'foot') };
  const worker = async (profile, base) => {
    const queue = queues[profile];
    while (queue.length) {
      const r = queue.shift();
      const started = Date.now();
      try {
        cache[keyOf(r.profile, r.points)] = await ask(base, r.points);
      } catch (e) {
        failures++;
        if (failures <= 5) console.warn(`  ${e.message} (pede-se outra vez na corrida seguinte)`);
      }
      if (++done % 100 === 0) {
        saveCache();
        console.log(`  ${done}/${todo.length}`);
      }
      await new Promise((ok) => setTimeout(ok, Math.max(0, GAP_MS - (Date.now() - started))));
    }
  };
  await Promise.all(Object.entries(ROUTERS).flatMap(([profile, bases]) => bases.map((base) => worker(profile, base))));
  saveCache();
  if (failures) console.log(`  ${failures} pedidos falharam; correr outra vez para os acabar.`);
}

// ─── Straight stretches ──────────────────────────────────────────────────────

/** Uma estrada a menos disto da linha recta é a mesma estrada */
export const STRAIGHT_ROAD_M = 50;
/** O mesmo para o caminho a pé, que pode ficar de um lado de uma estrada larga com separador */
const FOOT_ALONG_M = 80;
const CORRIDOR_SHARE = 0.25;
const CORRIDOR_MIN_M = 300;
const MAX_DETOUR = 3;
const MAX_DETOUR_EXTRA_M = 500;

/**
 * O que é um troço recto a–b de m metros, segundo as respostas guardadas:
 * - 'straight': há uma estrada ao longo dele (a de carro, ou a pé onde ruas de sentido único,
 *   estradas com separador ou caminhos de terra mandam os carros dar a volta);
 * - 'road': a estrada de carro fica perto (um quarto do comprimento, pelo menos 300 m) e substitui-o;
 * - 'stray': a estrada de carro vai por outro lado, e nada que se possa andar segue a linha;
 * - 'ask-foot': a estrada de carro afasta-se, e ainda não se perguntou ao router a pé;
 * - 'unknown': ainda não se perguntou ao router de carro.
 */
export function classify(a, b) {
  const m = meters(a, b);
  const car = cached('car', [a, b]);
  if (car === undefined) return { kind: 'unknown', m };
  const off = car ? strayM(car, a, b) : Infinity;
  if (off <= STRAIGHT_ROAD_M) return { kind: 'straight', m };
  if (car && off <= Math.max(CORRIDOR_MIN_M, CORRIDOR_SHARE * m) && car.m <= MAX_DETOUR * m + MAX_DETOUR_EXTRA_M) return { kind: 'road', m, road: car };
  const foot = cached('foot', [a, b]);
  if (foot === undefined) return { kind: 'ask-foot', m };
  if (foot && strayM(foot, a, b) <= FOOT_ALONG_M) return { kind: 'straight', m };
  return { kind: 'stray', m };
}

// ─── Routing through stops ───────────────────────────────────────────────────

/** Uma etapa tão mais longa do que a linha recta dá a volta a um quarteirão: uma paragem do outro lado */
const LOOP_FACTOR = 2;
const LOOP_EXTRA_M = 400;

const chunks = (stops) => {
  const out = [];
  for (let i = 0; i < stops.length - 1; i += MAX_WAYPOINTS - 1) out.push(stops.slice(i, i + MAX_WAYPOINTS));
  return out;
};

/**
 * O caminho pela estrada através das paragens, por ordem, de carro. Uma paragem a que o router só
 * chega dando a volta a um quarteirão (fica do outro lado de uma estrada com separador ou de uma
 * rua de sentido único) é saltada. Devolve { points, dropped }, ou null quando os routers ainda
 * não responderam; points é null quando não há estrada.
 */
export async function routeThrough(stops) {
  let list = stops.filter((p, i) => i === 0 || meters(stops[i - 1], p) > 15);
  if (list.length < 2) return { points: null, dropped: 0 };
  let dropped = 0;
  for (let round = 0; round < 4; round++) {
    const parts = chunks(list);
    await fetchRoutes(parts.map((points) => ({ profile: 'car', points })), 'stop-to-stop routes');
    const answers = parts.map((points) => cached('car', points));
    if (answers.some((a) => a === undefined)) return null;
    if (answers.some((a) => a === null)) return { points: null, dropped };
    // Paragens alcançadas só dando a volta a um quarteirão
    const loops = new Set();
    answers.forEach((a, c) => {
      const legs = a.legs ?? [a.m];
      legs.forEach((leg, k) => {
        const i = c * (MAX_WAYPOINTS - 1) + k;
        if (leg > LOOP_FACTOR * meters(list[i], list[i + 1]) + LOOP_EXTRA_M) loops.add(i + 1 < list.length - 1 ? i + 1 : i);
      });
    });
    loops.delete(0);
    if (!loops.size) {
      const points = [];
      for (const a of answers) points.push(...(points.length ? a.points.slice(1) : a.points));
      return { points: simplify(points), dropped };
    }
    dropped += loops.size;
    list = list.filter((_, i) => !loops.has(i));
  }
  return { points: null, dropped };
}
