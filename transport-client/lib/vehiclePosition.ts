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
 * O estado da viagem do motorista (Motorista.emViagem, lib/driverTrips.ts) manda: o portal do
 * motorista, o USSD, a web e o painel mostram o mesmo autocarro no mesmo sítio.
 *
 * - Sem viagem iniciada, o autocarro está parado e fora de serviço: no último sítio onde ficou
 *   (Transporte.currGeoLocation, quando está na via), senão no terminal do início. Não entra nas
 *   viagens, nas horas de chegada nem nos SMS.
 * - Com viagem iniciada, parte do terminal de onde saiu (Motorista.viagemSentido) à hora de início
 *   (viagemIniciadaEm) e vai e volta ao longo do percurso da via (ida, paragem no terminal do fim,
 *   volta, paragem no primeiro terminal) à velocidade de viagem da tarifa, até o motorista terminar.
 * - Uma posição GPS real (POST /api/gps) recente ganha a ambas. Quando o GPS se cala a meio da
 *   viagem, o autocarro continua a partir da última posição GPS, não da hora de início.
 * - As horas de chegada usam a velocidade média recente do GPS (VehiclePosition.speedKmh), dentro
 *   de limites, e sem GPS a velocidade de viagem da tarifa.
 *
 * Depende só da hora, da viagem e do percurso. Porquê: todos os endpoints, os menus USSD e todas
 * as instâncias serverless chegam ao mesmo resultado sem guardar nada, e nada tem de correr em
 * segundo plano.
 *
 * Os sentidos são relativos ao percurso da via: 1 = para o último ponto, -1 = de volta.
 */

/** Uma posição GPS mais antiga do que isto é ignorada e usa-se a posição pela viagem do motorista. */
export const GPS_FRESH_MS = 3 * 60 * 1000;

export const TERMINAL_STOP_S = 5 * 60; // tempo em cada terminal antes da viagem seguinte
const DEFAULT_SPEED_KMH = 30;
/**
 * A média do GPS só conta entre estas fracções da velocidade da tarifa. Porquê: um autocarro preso
 * num semáforo ou à espera no terminal teria horas de chegada absurdas, e uma média de poucos
 * minutos não diz como vai ser o trânsito daqui a 15.
 */
const GPS_SPEED_MIN_FACTOR = 0.5;
const GPS_SPEED_MAX_FACTOR = 1.5;
/** Um autocarro parado mais longe do que isto da sua via fica no terminal do início (posição antiga de outra via) */
const PARKED_ON_ROUTE_M = 300;

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
  /** Segundos até um autocarro parado num terminal partir, na viagem em curso. */
  waitS: number;
  /** Em viagem (o motorista iniciou-a): só estes autocarros entram nas viagens, nas horas e nos SMS. */
  inService: boolean;
  /** Hora da posição GPS, ou o momento em que a posição pela viagem foi calculada. */
  at: Date;
  /** Velocidade, em km/h, das horas de chegada a partir desta posição (etaSpeedKmh). */
  speedKmh: number;
}

/** O estado da viagem do motorista do veículo (Motorista.emViagem, viagemIniciadaEm, viagemSentido). */
export interface TripFields {
  emViagem: boolean;
  viagemIniciadaEm: Date | null;
  viagemSentido: number | null;
}

export interface PositionedVehicle {
  id: string;
  currGeoLocation: string | null;
  gpsAtualizadoEm?: Date | null;
  gpsDirecao?: number | null;
  gpsVelocidade?: number | null;
  /** km/h, média recente das posições GPS (POST /api/gps); null sem GPS ou depois de uma pausa longa. */
  gpsVelocidadeMedia?: number | null;
  /** O motorista do veículo; sem motorista, ou sem viagem iniciada, o veículo está parado */
  motorista: TripFields | null;
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

const speedMps = (rule?: Pick<FareRule, 'velocidadeViagemKmh'>) =>
  ((rule?.velocidadeViagemKmh || DEFAULT_SPEED_KMH) * 1000) / 3600;
const kmhToMps = (kmh: number) => (kmh * 1000) / 3600;

/**
 * A velocidade das horas de chegada de um veículo: a média recente do seu GPS, limitada a entre
 * metade e uma vez e meia a velocidade de viagem da tarifa; sem média, a da tarifa.
 */
export function etaSpeedKmh(
  vehicle: Pick<PositionedVehicle, 'gpsVelocidadeMedia'>,
  rule?: Pick<FareRule, 'velocidadeViagemKmh'>,
): number {
  const base = rule?.velocidadeViagemKmh || DEFAULT_SPEED_KMH;
  const avg = vehicle.gpsVelocidadeMedia;
  if (avg == null || !Number.isFinite(avg)) return base;
  return Math.min(base * GPS_SPEED_MAX_FACTOR, Math.max(base * GPS_SPEED_MIN_FACTOR, avg));
}

/** A viagem em curso do veículo: quando começou e de que terminal partiu; null quando está parado. */
export function tripOf(vehicle: PositionedVehicle): { start: Date; from: Direction } | null {
  const m = vehicle.motorista;
  if (!m?.emViagem || !m.viagemIniciadaEm) return null;
  return { start: new Date(m.viagemIniciadaEm), from: m.viagemSentido === -1 ? -1 : 1 };
}

/**
 * Posição numa viagem iniciada às `start` a partir do terminal `from` (1 = início do percurso,
 * -1 = fim): ida, paragem no outro terminal, volta, paragem no primeiro, e assim até o motorista
 * terminar a viagem.
 */
export function tripPosition(
  g: RouteGeometry,
  start: Date,
  from: Direction,
  now: Date = new Date(),
  rule?: Pick<FareRule, 'velocidadeViagemKmh'>,
): VehiclePosition | null {
  if (g.path.length === 0) return null;
  const base = { source: 'horario' as const, at: now, inService: true, speedKmh: rule?.velocidadeViagemKmh || DEFAULT_SPEED_KMH };
  const first = from === 1 ? 0 : g.length;
  if (g.path.length === 1 || g.length < 1) {
    return { ...base, point: g.path[0], heading: null, moving: false, progress: 0, direction: from, waitS: 0 };
  }

  const v = speedMps(rule);
  const legS = g.length / v;
  const cycleS = 2 * legS + 2 * TERMINAL_STOP_S;
  const t = Math.max(0, (now.getTime() - start.getTime()) / 1000) % cycleS;
  // `along` é a distância desde o terminal de partida; o percurso conta-se sempre do seu primeiro ponto
  const moving = (along: number, dir: Direction): VehiclePosition => {
    const progress = dir === 1 ? along : g.length - along;
    const { point, heading } = pointAlong(g, progress);
    return { ...base, point, heading: dir === 1 ? heading : (heading + 180) % 360, moving: true, progress, direction: dir, waitS: 0 };
  };
  const parked = (progress: number, dir: Direction, waitS: number): VehiclePosition => ({
    ...base,
    point: pointAlong(g, progress).point,
    heading: null,
    moving: false,
    progress,
    direction: dir,
    waitS,
  });

  const back = (from * -1) as Direction;
  if (t < legS) return moving(t * v, from);
  if (t < legS + TERMINAL_STOP_S) return parked(g.length - first, back, legS + TERMINAL_STOP_S - t);
  if (t < 2 * legS + TERMINAL_STOP_S) return moving((t - legS - TERMINAL_STOP_S) * v, back);
  return parked(first, from, cycleS - t);
}

/**
 * Onde fica um autocarro sem viagem: o último sítio guardado quando está na via (onde a última
 * viagem acabou), senão o terminal do início do percurso.
 */
export function parkedPosition(vehicle: PositionedVehicle, g: RouteGeometry, now: Date = new Date()): VehiclePosition | null {
  const last = parseLatLng(vehicle.currGeoLocation);
  const base = { source: 'horario' as const, heading: null, moving: false, direction: null, waitS: 0, inService: false, at: now, speedKmh: DEFAULT_SPEED_KMH };
  if (g.path.length === 0) return last ? { ...base, point: last, progress: null } : null;
  if (last && g.path.length > 1) {
    const progress = progressOf(g, last);
    const onRoute = pointAlong(g, progress).point;
    if (haversineMeters(onRoute, last) <= PARKED_ON_ROUTE_M) return { ...base, point: onRoute, progress };
  }
  return { ...base, point: g.path[0], progress: 0 };
}

/** Verdadeiro quando o veículo enviou uma posição GPS recente o suficiente para confiar nela. */
export function hasFreshGps(vehicle: Pick<PositionedVehicle, 'currGeoLocation' | 'gpsAtualizadoEm'>, now: Date = new Date()): boolean {
  return Boolean(
    vehicle.gpsAtualizadoEm &&
      now.getTime() - new Date(vehicle.gpsAtualizadoEm).getTime() < GPS_FRESH_MS &&
      parseLatLng(vehicle.currGeoLocation),
  );
}

/**
 * Posição actual de um veículo no percurso da sua via (como pontos [lat, lng], uma RouteGeometry
 * ou o texto guardado "lng,lat;lng,lat"): GPS recente, senão a viagem em curso, senão parado.
 */
export function vehiclePosition(
  vehicle: PositionedVehicle,
  path: LatLng[] | RouteGeometry | string | null | undefined,
  now: Date = new Date(),
  rule?: Pick<FareRule, 'velocidadeViagemKmh'>,
): VehiclePosition | null {
  const g = path && !Array.isArray(path) && typeof path === 'object' ? path : routeGeometry(path as LatLng[] | string | null);
  const trip = tripOf(vehicle);

  const speedKmh = etaSpeedKmh(vehicle, rule);

  if (hasFreshGps(vehicle, now)) {
    const point = parseLatLng(vehicle.currGeoLocation)!;
    const moving = (vehicle.gpsVelocidade ?? 1) > 0.5;
    let progress: number | null = null;
    let direction: Direction | null = null;
    if (g.path.length > 1) {
      progress = progressOf(g, point);
      direction = gpsDirection(vehicle, g, point);
    }
    return {
      point,
      source: 'gps',
      heading: vehicle.gpsDirecao ?? null,
      // Sem viagem iniciada o autocarro conta como parado, como o portal do motorista o mostra
      moving: moving && trip !== null,
      progress,
      direction,
      waitS: 0,
      inService: trip !== null,
      at: new Date(vehicle.gpsAtualizadoEm!),
      speedKmh,
    };
  }
  if (!trip) return parkedPosition(vehicle, g, now);
  // O GPS calou-se a meio da viagem: continua a partir da última posição GPS, não da hora de início
  const fromFix = sinceLastFix(vehicle, g, trip, now, { velocidadeViagemKmh: speedKmh }, rule);
  if (fromFix) return fromFix;
  const scheduled = tripPosition(g, trip.start, trip.from, now, rule);
  if (scheduled) return scheduled;
  const last = parseLatLng(vehicle.currGeoLocation);
  return last
    ? { point: last, source: 'horario', heading: null, moving: false, progress: null, direction: null, waitS: 0, inService: true, at: now, speedKmh }
    : null;
}

/** O sentido de um veículo pelo rumo do GPS comparado com o rumo do percurso nesse ponto; null parado ou sem rumo. */
function gpsDirection(vehicle: PositionedVehicle, g: RouteGeometry, point: LatLng): Direction | null {
  if ((vehicle.gpsVelocidade ?? 1) <= 0.5 || vehicle.gpsDirecao == null || g.path.length < 2) return null;
  const i = nearestIndex(g, point);
  const a = i < g.path.length - 1 ? i : i - 1;
  const diff = Math.abs(((bearing(g.path[a], g.path[a + 1]) - vehicle.gpsDirecao + 540) % 360) - 180);
  return diff <= 90 ? 1 : -1;
}

/**
 * Onde está agora um veículo cujo GPS deixou de enviar posições a meio da viagem: a andar desde a
 * última posição GPS, no mesmo sentido, à velocidade `speed`, com as voltas nos terminais. Null
 * quando essa posição é de antes da viagem em curso (de uma viagem anterior) ou fica longe da via.
 * Porquê: a última posição real é mais certa do que onde a hora de início poria o autocarro, e
 * assim ele não salta no mapa nem nos avisos quando o sinal falha.
 */
function sinceLastFix(
  vehicle: PositionedVehicle,
  g: RouteGeometry,
  trip: { start: Date; from: Direction },
  now: Date,
  speed: Pick<FareRule, 'velocidadeViagemKmh'>,
  rule?: Pick<FareRule, 'velocidadeViagemKmh'>,
): VehiclePosition | null {
  if (!vehicle.gpsAtualizadoEm || g.path.length < 2 || g.length < 1) return null;
  const at = new Date(vehicle.gpsAtualizadoEm);
  const point = parseLatLng(vehicle.currGeoLocation);
  if (!point || at < trip.start || at > now) return null;
  const progress = progressOf(g, point);
  if (haversineMeters(pointAlong(g, progress).point, point) > PARKED_ON_ROUTE_M) return null;
  // Parado ou sem rumo na última posição: o sentido que a viagem do motorista tinha nesse momento
  const direction = gpsDirection(vehicle, g, point) ?? tripPosition(g, trip.start, trip.from, at, rule)?.direction ?? trip.from;
  // Uma viagem equivalente: saiu do terminal atrás dele à hora certa para estar aqui às `at`
  const fromTerminal = direction === 1 ? progress : g.length - progress;
  const start = new Date(at.getTime() - (fromTerminal / kmhToMps(speed.velocidadeViagemKmh)) * 1000);
  return tripPosition(g, start, direction, now, speed);
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

/** Velocidade actual em km/h: a do GPS enquanto é recente, senão a da viagem (0 quando parado). */
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
 * onde a viagem põe o autocarro mais tarde. A distância, o tempo e a tarifa medem-se ao longo do
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
  // Um autocarro sem viagem iniciada não vem: só os que o motorista pôs a andar contam
  if (!position?.inService) return null;
  if (g.path.length < 2 || position.progress === null) {
    const trip = estimateTrip(stops, position?.point ?? stops[o].point, origemId, destinoId, rule);
    return trip ? { ...trip, position, sentido: 1 } : null;
  }

  const travel: Direction = d > o ? 1 : -1;
  const atOrigin = progressOf(g, stops[o].point);
  const atDestination = progressOf(g, stops[d].point);
  const v = kmhToMps(position.speedKmh);
  const passFrom = (p: VehiclePosition, afterS: number) => {
    const { meters, turns } = distanceUntilPass(p, g.length, atOrigin, travel);
    return { meters, turns, seconds: afterS + p.waitS + meters / v + turns * TERMINAL_STOP_S };
  };
  const pass = passFrom(position, 0);

  // Distância, tarifa e tempo da viagem todos ao longo do percurso por estrada, como o autocarro o faz
  const distanciaViagem = Math.abs(atDestination - atOrigin);
  return {
    distanciaAteOrigem: pass.meters,
    tempoChegada: Math.max(1, Math.ceil(pass.seconds / 60)),
    jaPassou: pass.turns > 0,
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
 * de um autocarro nas paragens à frente. À velocidade da posição (a média do GPS, ou a da tarifa).
 */
export function minutesUntilPass(
  position: VehiclePosition,
  length: number,
  target: number,
  travel: Direction,
  rule?: Pick<FareRule, 'velocidadeViagemKmh'>,
): number {
  const { meters, turns } = distanceUntilPass(position, length, target, travel);
  const v = position.speedKmh ? kmhToMps(position.speedKmh) : speedMps(rule);
  const seconds = position.waitS + meters / v + turns * TERMINAL_STOP_S;
  return Math.max(0, Math.round(seconds / 60));
}

/** Campos a seleccionar em Transporte para calcular a sua posição (com a viagem do motorista). */
export const POSITION_FIELDS = {
  id: true,
  currGeoLocation: true,
  gpsAtualizadoEm: true,
  gpsDirecao: true,
  gpsVelocidade: true,
  gpsVelocidadeMedia: true,
  motorista: { select: { emViagem: true, viagemIniciadaEm: true, viagemSentido: true } },
} as const;

// Os percursos das vias mudam raramente e são grandes (centenas de pontos por via), por isso cada
// instância serverless guarda-os lidos durante uns minutos em vez de ler ~1 MB a cada actualização do mapa.
const PATH_CACHE_MS = 5 * 60 * 1000;
let pathCache: { at: number; paths: Map<string, RouteGeometry> } | null = null;

/** Geometria do percurso de cada via, por id de Via. */
export async function routePaths(): Promise<Map<string, RouteGeometry>> {
  if (pathCache && Date.now() - pathCache.at < PATH_CACHE_MS) return pathCache.paths;
  const vias = await prisma.via.findMany({ where: { ativa: true }, select: { id: true, geoLocationPath: true } });
  const paths = new Map(vias.map((v) => [v.id, routeGeometry(v.geoLocationPath)]));
  pathCache = { at: Date.now(), paths };
  return paths;
}

/**
 * O estado que a web mostra de um autocarro, o mesmo que o portal do motorista: "Fora de serviço"
 * quando o motorista não iniciou a viagem (o portal diz "Parado"), "No terminal" entre duas
 * viagens da mesma volta, senão "Em circulação".
 */
export function statusLabel(position: VehiclePosition | null): 'Fora de serviço' | 'No terminal' | 'Em circulação' {
  if (!position?.inService) return 'Fora de serviço';
  return position.moving ? 'Em circulação' : 'No terminal';
}
