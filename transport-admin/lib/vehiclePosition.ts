import { prisma } from "@/lib/prisma";

/**
 * Onde está um veículo agora: a sua posição GPS real enquanto é recente; quando o GPS se cala a
 * meio da viagem, a andar desde a última posição GPS; senão onde a viagem em curso do motorista o
 * põe; senão parado (fora de serviço). As horas de chegada usam a velocidade média recente do GPS,
 * dentro de limites, e sem GPS a da tarifa. As mesmas regras de
 * transport-client/lib/vehiclePosition.ts (manter as duas iguais), para o painel mostrar o
 * autocarro onde a aplicação dos passageiros, o USSD e o portal do motorista o mostram.
 * Porquê uma cópia: as duas aplicações são publicadas em separado e não partilham pacotes.
 */

type LatLng = [number, number];
type Direction = 1 | -1;

export const GPS_FRESH_MS = 3 * 60 * 1000;
const MAPUTO_UTC_OFFSET_MIN = 120; // Africa/Maputo é UTC+2 todo o ano
const TERMINAL_STOP_S = 5 * 60;
const DEFAULT_SPEED_KMH = 30;
/** A média do GPS só conta entre estas fracções da velocidade da tarifa (como no transport-client) */
const GPS_SPEED_MIN_FACTOR = 0.5;
const GPS_SPEED_MAX_FACTOR = 1.5;
/** Um autocarro parado mais longe do que isto da sua via fica no terminal do início */
const PARKED_ON_ROUTE_M = 300;

export interface VehiclePosition {
  point: LatLng;
  source: "gps" | "horario";
  moving: boolean;
  /** Metros ao longo do percurso da via, quando tem um. */
  progress: number | null;
  /** 1 = para o último ponto do percurso, -1 = de volta; null quando desconhecido. */
  direction: Direction | null;
  /** Segundos até um autocarro parado num terminal partir, na viagem em curso. */
  waitS: number;
  /** O motorista não iniciou a viagem: parado, e os passageiros vêem-no "Fora de serviço" */
  outOfService: boolean;
  at: Date;
  /** Velocidade, em m/s, das horas de chegada a partir desta posição (a média do GPS, ou a da tarifa). */
  speedMps: number;
}

/** Campos a seleccionar em Transporte.motorista para saber a viagem em curso */
export const TRIP_FIELDS = { emViagem: true, viagemIniciadaEm: true, viagemSentido: true } as const;

interface PositionedVehicle {
  id: string;
  currGeoLocation: string | null;
  gpsAtualizadoEm: Date | null;
  gpsDirecao: number | null;
  gpsVelocidade: number | null;
  /** km/h, média recente das posições GPS; null sem GPS ou depois de uma pausa longa */
  gpsVelocidadeMedia?: number | null;
  motorista: { emViagem: boolean; viagemIniciadaEm: Date | null; viagemSentido: number | null } | null;
}

interface Geometry {
  path: LatLng[];
  cumulative: number[];
  length: number;
}

function parseLatLng(geo: string | null | undefined): LatLng | null {
  const [lat, lng] = (geo || "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

function haversine([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
}

function bearing([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Percurso da via "lng,lat;lng,lat" com as distâncias acumuladas. */
export function routeGeometry(geoLocationPath: string | null | undefined): Geometry {
  const path = (geoLocationPath || "")
    .split(";")
    .map((pair) => pair.split(",").map(Number))
    .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(([lng, lat]) => [lat, lng] as LatLng);
  const cumulative = [0];
  for (let i = 1; i < path.length; i++) cumulative.push(cumulative[i - 1] + haversine(path[i - 1], path[i]));
  return { path, cumulative, length: cumulative[cumulative.length - 1] ?? 0 };
}

function nearestIndex(g: Geometry, point: LatLng): number {
  const k = Math.cos((point[0] * Math.PI) / 180);
  let best = 0;
  let bestDist = Infinity;
  g.path.forEach(([lat, lng], i) => {
    const d = (lat - point[0]) ** 2 + ((lng - point[1]) * k) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

function pointAlong(g: Geometry, distance: number): LatLng {
  let i = 1;
  while (i < g.path.length - 1 && g.cumulative[i] < distance) i++;
  const seg = g.cumulative[i] - g.cumulative[i - 1];
  const t = seg > 0 ? Math.min(1, Math.max(0, (distance - g.cumulative[i - 1]) / seg)) : 0;
  const [a, b] = [g.path[i - 1], g.path[i]];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Velocidade de viagem da regra de tarifa activa (Tarifa.velocidadeViagemKmh), em m/s. */
export async function travelSpeedMps(): Promise<number> {
  const rule = await prisma.tarifa.findFirst({ where: { ativa: true }, orderBy: { updatedAt: "desc" } });
  return ((rule?.velocidadeViagemKmh || DEFAULT_SPEED_KMH) * 1000) / 3600;
}

/** A velocidade das horas de chegada: a média recente do GPS, entre metade e uma vez e meia a da tarifa. */
function etaSpeedMps(vehicle: PositionedVehicle, baseMps: number): number {
  const avg = vehicle.gpsVelocidadeMedia;
  if (avg == null || !Number.isFinite(avg)) return baseMps;
  return Math.min(baseMps * GPS_SPEED_MAX_FACTOR, Math.max(baseMps * GPS_SPEED_MIN_FACTOR, (avg * 1000) / 3600));
}

/**
 * O sentido pelo rumo do GPS comparado com o rumo do troço do percurso onde o veículo está (o que
 * passa mais perto de `point`); null parado ou sem rumo. Porquê o troço e não o ponto do percurso
 * mais perto: perto de uma esquina, o troço que começa nesse ponto é o de depois da curva, e o
 * veículo parecia ir ao contrário (como em transport-client/lib/vehiclePosition.ts).
 */
function gpsDirection(vehicle: PositionedVehicle, g: Geometry, point: LatLng): Direction | null {
  if ((vehicle.gpsVelocidade ?? 1) <= 0.5 || vehicle.gpsDirecao == null || g.path.length < 2) return null;
  let a = 0;
  let best = Infinity;
  for (let s = 0; s < g.path.length - 1; s++) {
    const d = segmentDistance(point, g.path[s], g.path[s + 1]);
    if (d < best) {
      best = d;
      a = s;
    }
  }
  const diff = Math.abs(((bearing(g.path[a], g.path[a + 1]) - vehicle.gpsDirecao + 540) % 360) - 180);
  return diff <= 90 ? 1 : -1;
}

/** Distância (ao quadrado, em graus) de `p` ao segmento a–b, num plano local: só serve para comparar. */
function segmentDistance(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos((p[0] * Math.PI) / 180);
  const [ax, ay, bx, by, px, py] = [a[1] * k, a[0], b[1] * k, b[0], p[1] * k, p[0]];
  const [dx, dy] = [bx - ax, by - ay];
  const len = dx * dx + dy * dy;
  const t = len > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
}

/** A viagem em curso: quando começou e de que terminal partiu (1 = início do percurso); null quando parado. */
function tripOf(vehicle: PositionedVehicle): { start: Date; from: Direction } | null {
  const m = vehicle.motorista;
  if (!m?.emViagem || !m.viagemIniciadaEm) return null;
  return { start: new Date(m.viagemIniciadaEm), from: m.viagemSentido === -1 ? -1 : 1 };
}

/** Numa viagem: segundos desde o início → metros ao longo do percurso, a andar ou parado num terminal, e em que sentido. */
function tripAt(elapsedS: number, g: Geometry, speedMps: number, from: Direction): { progress: number; moving: boolean; direction: Direction; waitS: number } {
  const legS = g.length / speedMps;
  const cycleS = 2 * legS + 2 * TERMINAL_STOP_S;
  const t = Math.max(0, elapsedS) % cycleS;
  const first = from === 1 ? 0 : g.length;
  const back = (from * -1) as Direction;
  const at = (along: number, dir: Direction) => (dir === 1 ? along : g.length - along);
  if (t < legS) return { progress: at(t * speedMps, from), moving: true, direction: from, waitS: 0 };
  if (t < legS + TERMINAL_STOP_S) return { progress: g.length - first, moving: false, direction: back, waitS: legS + TERMINAL_STOP_S - t };
  if (t < 2 * legS + TERMINAL_STOP_S) return { progress: at((t - legS - TERMINAL_STOP_S) * speedMps, back), moving: true, direction: back, waitS: 0 };
  return { progress: first, moving: false, direction: from, waitS: cycleS - t };
}

export function vehiclePosition(vehicle: PositionedVehicle, g: Geometry, speedMps: number, now = new Date()): VehiclePosition | null {
  const fix = parseLatLng(vehicle.currGeoLocation);
  const trip = tripOf(vehicle);
  const etaMps = etaSpeedMps(vehicle, speedMps);
  if (fix && vehicle.gpsAtualizadoEm && now.getTime() - vehicle.gpsAtualizadoEm.getTime() < GPS_FRESH_MS) {
    const moving = (vehicle.gpsVelocidade ?? 1) > 0.5 && trip !== null;
    let progress: number | null = null;
    let direction: Direction | null = null;
    if (g.path.length > 1) {
      const i = nearestIndex(g, fix);
      progress = g.cumulative[i];
      direction = trip !== null ? gpsDirection(vehicle, g, fix) : null;
    }
    return { point: fix, source: "gps", moving, progress, direction, waitS: 0, outOfService: trip === null, at: vehicle.gpsAtualizadoEm, speedMps: etaMps };
  }

  const base = { source: "horario" as const, at: now, speedMps };
  if (!trip) {
    // Parado: onde a última viagem acabou, quando está na via, senão no terminal do início
    const parked = { ...base, moving: false, direction: null, waitS: 0, outOfService: true };
    if (g.path.length === 0) return fix ? { ...parked, point: fix, progress: null } : null;
    if (fix && g.path.length > 1) {
      const progress = g.cumulative[nearestIndex(g, fix)];
      const onRoute = pointAlong(g, progress);
      if (haversine(onRoute, fix) <= PARKED_ON_ROUTE_M) return { ...parked, point: onRoute, progress };
    }
    return { ...parked, point: g.path[0], progress: 0 };
  }

  if (g.path.length === 0) {
    return fix ? { ...base, point: fix, moving: false, progress: null, direction: null, waitS: 0, outOfService: false } : null;
  }
  if (g.length < 1) return { ...base, point: g.path[0], moving: false, progress: 0, direction: trip.from, waitS: 0, outOfService: false };
  // O GPS calou-se a meio da viagem: a andar desde a última posição GPS, não desde a hora de início
  if (fix && vehicle.gpsAtualizadoEm && vehicle.gpsAtualizadoEm >= trip.start && vehicle.gpsAtualizadoEm <= now && g.path.length > 1) {
    const i = nearestIndex(g, fix);
    const progress = g.cumulative[i];
    if (haversine(pointAlong(g, progress), fix) <= PARKED_ON_ROUTE_M) {
      const fixS = (vehicle.gpsAtualizadoEm.getTime() - trip.start.getTime()) / 1000;
      const direction = gpsDirection(vehicle, g, fix) ?? tripAt(fixS, g, speedMps, trip.from).direction;
      // Uma viagem equivalente: saiu do terminal atrás dele à hora certa para estar aqui à hora da posição
      const fromTerminal = direction === 1 ? progress : g.length - progress;
      const s = tripAt((now.getTime() - vehicle.gpsAtualizadoEm.getTime()) / 1000 + fromTerminal / etaMps, g, etaMps, direction);
      return { ...base, speedMps: etaMps, point: pointAlong(g, s.progress), moving: s.moving, progress: s.progress, direction: s.direction, waitS: s.waitS, outOfService: false };
    }
  }
  const s = tripAt((now.getTime() - trip.start.getTime()) / 1000, g, speedMps, trip.from);
  return { ...base, point: pointAlong(g, s.progress), moving: s.moving, progress: s.progress, direction: s.direction, waitS: s.waitS, outOfService: false };
}

/** A próxima paragem a que o autocarro chega no seu sentido, e em quantos minutos (à velocidade da posição). */
export function nextStop(
  position: VehiclePosition,
  g: Geometry,
  stops: { nome: string; geoLocation: string | null }[],
): { nome: string; minutos: number } | null {
  const speedMps = position.speedMps;
  if (position.outOfService || position.progress === null || g.path.length < 2) return null;
  const p = position.progress;
  const dir = position.direction ?? 1;
  const located = stops
    .map((s) => ({ nome: s.nome, at: parseLatLng(s.geoLocation) }))
    .filter((s): s is { nome: string; at: LatLng } => s.at !== null)
    .map((s) => ({ nome: s.nome, progress: g.cumulative[nearestIndex(g, s.at)] }));
  // Paragens ainda à frente; um autocarro a caminho de um terminal dá a volta lá
  const ahead = located
    .filter((s) => (dir === 1 ? s.progress > p + 20 : s.progress < p - 20))
    .sort((a, b) => (dir === 1 ? a.progress - b.progress : b.progress - a.progress));
  if (ahead[0]) {
    const meters = Math.abs(ahead[0].progress - p);
    return { nome: ahead[0].nome, minutos: Math.max(1, Math.ceil((position.waitS + meters / speedMps) / 60)) };
  }
  // Nenhuma paragem à frente neste sentido: dá a volta no terminal e depois chega à paragem mais perto dele
  const terminal = dir === 1 ? g.length : 0;
  const first = located.sort((a, b) => Math.abs(terminal - a.progress) - Math.abs(terminal - b.progress))[0];
  if (!first) return null;
  const meters = Math.abs(terminal - p) + Math.abs(terminal - first.progress);
  return { nome: first.nome, minutos: Math.max(1, Math.ceil((position.waitS + TERMINAL_STOP_S + meters / speedMps) / 60)) };
}

/** Tudo o que o painel mostra sobre onde está um veículo. */
export async function positionSummary(vehicle: PositionedVehicle, via: { geoLocationPath: string | null; paragens: { paragem: { nome: string; geoLocation: string | null } }[] } | null) {
  const speed = await travelSpeedMps();
  const g = routeGeometry(via?.geoLocationPath);
  const position = vehiclePosition(vehicle, g, speed);
  if (!position) return null;
  const next = nextStop(position, g, via?.paragens.map((vp) => vp.paragem) ?? []);
  return {
    latitude: position.point[0],
    longitude: position.point[1],
    fonte: position.source,
    emMovimento: position.moving,
    foraDeServico: position.outOfService,
    velocidadeKmh: position.moving
      ? position.source === "gps" && vehicle.gpsVelocidade != null
        ? vehicle.gpsVelocidade
        : Math.round(position.speedMps * 3.6)
      : 0,
    atualizadoEm: position.at.toISOString(),
    proximaParagem: next?.nome ?? null,
    minutosAteProxima: next?.minutos ?? null,
  };
}

/** "07h": a hora de Maputo de um instante */
function hourLabel(ms: number): string {
  const h = Math.floor((((ms / 60000 + MAPUTO_UTC_OFFSET_MIN) % 1440) + 1440) % 1440 / 60);
  return `${String(h).padStart(2, "0")}h`;
}

/** Contas da viagem em curso feitas no máximo sobre este tempo (uma viagem esquecida ligada dias) */
const MAX_TRIP_S = 24 * 3600;

/**
 * A viagem em curso de um veículo, desde que o motorista a iniciou: quilómetros e chegadas a um
 * terminal, por hora, e as próximas horas a que passa em cada paragem em cada sentido. Sem viagem
 * iniciada, o veículo está parado: tudo a zero e sem passagens. O histórico de GPS real não é
 * guardado, por isso estes são os números da viagem à velocidade de viagem da tarifa.
 */
export async function operationSummary(
  vehicle: PositionedVehicle,
  via: { geoLocationPath: string | null; terminalPartida: string; terminalChegada: string; paragens: { paragem: { nome: string; geoLocation: string | null } }[] } | null,
  now = new Date(),
) {
  const g = routeGeometry(via?.geoLocationPath);
  if (!via || g.path.length < 2 || g.length < 1) return null;
  const speed = await travelSpeedMps();
  const legS = g.length / speed;
  const cycleS = 2 * legS + 2 * TERMINAL_STOP_S;
  const trip = tripOf(vehicle);
  const stops = via.paragens
    .map((vp) => ({ nome: vp.paragem.nome, at: parseLatLng(vp.paragem.geoLocation) }))
    .filter((s): s is { nome: string; at: LatLng } => s.at !== null)
    .map((s) => ({ nome: s.nome, progress: g.cumulative[nearestIndex(g, s.at)] }))
    .sort((a, b) => a.progress - b.progress);
  const common = {
    comprimentoKm: Math.round(g.length / 100) / 10,
    minutosPorSentido: Math.round(legS / 60),
    paragens: stops.length,
    // Nomes dos sentidos: o percurso vai do primeiro ponto ao último
    ida: via.terminalChegada,
    volta: via.terminalPartida,
  };
  if (!trip) {
    return {
      ...common,
      emViagem: false,
      iniciadaEm: null,
      horasHoje: 0,
      kmHoje: 0,
      viagensHoje: 0,
      porHora: [] as { hora: string; km: number; kmAcumulado: number; viagens: number }[],
      passagens: stops.map((s) => ({ nome: s.nome, km: Math.round(s.progress / 100) / 10, ida: null, volta: null })),
    };
  }

  // Percorrer a viagem em passos de 30 s, por hora de Maputo
  const startMs = trip.start.getTime();
  const elapsedS = Math.min(Math.max(0, (now.getTime() - startMs) / 1000), MAX_TRIP_S);
  const STEP = 30;
  const buckets = new Map<string, { km: number; viagens: number }>();
  let km = 0;
  let viagens = 0;
  let prev = tripAt(0, g, speed, trip.from);
  for (let s = STEP; s <= elapsedS; s += STEP) {
    const cur = tripAt(s, g, speed, trip.from);
    const d = Math.abs(cur.progress - prev.progress) / 1000;
    const arrived = prev.moving && !cur.moving ? 1 : 0; // chegou a um terminal
    const label = hourLabel(startMs + s * 1000);
    const b = buckets.get(label) ?? { km: 0, viagens: 0 };
    b.km += d;
    b.viagens += arrived;
    buckets.set(label, b);
    km += d;
    viagens += arrived;
    prev = cur;
  }
  let acumulado = 0;
  const porHora = [...buckets].map(([hora, b]) => {
    acumulado += b.km;
    return { hora, km: Math.round(b.km), kmAcumulado: Math.round(acumulado), viagens: b.viagens };
  });

  // Próxima passagem em cada paragem: os segundos do ciclo em que passa nela em cada sentido, mais voltas inteiras
  const nowS = (now.getTime() - startMs) / 1000;
  const nextPass = (cycleT: number) => new Date(startMs + (cycleT + Math.max(0, Math.ceil((nowS - cycleT) / cycleS)) * cycleS) * 1000).toISOString();
  const passIn = (progress: number, dir: Direction) => {
    const along = dir === 1 ? progress : g.length - progress; // metros desde o terminal de onde parte nesse sentido
    return dir === trip.from ? along / speed : legS + TERMINAL_STOP_S + along / speed;
  };
  return {
    ...common,
    emViagem: true,
    iniciadaEm: trip.start.toISOString(),
    horasHoje: Math.round((elapsedS / 3600) * 10) / 10,
    kmHoje: Math.round(km),
    viagensHoje: viagens,
    porHora,
    passagens: stops.map((s) => ({
      nome: s.nome,
      km: Math.round(s.progress / 100) / 10,
      ida: nextPass(passIn(s.progress, 1)),
      volta: nextPass(passIn(s.progress, -1)),
    })),
  };
}
