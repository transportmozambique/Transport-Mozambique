import { prisma } from './prisma';

/**
 * Fare and travel-time rules shared by the web API and USSD.
 * Values come from the active `Tarifa` row, so prices are changed in the
 * database, not in code.
 */
export interface FareRule {
  tarifaMinima: number;
  precoPorKm: number;
  fatorEstrada: number;
  velocidadeViagemKmh: number;
  velocidadeChegadaKmh: number;
}

// Used only if the table has no active row, so a missing row never breaks quotes.
const DEFAULT_RULE: FareRule = {
  tarifaMinima: 10,
  precoPorKm: 10,
  fatorEstrada: 1.3,
  velocidadeViagemKmh: 30,
  velocidadeChegadaKmh: 45,
};

// Each USSD hop replays the whole menu, so avoid one query per hop.
const CACHE_MS = 60_000;
let cached: { rule: FareRule; at: number } | null = null;

export async function getFareRule(): Promise<FareRule> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.rule;

  const row = await prisma.tarifa.findFirst({
    where: { ativa: true },
    orderBy: { updatedAt: 'desc' },
  });

  const rule: FareRule = row
    ? {
        tarifaMinima: row.tarifaMinima,
        precoPorKm: row.precoPorKm,
        fatorEstrada: row.fatorEstrada,
        velocidadeViagemKmh: row.velocidadeViagemKmh,
        velocidadeChegadaKmh: row.velocidadeChegadaKmh,
      }
    : DEFAULT_RULE;

  cached = { rule, at: Date.now() };
  return rule;
}

export type LatLng = [number, number];

/** Parses a "lat,lng" string; returns null when it is missing or malformed. */
export function parseLatLng(geo: string | null | undefined): LatLng | null {
  if (!geo || !geo.includes(',')) return null;
  const [lat, lng] = geo.split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

/** Great-circle distance in metres. */
export function haversineMeters([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Length in metres of the path through consecutive points (e.g. a route's stops). */
export function pathLengthMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += haversineMeters(points[i], points[i + 1]);
  return total;
}

/** Parses a route path stored as "lng,lat;lng,lat;..." (Via.geoLocationPath). */
export function parseRoutePath(path: string | null | undefined): LatLng[] {
  if (!path) return [];
  return path
    .split(';')
    .map((coord) => {
      const [lng, lat] = coord.split(',').map(Number);
      return [lat, lng] as LatLng;
    })
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

/**
 * Orders a route's stops by where they fall on its drawn path. ViaParagem rows
 * have no sequence column and their id order is not the travel order on most
 * routes, which made stop-to-stop distances (and fares) far too long.
 * Keeps the given order when the route has no path.
 */
export function orderStopsAlongRoute<T>(
  stops: T[],
  geoLocationPath: string | null | undefined,
  geoOf: (stop: T) => string | null | undefined,
): T[] {
  const path = parseRoutePath(geoLocationPath);
  if (path.length < 2) return stops;

  // Index of the nearest path vertex (flat-earth distance is enough to compare)
  const positionOnPath = (geo: string | null | undefined) => {
    const pt = parseLatLng(geo);
    if (!pt) return path.length;
    const k = Math.cos((pt[0] * Math.PI) / 180);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < path.length; i++) {
      const dLat = path[i][0] - pt[0];
      const dLng = (path[i][1] - pt[1]) * k;
      const dist = dLat * dLat + dLng * dLng;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };

  return stops
    .map((stop, i) => ({ stop, i, at: positionOnPath(geoOf(stop)) }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map((s) => s.stop);
}

/** Road-distance estimate for when the route between two points is unknown. */
export function estimatedRoadMeters(from: LatLng, to: LatLng, rule: FareRule): number {
  return haversineMeters(from, to) * rule.fatorEstrada;
}

export function fareFor(distanceMeters: number, rule: FareRule): number {
  return Math.max(rule.tarifaMinima, Math.ceil((distanceMeters / 1000) * rule.precoPorKm));
}

/** Minutes until a bus `distanceMeters` away reaches the stop (at least 1). */
export function arrivalMinutes(distanceMeters: number, rule: FareRule): number {
  return Math.max(1, Math.ceil((distanceMeters / 1000 / rule.velocidadeChegadaKmh) * 60));
}

/** Minutes the passenger spends on board for a journey of `distanceMeters`. */
export function travelMinutes(distanceMeters: number, rule: FareRule): number {
  return Math.ceil((distanceMeters / 1000 / rule.velocidadeViagemKmh) * 60);
}
