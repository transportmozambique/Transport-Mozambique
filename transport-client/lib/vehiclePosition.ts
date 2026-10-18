import { prisma } from './prisma';
import {
  estimateTrip,
  fareFor,
  haversineMeters,
  parseLatLng,
  parseRoutePath,
  projectOnPath,
  type FareRule,
  type LatLng,
  type RouteStop,
  type TripEstimate,
} from './fares';

/**
 * Onde está um veículo agora, e quando chega a uma paragem.
 *
 * - Uma posição GPS real (POST /api/gps) ganha enquanto é recente (GPS_FRESH_MS).
 * - Senão, a posição vem do horário: no horário de serviço cada autocarro vai e volta ao longo do
 *   percurso da sua via (ida, paragem no terminal do fim, volta, paragem no primeiro terminal) à
 *   velocidade de viagem da tarifa, e fora dele fica parado num terminal.
 *   Depende só da hora e do id do autocarro. Porquê: todos os endpoints, os menus USSD e todas as
 *   instâncias serverless chegam ao mesmo resultado sem guardar nada, e nada tem de correr em
 *   segundo plano.
 *
 * Os sentidos são relativos ao percurso da via: 1 = para o último ponto, -1 = de volta.
 */

/** Uma posição GPS mais antiga do que isto é ignorada e usa-se a posição pelo horário. */
export const GPS_FRESH_MS = 3 * 60 * 1000;

const MAPUTO_UTC_OFFSET_MIN = 120; // Africa/Maputo é UTC+2 todo o ano (sem hora de Verão)
export const SERVICE_START_MIN = 5 * 60; // 05:00
export const SERVICE_END_MIN = 21 * 60; // 21:00
export const TERMINAL_STOP_S = 5 * 60; // tempo em cada terminal antes da viagem seguinte
const DEFAULT_SPEED_KMH = 30;

export type PositionSource = 'gps' | 'horario';
export type Direction = 1 | -1;

export interface VehiclePosition {
  point: LatLng;
  source: PositionSource;
  /** Rumo em graus (0 = norte), quando conhecido. */
  heading: number | null;
  moving: boolean;
  /** Metros ao longo do percurso da via (null quando a via não tem percurso). */
  progress: number | null;
  /** Sentido em que se move, ou em que vai sair quando parado; null quando desconhecido. */
  direction: Direction | null;
  /** Segundos até um autocarro parado partir (paragem no terminal, ou de noite até às 05:00). */
  waitS: number;
  /** Hora da posição GPS, ou o momento em que a posição pelo horário foi calculada. */
  at: Date;
}

export interface PositionedVehicle {
  id: string;
  currGeoLocation: string | null;
  gpsAtualizadoEm?: Date | null;
  gpsDirecao?: number | null;
  gpsVelocidade?: number | null;
}

/** Um percurso de via com a distância desde o início até cada ponto. */
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

/** Número estável em [0, 1) a partir de um texto (FNV-1a): espalha os autocarros da mesma via ao longo do dia. */
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

/** Ponto a `distance` metros ao longo do percurso, com o rumo desse segmento. */
export function pointAlong(g: RouteGeometry, distance: number): { point: LatLng; heading: number } {
  let i = 1;
  while (i < g.path.length - 1 && g.cumulative[i] < distance) i++;
  const segment = g.cumulative[i] - g.cumulative[i - 1];
  const t = segment > 0 ? Math.min(1, Math.max(0, (distance - g.cumulative[i - 1]) / segment)) : 0;
  const [lat1, lng1] = g.path[i - 1];
  const [lat2, lng2] = g.path[i];
  return { point: [lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t], heading: bearing(g.path[i - 1], g.path[i]) };
}

/** Índice do ponto do percurso mais próximo de `point` (os percursos têm um ponto a cada ~50 m). */
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

/** Metros ao longo do percurso até ao ponto do percurso mais próximo de `point`. */
export function progressOf(g: RouteGeometry, point: LatLng): number {
  if (g.path.length < 2) return 0;
  const { segment, t } = projectOnPath(g.path, point);
  return g.cumulative[segment] + t * (g.cumulative[segment + 1] - g.cumulative[segment]);
}

/**
 * Distância por estrada entre dois pontos de uma via, ao longo do seu percurso (o percurso segue
 * as estradas e passa por todas as paragens). Null quando a via não tem percurso.
 */
export function distanceAlongPath(path: LatLng[] | string | null | undefined, a: LatLng, b: LatLng): number | null {
  const g = routeGeometry(path);
  if (g.path.length < 2) return null;
  return Math.abs(progressOf(g, b) - progressOf(g, a));
}

/** Minutos desde a meia-noite local em Maputo. */
export function maputoMinutes(now: Date): number {
  const minutes = now.getTime() / 60000 + MAPUTO_UTC_OFFSET_MIN;
  return ((minutes % 1440) + 1440) % 1440;
}

const speedMps = (rule?: Pick<FareRule, 'velocidadeViagemKmh'>) =>
  ((rule?.velocidadeViagemKmh || DEFAULT_SPEED_KMH) * 1000) / 3600;

/** Posição de um autocarro no percurso da sua via, pelo horário. */
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
    // Fora de serviço: parado durante a noite, metade dos autocarros em cada terminal
    const untilStartS = ((((SERVICE_START_MIN - minutes) % 1440) + 1440) % 1440) * 60;
    return phase < 0.5
      ? { ...base, point: g.path[0], heading: null, moving: false, progress: 0, direction: 1, waitS: untilStartS }
      : { ...base, point: g.path[g.path.length - 1], heading: null, moving: false, progress: g.length, direction: -1, waitS: untilStartS };
  }

  // Um ciclo: ida, paragem no terminal do fim, volta, paragem no primeiro terminal.
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

/** Verdadeiro quando o veículo enviou uma posição GPS recente o suficiente para confiar nela. */
export function hasFreshGps(vehicle: PositionedVehicle, now: Date = new Date()): boolean {
  return Boolean(
    vehicle.gpsAtualizadoEm &&
      now.getTime() - new Date(vehicle.gpsAtualizadoEm).getTime() < GPS_FRESH_MS &&
      parseLatLng(vehicle.currGeoLocation),
  );
}

/**
 * Posição actual de um veículo no percurso da sua via (como pontos [lat, lng], uma RouteGeometry
 * ou o texto guardado "lng,lat;lng,lat"). Usa a última posição guardada quando a via não tem
 * percurso.
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
      progress = progressOf(g, point);
      // Sentido a partir do rumo do GPS comparado com o rumo do próprio percurso nesse ponto
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

/** "lat,lng" da posição actual do veículo, no formato de Transporte.currGeoLocation. */
export function vehicleGeo(
  vehicle: PositionedVehicle,
  path: LatLng[] | string | null | undefined,
  now?: Date,
  rule?: Pick<FareRule, 'velocidadeViagemKmh'>,
): string | null {
  const p = vehiclePosition(vehicle, path, now, rule);
  return p ? `${p.point[0].toFixed(6)},${p.point[1].toFixed(6)}` : null;
}

/** Velocidade actual em km/h: a do GPS enquanto é recente, senão a do horário (0 quando parado). */
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
 * Metros que um autocarro em `position` ainda percorre, e quantas voltas faz nos terminais, antes
 * de passar a `target` metros ao longo do percurso no sentido `travel`. Os autocarros vão até ao
 * fim do percurso e voltam, por isso um autocarro que já passou o ponto, ou que vai no outro
 * sentido, primeiro dá a volta num terminal.
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
 * Chegada, tempo de viagem e tarifa para um passageiro que vai de `origemId` a `destinoId` neste
 * autocarro. `stops` está pela ordem do percurso (orderStopsAlongRoute). As viagens podem ir num
 * sentido ou no outro da via: um destino antes da origem é uma viagem na volta.
 *
 * As horas vêm da posição do autocarro no percurso à velocidade de viagem, por isso coincidem com
 * onde o horário põe o autocarro mais tarde. A distância, o tempo e a tarifa medem-se ao longo do
 * percurso. Sem percurso, usa estimateTrip (só viagens no sentido da via).
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
  // Os autocarros pelo horário andam das 05:00 às 21:00 e ficam parados de noite: uma passagem que
  // seria depois das 21:00, ou uma pergunta feita de noite, recebe a primeira passagem do autocarro
  // no dia de serviço seguinte (a mesma que a vista de operação do painel mostra)
  if (position.source === 'horario') {
    const minutes = maputoMinutes(now);
    const inService = minutes >= SERVICE_START_MIN && minutes < SERVICE_END_MIN;
    if (!inService || fromNow.seconds > (SERVICE_END_MIN - minutes) * 60) {
      // Um segundo depois das 05:00, para que o horário já tenha o autocarro a caminho
      const untilStartS = ((((SERVICE_START_MIN - minutes) % 1440) + 1440) % 1440) * 60 + 1;
      const first = scheduledPosition(vehicle.id, g, new Date(now.getTime() + untilStartS * 1000), rule);
      if (first) pass = passFrom(first, untilStartS);
    }
  }

  // Distância, tarifa e tempo da viagem todos ao longo do percurso por estrada, como o autocarro o faz
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

/**
 * Minutos até este autocarro, em `position`, passar a `target` metros ao longo do percurso no
 * sentido `travel`: a chegada a uma paragem para um passageiro já a bordo, ou as próximas passagens
 * de um autocarro nas paragens à frente.
 */
export function minutesUntilPass(
  position: VehiclePosition,
  length: number,
  target: number,
  travel: Direction,
  rule?: Pick<FareRule, 'velocidadeViagemKmh'>,
): number {
  const { meters, turns } = distanceUntilPass(position, length, target, travel);
  const seconds = position.waitS + meters / speedMps(rule) + turns * TERMINAL_STOP_S;
  return Math.max(0, Math.round(seconds / 60));
}

/** Campos a seleccionar em Transporte para calcular a sua posição. */
export const POSITION_FIELDS = {
  id: true,
  currGeoLocation: true,
  gpsAtualizadoEm: true,
  gpsDirecao: true,
  gpsVelocidade: true,
} as const;

// Os percursos das vias mudam raramente e são grandes (centenas de pontos por via), por isso cada
// instância serverless guarda-os lidos durante uns minutos em vez de ler ~1 MB a cada actualização do mapa.
const PATH_CACHE_MS = 5 * 60 * 1000;
let pathCache: { at: number; paths: Map<string, RouteGeometry> } | null = null;

/** Geometria do percurso de cada via, por id de Via. */
export async function routePaths(): Promise<Map<string, RouteGeometry>> {
  if (pathCache && Date.now() - pathCache.at < PATH_CACHE_MS) return pathCache.paths;
  const vias = await prisma.via.findMany({ select: { id: true, geoLocationPath: true } });
  const paths = new Map(vias.map((v) => [v.id, routeGeometry(v.geoLocationPath)]));
  pathCache = { at: Date.now(), paths };
  return paths;
}
