import { distanceMeters, type Point } from './places';

/**
 * Walking paths along the streets, from the OSRM foot router of FOSSGIS (OpenStreetMap data).
 * Their usage policy allows light use only, one request a second at most, with a user agent
 * naming the application: results are kept in memory (and in the CDN, see /api/walk), requests
 * are spaced a second apart, and when the router is busy or down the caller draws a straight line.
 */

const ROUTER = process.env.WALK_ROUTER_URL ?? 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const USER_AGENT = 'TransportesMocambique/1.0 (+https://github.com/transportmozambique/Transport-Mozambique)';
/** Longest walk routed; the planner never walks further than 800 m */
export const WALK_ROUTE_MAX_M = 3000;
const TIMEOUT_MS = 4000;
const GAP_MS = 1000;
/** Requests that would wait longer than this for their turn are not made */
const MAX_WAIT_MS = 2500;
const CACHE_SIZE = 2000;

export interface WalkRoute {
  /** [lng, lat] points, from the start to the end */
  percurso: [number, number][];
  metros: number;
}

/** The router's street path between two rounded points, without the points themselves */
const cache = new Map<string, WalkRoute | null>();
let nextSlot = 0;

/** Points rounded to 4 decimals (about 11 m), so nearby requests share a route. */
export function roundPoint([lat, lng]: Point): Point {
  return [Math.round(lat * 1e4) / 1e4, Math.round(lng * 1e4) / 1e4];
}

const keyOf = (from: Point, to: Point) => `${from.join(',')};${to.join(',')}`;

function remember(key: string, route: WalkRoute | null) {
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  cache.set(key, route);
}

/**
 * The walk from `from` to `to` along the streets, or null when it cannot be had now (too far,
 * the router busy or failing). The ends are joined to the exact points given.
 */
export async function walkRoute(fromRaw: Point, toRaw: Point): Promise<WalkRoute | null> {
  const from = roundPoint(fromRaw);
  const to = roundPoint(toRaw);
  if (distanceMeters(from, to) > WALK_ROUTE_MAX_M) return null;
  const key = keyOf(from, to);
  // The router starts and ends on the nearest street; those ends are joined to the points given
  const withEnds = (r: WalkRoute | null): WalkRoute | null =>
    r && { percurso: [[fromRaw[1], fromRaw[0]], ...r.percurso, [toRaw[1], toRaw[0]]], metros: r.metros };
  if (cache.has(key)) return withEnds(cache.get(key) ?? null);

  // One request a second from this instance
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  if (slot - now > MAX_WAIT_MS) return null;
  nextSlot = slot + GAP_MS;
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));

  try {
    const url = `${ROUTER}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    if (!res.ok) return null; // busy (429) or failing: not remembered, asked again later
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
