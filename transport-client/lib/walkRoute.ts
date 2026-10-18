import { distanceMeters, type Point } from './places';

/**
 * Caminhos a pé pelas ruas, do router OSRM a pé da FOSSGIS (dados do OpenStreetMap).
 * A política de uso deles só permite uso leve, no máximo um pedido por segundo, com um user agent
 * que nomeie a aplicação: os resultados ficam em memória (e na CDN, ver /api/walk), os pedidos
 * são espaçados de um segundo, e quando o router está ocupado ou em baixo quem chama desenha uma
 * linha recta. Porquê um router público: é gratuito e chega para o tráfego actual; um servidor
 * próprio (WALK_ROUTER_URL) aguenta mais.
 */

const ROUTER = process.env.WALK_ROUTER_URL ?? 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const USER_AGENT = 'TransportesMocambique/1.0 (+https://github.com/transportmozambique/Transport-Mozambique)';
/** Caminhada mais longa pedida ao router; o planeador nunca anda mais do que 800 m */
export const WALK_ROUTE_MAX_M = 3000;
const TIMEOUT_MS = 4000;
const GAP_MS = 1000;
/** Pedidos que esperariam mais do que isto pela sua vez não são feitos */
const MAX_WAIT_MS = 2500;
const CACHE_SIZE = 2000;

export interface WalkRoute {
  /** Pontos [lng, lat], do início ao fim */
  percurso: [number, number][];
  metros: number;
}

/** O caminho pelas ruas do router entre dois pontos arredondados, sem os próprios pontos */
const cache = new Map<string, WalkRoute | null>();
let nextSlot = 0;

/** Pontos arredondados a 4 casas decimais (cerca de 11 m), para que pedidos próximos partilhem um caminho e a posição exacta não saia do servidor. */
export function roundPoint([lat, lng]: Point): Point {
  return [Math.round(lat * 1e4) / 1e4, Math.round(lng * 1e4) / 1e4];
}

const keyOf = (from: Point, to: Point) => `${from.join(',')};${to.join(',')}`;

function remember(key: string, route: WalkRoute | null) {
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  cache.set(key, route);
}

/**
 * A caminhada de `from` a `to` pelas ruas, ou null quando não se pode ter agora (demasiado longe,
 * o router ocupado ou a falhar). As pontas são ligadas aos pontos exactos dados.
 */
export async function walkRoute(fromRaw: Point, toRaw: Point): Promise<WalkRoute | null> {
  const from = roundPoint(fromRaw);
  const to = roundPoint(toRaw);
  if (distanceMeters(from, to) > WALK_ROUTE_MAX_M) return null;
  const key = keyOf(from, to);
  // O router começa e acaba na rua mais próxima; essas pontas são ligadas aos pontos dados
  const withEnds = (r: WalkRoute | null): WalkRoute | null =>
    r && { percurso: [[fromRaw[1], fromRaw[0]], ...r.percurso, [toRaw[1], toRaw[0]]], metros: r.metros };
  if (cache.has(key)) return withEnds(cache.get(key) ?? null);

  // Um pedido por segundo a partir desta instância
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  if (slot - now > MAX_WAIT_MS) return null;
  nextSlot = slot + GAP_MS;
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));

  try {
    const url = `${ROUTER}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    if (!res.ok) return null; // ocupado (429) ou a falhar: não fica guardado, volta a pedir-se mais tarde
    const data = await res.json();
    const route = data?.routes?.[0];
    const coords: [number, number][] | undefined = route?.geometry?.coordinates;
    if (data?.code !== 'Ok' || !coords?.length) {
      remember(key, null);
      return null;
    }
    const result = { percurso: coords, metros: Math.round(route.distance) };
    remember(key, result);
    return withEnds(result);
  } catch {
    return null;
  }
}
