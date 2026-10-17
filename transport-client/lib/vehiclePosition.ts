import { prisma } from './prisma';
import {
  estimateTrip,
  fareFor,
  haversineMeters,
  parseLatLng,
  parseRoutePath,
  type FareRule,
  type LatLng,
  type RouteStop,
  type TripEstimate,
} from './fares';

/**
 * Where a vehicle is now, and when it reaches a stop.
 *
 * - A real GPS fix (POST /api/gps) wins while it is fresh (GPS_FRESH_MS).
 * - Otherwise the position comes from the timetable: during service hours each bus shuttles
 *   along its route's path (out, a stop at the far terminal, back, a stop at the first
 *   terminal) at the fare rule's travel speed, and outside them it is parked at a terminal.
 *   It depends only on the time and the bus id, so every endpoint, the USSD menus and every
 *   serverless instance agree, and nothing has to run in the background.
 *
 * Directions are relative to the route's path: 1 = towards its last point, -1 = back.
 */

/** A GPS fix older than this is ignored and the timetable position is used. */
export const GPS_FRESH_MS = 3 * 60 * 1000;

const MAPUTO_UTC_OFFSET_MIN = 120; // Africa/Maputo is UTC+2 all year (no daylight saving)
export const SERVICE_START_MIN = 5 * 60; // 05:00
export const SERVICE_END_MIN = 21 * 60; // 21:00
export const TERMINAL_STOP_S = 5 * 60; // time at each terminal before the next trip
const DEFAULT_SPEED_KMH = 30;

export type PositionSource = 'gps' | 'horario';
export type Direction = 1 | -1;

export interface VehiclePosition {
  point: LatLng;
  source: PositionSource;
  /** Bearing in degrees (0 = north), when known. */
  heading: number | null;
  moving: boolean;
  /** Metres along the route's path (null when the route has no path). */
  progress: number | null;
  /** Direction it is moving in, or will leave in when stopped; null when unknown. */
  direction: Direction | null;
  /** Seconds before a stopped bus leaves (terminal stop, or overnight until 05:00). */
  waitS: number;
  /** Time of the GPS fix, or the moment the timetable position was computed. */
  at: Date;
}

export interface PositionedVehicle {
  id: string;
  currGeoLocation: string | null;
  gpsAtualizadoEm?: Date | null;
  gpsDirecao?: number | null;
  gpsVelocidade?: number | null;
}

/** A route path with the distance from its start to each point. */
export interface RouteGeometry {
  path: LatLng[];
  cumulative: number[];
  length: number;
}

const geometryCache = new WeakMap<LatLng[], RouteGeometry>();

export function routeGeometry(path: LatLng[] | string | null | undefined): RouteGeometry {
  const points = typeof path === 'string' || path == null ? parseRoutePath(path) : path;
  const cached = geometryCache.get(points);
  if (cached) return cached;
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + haversineMeters(points[i - 1], points[i]));
  const geometry = { path: points, cumulative, length: cumulative[cumulative.length - 1] ?? 0 };
  geometryCache.set(points, geometry);
  return geometry;
}

/** Stable number in [0, 1) from a string (FNV-1a). */
function unitHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

function bearing([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point at `distance` metres along the path, with the bearing of that segment. */
function pointAlong(g: RouteGeometry, distance: number): { point: LatLng; heading: number } {
  let i = 1;
  while (i < g.path.length - 1 && g.cumulative[i] < distance) i++;
  const segment = g.cumulative[i] - g.cumulative[i - 1];
  const t = segment > 0 ? Math.min(1, Math.max(0, (distance - g.cumulative[i - 1]) / segment)) : 0;
  const [lat1, lng1] = g.path[i - 1];
  const [lat2, lng2] = g.path[i];
  return { point: [lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t], heading: bearing(g.path[i - 1], g.path[i]) };
}

/** Index of the path point nearest to `point` (the paths have a point every ~50 m). */
function nearestIndex(g: RouteGeometry, point: LatLng): number {
  const k = Math.cos((point[0] * Math.PI) / 180);
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < g.path.length; i++) {
    const dLat = g.path[i][0] - point[0];
    const dLng = (g.path[i][1] - point[1]) * k;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Metres along the path to the point nearest `point`. */
export function progressOf(g: RouteGeometry, point: LatLng): number {
  return g.path.length ? g.cumulative[nearestIndex(g, point)] : 0;
}

/**
 * Road distance between two points of a route, along its path (the path follows the roads and
 * passes by every stop). Null when the route has no path.
 */
export function distanceAlongPath(path: LatLng[] | string | null | undefined, a: LatLng, b: LatLng): number | null {
  const g = routeGeometry(path);
  if (g.path.length < 2) return null;
  return Math.abs(progressOf(g, b) - progressOf(g, a));
}

/** Minutes since local midnight in Maputo. */
export function maputoMinutes(now: Date): number {
  const minutes = now.getTime() / 60000 + MAPUTO_UTC_OFFSET_MIN;
  return ((minutes % 1440) + 1440) % 1440;
}

const speedMps = (rule?: Pick<FareRule, 'velocidadeViagemKmh'>) =>
  ((rule?.velocidadeViagemKmh || DEFAULT_SPEED_KMH) * 1000) / 3600;

/** Timetable position of a bus on its route path. */
export function scheduledPosition(
  busId: string,
  path: LatLng[] | RouteGeometry,
  now: Date = new Date(),
  rule?: Pick<FareRule, 'velocidadeViagemKmh'>,
): VehiclePosition | null {
  const g = Array.isArray(path) ? routeGeometry(path) : path;
  if (g.path.length === 0) return null;
  const phase = unitHash(busId);
  const base = { source: 'horario' as const, at: now };
  if (g.path.length === 1 || g.length < 1) {
    return { ...base, point: g.path[0], heading: null, moving: false, progress: 0, direction: null, waitS: 0 };
  }

  const minutes = maputoMinutes(now);
  if (minutes < SERVICE_START_MIN || minutes >= SERVICE_END_MIN) {
    // Out of service: parked overnight, half of the buses at each terminal
    const untilStartS = ((((SERVICE_START_MIN - minutes) % 1440) + 1440) % 1440) * 60;
    return phase < 0.5
      ? { ...base, point: g.path[0], heading: null, moving: false, progress: 0, direction: 1, waitS: untilStartS }
      : { ...base, point: g.path[g.path.length - 1], heading: null, moving: false, progress: g.length, direction: -1, waitS: untilStartS };
  }

  // One cycle: outbound, stop at the far terminal, inbound, stop at the first terminal.
  const v = speedMps(rule);
  const legS = g.length / v;
  const cycleS = 2 * legS + 2 * TERMINAL_STOP_S;
  const t = ((minutes - SERVICE_START_MIN) * 60 + phase * cycleS) % cycleS;

  if (t < legS) {
    const progress = t * v;
    const { point, heading } = pointAlong(g, progress);
    return { ...base, point, heading, moving: true, progress, direction: 1, waitS: 0 };
  }
  if (t < legS + TERMINAL_STOP_S) {
    return { ...base, point: g.path[g.path.length - 1], heading: null, moving: false, progress: g.length, direction: -1, waitS: legS + TERMINAL_STOP_S - t };
  }
  if (t < 2 * legS + TERMINAL_STOP_S) {
    const progress = g.length - (t - legS - TERMINAL_STOP_S) * v;
    const { point, heading } = pointAlong(g, progress);
    return { ...base, point, heading: (heading + 180) % 360, moving: true, progress, direction: -1, waitS: 0 };
  }
  return { ...base, point: g.path[0], heading: null, moving: false, progress: 0, direction: 1, waitS: cycleS - t };
}

/** True when the vehicle sent a GPS fix recently enough to trust it. */
export function hasFreshGps(vehicle: PositionedVehicle, now: Date = new Date()): boolean {
  return Boolean(
    vehicle.gpsAtualizadoEm &&
      now.getTime() - new Date(vehicle.gpsAtualizadoEm).getTime() < GPS_FRESH_MS &&
      parseLatLng(vehicle.currGeoLocation),
  );
}

/**
 * Current position of a vehicle on its route's path (as [lat, lng] points, a RouteGeometry or
 * the stored "lng,lat;lng,lat" string). Falls back to the last stored position when the route
 * has no path.
 */
export function vehiclePosition(
  vehicle: PositionedVehicle,
  path: LatLng[] | RouteGeometry | string | null | undefined,
  now: Date = new Date(),
  rule?: Pick<FareRule, 'velocidadeViagemKmh'>,
): VehiclePosition | null {
  const g = path && !Array.isArray(path) && typeof path === 'object' ? path : routeGeometry(path as LatLng[] | string | null);

  if (hasFreshGps(vehicle, now)) {
    const point = parseLatLng(vehicle.currGeoLocation)!;
    const moving = (vehicle.gpsVelocidade ?? 1) > 0.5;
    let progress: number | null = null;
    let direction: Direction | null = null;
    if (g.path.length > 1) {
      const i = nearestIndex(g, point);
      progress = g.cumulative[i];
      // Direction from the GPS bearing compared with the path's own bearing there
      if (moving && vehicle.gpsDirecao != null) {
        const a = i < g.path.length - 1 ? i : i - 1;
        const diff = Math.abs(((bearing(g.path[a], g.path[a + 1]) - vehicle.gpsDirecao + 540) % 360) - 180);
        direction = diff <= 90 ? 1 : -1;
      }
    }
    return {
      point,
      source: 'gps',
      heading: vehicle.gpsDirecao ?? null,
      moving,
      progress,
      direction,
      waitS: 0,
      at: new Date(vehicle.gpsAtualizadoEm!),
    };
  }
  const scheduled = scheduledPosition(vehicle.id, g, now, rule);
  if (scheduled) return scheduled;
  const last = parseLatLng(vehicle.currGeoLocation);
  return last
    ? { point: last, source: 'horario', heading: null, moving: false, progress: null, direction: null, waitS: 0, at: now }
    : null;
}

/** "lat,lng" of the vehicle's current position, in the format of Transporte.currGeoLocation. */
export function vehicleGeo(
  vehicle: PositionedVehicle,
  path: LatLng[] | string | null | undefined,
  now?: Date,
  rule?: Pick<FareRule, 'velocidadeViagemKmh'>,
): string | null {
  const p = vehiclePosition(vehicle, path, now, rule);
  return p ? `${p.point[0].toFixed(6)},${p.point[1].toFixed(6)}` : null;
}

/** Speed now in km/h: the GPS speed while the GPS is fresh, else the timetable's (0 when parked). */
export function currentSpeedKmh(
  vehicle: PositionedVehicle,
  position: VehiclePosition | null,
  rule?: Pick<FareRule, 'velocidadeViagemKmh'>,
): number {
  if (!position) return 0;
  if (position.source === 'gps') return Math.round(vehicle.gpsVelocidade ?? 0);
  return position.moving ? rule?.velocidadeViagemKmh || DEFAULT_SPEED_KMH : 0;
}

/**
 * Metres a bus at `position` still drives, and how many terminal turnarounds it makes, before
 * it passes `target` metres along the path moving in direction `travel`. Buses go to the end
 * of the path and come back, so a bus that already passed the point, or that is going the
 * other way, first turns around at a terminal.
 */
export function distanceUntilPass(
  position: Pick<VehiclePosition, 'progress' | 'direction'>,
  length: number,
  target: number,
  travel: Direction,
): { meters: number; turns: number } {
  const p = position.progress ?? 0;
  const dir = position.direction ?? travel;
  if (dir === travel) {
    const ahead = travel === 1 ? target - p : p - target;
    if (ahead >= 0) return { meters: ahead, turns: 0 };
    return { meters: travel === 1 ? length - p + length + target : p + length + (length - target), turns: 2 };
  }
  return { meters: travel === 1 ? p + target : length - p + (length - target), turns: 1 };
}

/**
 * Arrival, trip time and fare for a passenger going from `origemId` to `destinoId` on this
 * bus. `stops` are in path order (orderStopsAlongRoute). Trips can go either way along the
 * route: a destination before the origin is a trip on the return leg.
 *
 * Times come from the bus's position on the path at the travel speed, so they match where the
 * timetable puts the bus later. Trip distance, time and fare are measured along the path.
 * Without a route path it falls back to estimateTrip (forward trips only).
 */
export function estimateBusTrip(args: {
  vehicle: PositionedVehicle;
  path: LatLng[] | string | null | undefined;
  stops: RouteStop[];
  origemId: string;
  destinoId: string;
  rule: FareRule;
  now?: Date;
}): (TripEstimate & { position: VehiclePosition | null; sentido: Direction }) | null {
  const { vehicle, stops, origemId, destinoId, rule } = args;
  const now = args.now ?? new Date();
  const o = stops.findIndex((s) => s.id === origemId);
  const d = stops.findIndex((s) => s.id === destinoId);
  if (o === -1 || d === -1 || o === d) return null;

  const g = routeGeometry(args.path);
  const position = vehiclePosition(vehicle, g, now, rule);
  if (g.path.length < 2 || !position || position.progress === null) {
    const trip = estimateTrip(stops, position?.point ?? stops[o].point, origemId, destinoId, rule);
    return trip ? { ...trip, position, sentido: 1 } : null;
  }

  const travel: Direction = d > o ? 1 : -1;
  const atOrigin = progressOf(g, stops[o].point);
  const atDestination = progressOf(g, stops[d].point);
  const v = speedMps(rule);
  const passFrom = (p: VehiclePosition, afterS: number) => {
    const { meters, turns } = distanceUntilPass(p, g.length, atOrigin, travel);
    return { meters, turns, seconds: afterS + p.waitS + meters / v + turns * TERMINAL_STOP_S };
  };
  const fromNow = passFrom(position, 0);
  let pass = fromNow;
  // Timetable buses run 05:00-21:00 and are parked overnight: a pass that would come after
  // 21:00, or a question asked at night, gets the bus's first pass of the next service day
  // (the same pass the admin's operation view shows)
  if (position.source === 'horario') {
    const minutes = maputoMinutes(now);
    const inService = minutes >= SERVICE_START_MIN && minutes < SERVICE_END_MIN;
    if (!inService || fromNow.seconds > (SERVICE_END_MIN - minutes) * 60) {
      // One second past 05:00, so the timetable already has the bus on its way
      const untilStartS = ((((SERVICE_START_MIN - minutes) % 1440) + 1440) % 1440) * 60 + 1;
      const first = scheduledPosition(vehicle.id, g, new Date(now.getTime() + untilStartS * 1000), rule);
      if (first) pass = passFrom(first, untilStartS);
    }
  }

  // Distance, fare and time of the trip all along the road path, as the bus drives it
  const distanciaViagem = Math.abs(atDestination - atOrigin);
  return {
    distanciaAteOrigem: pass.meters,
    tempoChegada: Math.max(1, Math.ceil(pass.seconds / 60)),
    jaPassou: fromNow.turns > 0,
    distanciaViagem,
    tempoViagem: Math.max(1, Math.ceil(distanciaViagem / v / 60)),
    fare: fareFor(distanciaViagem, rule),
    position,
    sentido: travel,
  };
}

/** Fields to select on Transporte to compute its position. */
export const POSITION_FIELDS = {
  id: true,
  currGeoLocation: true,
  gpsAtualizadoEm: true,
  gpsDirecao: true,
  gpsVelocidade: true,
} as const;

// Route paths change rarely and are large (hundreds of points per route), so each serverless
// instance keeps them parsed for a few minutes instead of reading ~1 MB on every map refresh.
const PATH_CACHE_MS = 5 * 60 * 1000;
let pathCache: { at: number; paths: Map<string, RouteGeometry> } | null = null;

/** Geometry of every route's path, by Via id. */
export async function routePaths(): Promise<Map<string, RouteGeometry>> {
  if (pathCache && Date.now() - pathCache.at < PATH_CACHE_MS) return pathCache.paths;
  const vias = await prisma.via.findMany({ select: { id: true, geoLocationPath: true } });
  const paths = new Map(vias.map((v) => [v.id, routeGeometry(v.geoLocationPath)]));
  pathCache = { at: Date.now(), paths };
  return paths;
}
