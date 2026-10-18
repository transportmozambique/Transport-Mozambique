import { prisma } from './prisma';

/**
 * Regras de tarifa e de tempo de viagem, partilhadas pela API web e pelo USSD.
 * Os valores vêm da linha activa de `Tarifa`, por isso os preços mudam-se na base de dados (página
 * Tarifa do painel), não no código: não é preciso publicar uma nova versão para mudar um preço.
 */
export interface FareRule {
  tarifaMinima: number;
  precoPorKm: number;
  fatorEstrada: number;
  velocidadeViagemKmh: number;
  velocidadeChegadaKmh: number;
}

// Usado só se a tabela não tiver nenhuma linha activa, para que a falta da linha nunca impeça um preço.
const DEFAULT_RULE: FareRule = {
  tarifaMinima: 10,
  precoPorKm: 10,
  fatorEstrada: 1.3,
  velocidadeViagemKmh: 30,
  velocidadeChegadaKmh: 45,
};

// Cada passo do USSD repete o menu inteiro, por isso evita-se uma consulta por passo.
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

/** Lê um texto "lat,lng"; devolve null quando falta ou está mal formado. */
export function parseLatLng(geo: string | null | undefined): LatLng | null {
  if (!geo || !geo.includes(',')) return null;
  const [lat, lng] = geo.split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

/** Distância em metros sobre a superfície da Terra (círculo máximo). */
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

/** Comprimento em metros do caminho pelos pontos seguidos (ex: as paragens de uma via). */
export function pathLengthMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += haversineMeters(points[i], points[i + 1]);
  return total;
}

/** Lê um percurso guardado como "lng,lat;lng,lat;..." (Via.geoLocationPath). */
export function parseRoutePath(path: string | null | undefined): LatLng[] {
  if (!path) return [];
  let pairs: number[][];
  if (path.trim().startsWith('[')) {
    // Versões antigas do painel guardavam o percurso como um array JSON de [lng, lat]
    try {
      pairs = (JSON.parse(path) as unknown[]).map((p) => (Array.isArray(p) ? p.map(Number) : []));
    } catch {
      return [];
    }
  } else {
    pairs = path.split(';').map((coord) => coord.split(',').map(Number));
  }
  return pairs
    .map(([lng, lat]) => [lat, lng] as LatLng)
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

/**
 * Ordena as paragens de uma via pelo sítio onde ficam no percurso desenhado. As linhas de
 * ViaParagem não têm coluna de ordem e a ordem dos ids não é a ordem de viagem na maioria das
 * vias, o que tornava as distâncias entre paragens (e as tarifas) demasiado longas.
 * Mantém a ordem dada quando a via não tem percurso.
 */
/**
 * Onde `point` fica ao longo de `path`: o segmento mais próximo, e quanto se avançou nele (0 a 1).
 * Os percursos podem ter segmentos rectos longos (uma avenida simplificada), por isso os pontos
 * são projectados nos segmentos, não colados ao vértice mais próximo. Distâncias em plano chegam
 * para comparar.
 */
export function projectOnPath(path: LatLng[], point: LatLng): { segment: number; t: number } {
  const k = Math.cos((point[0] * Math.PI) / 180);
  const px = point[1] * k;
  const py = point[0];
  let best = { segment: 0, t: 0 };
  let bestDist = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const ax = path[i][1] * k;
    const ay = path[i][0];
    const dx = path[i + 1][1] * k - ax;
    const dy = path[i + 1][0] - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    const d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = { segment: i, t };
    }
  }
  return best;
}

export function orderStopsAlongRoute<T>(
  stops: T[],
  geoLocationPath: string | null | undefined,
  geoOf: (stop: T) => string | null | undefined,
): T[] {
  const path = parseRoutePath(geoLocationPath);
  if (path.length < 2) return stops;

  // Segmento e fracção nele, como um só número que ordena pela ordem do percurso
  const positionOnPath = (geo: string | null | undefined) => {
    const pt = parseLatLng(geo);
    if (!pt) return path.length;
    const { segment, t } = projectOnPath(path, pt);
    return segment + t;
  };

  return stops
    .map((stop, i) => ({ stop, i, at: positionOnPath(geoOf(stop)) }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map((s) => s.stop);
}

/** Estimativa da distância por estrada quando não se conhece a via entre dois pontos. */
export function estimatedRoadMeters(from: LatLng, to: LatLng, rule: FareRule): number {
  return haversineMeters(from, to) * rule.fatorEstrada;
}

export function fareFor(distanceMeters: number, rule: FareRule): number {
  return Math.max(rule.tarifaMinima, Math.ceil((distanceMeters / 1000) * rule.precoPorKm));
}

/** Minutos até um autocarro a `distanceMeters` chegar à paragem (pelo menos 1). */
export function arrivalMinutes(distanceMeters: number, rule: FareRule): number {
  return Math.max(1, Math.ceil((distanceMeters / 1000 / rule.velocidadeChegadaKmh) * 60));
}

/** Minutos que o passageiro passa a bordo numa viagem de `distanceMeters`. */
export function travelMinutes(distanceMeters: number, rule: FareRule): number {
  return Math.ceil((distanceMeters / 1000 / rule.velocidadeViagemKmh) * 60);
}

export interface RouteStop {
  id: string;
  point: LatLng;
}

export interface TripEstimate {
  /** Metros que o autocarro ainda tem de percorrer até à paragem de origem */
  distanciaAteOrigem: number;
  /** Minutos até o autocarro chegar à paragem de origem */
  tempoChegada: number;
  /** O autocarro já passou a origem e tem de acabar a volta primeiro */
  jaPassou: boolean;
  /** Metros da origem ao destino ao longo da via */
  distanciaViagem: number;
  tempoViagem: number;
  fare: number;
}

// Espera extra quando o autocarro já passou a origem e tem de dar a volta
const TURNAROUND_MIN = 10;

/**
 * Hora de chegada, distância, tempo de viagem e tarifa para um passageiro que vai de `origemId`
 * a `destinoId` num autocarro em `bus`. `stops` tem de estar pela ordem de viagem (ver
 * orderStopsAlongRoute). Devolve null a não ser que a origem venha antes do destino na via.
 */
export function estimateTrip(
  stops: RouteStop[],
  bus: LatLng,
  origemId: string,
  destinoId: string,
  rule: FareRule,
): TripEstimate | null {
  const o = stops.findIndex((s) => s.id === origemId);
  const d = stops.findIndex((s) => s.id === destinoId);
  if (o === -1 || d === -1 || o >= d) return null;

  const along = (from: number, to: number) => pathLengthMeters(stops.slice(from, to + 1).map((s) => s.point));

  // Onde está o autocarro na via: a paragem mais próxima
  let closest = 0;
  let closestDist = Infinity;
  stops.forEach((s, i) => {
    const dist = haversineMeters(bus, s.point);
    if (dist < closestDist) {
      closestDist = dist;
      closest = i;
    }
  });

  const jaPassou = closest > o;
  const distanciaAteOrigem = jaPassou
    ? closestDist + along(closest, stops.length - 1) + along(0, o)
    : closest === o
      ? haversineMeters(bus, stops[o].point)
      : closestDist + along(closest, o);

  const distanciaViagem = along(o, d);
  return {
    distanciaAteOrigem,
    tempoChegada: arrivalMinutes(distanciaAteOrigem, rule) + (jaPassou ? TURNAROUND_MIN : 0),
    jaPassou,
    distanciaViagem,
    tempoViagem: travelMinutes(distanciaViagem, rule),
    fare: fareFor(distanciaViagem, rule),
  };
}
