import { prisma } from "@/lib/prisma";

/**
 * Where a vehicle is now: its real GPS fix while fresh, otherwise its timetable position on
 * its route. Same rules as transport-client/lib/vehiclePosition.ts (keep both in sync), so
 * the dashboard shows the bus where the passenger app and USSD show it.
 */

type LatLng = [number, number];

export const GPS_FRESH_MS = 3 * 60 * 1000;
const MAPUTO_UTC_OFFSET_MIN = 120; // Africa/Maputo is UTC+2 all year
const SERVICE_START_MIN = 5 * 60; // 05:00
const SERVICE_END_MIN = 21 * 60; // 21:00
const TERMINAL_STOP_S = 5 * 60;
const DEFAULT_SPEED_KMH = 30;

export interface VehiclePosition {
  point: LatLng;
  source: "gps" | "horario";
  moving: boolean;
  /** Metres along the route path, when it has one. */
  progress: number | null;
  /** 1 = towards the path's last point, -1 = back; null when unknown. */
  direction: 1 | -1 | null;
  /** Seconds before a stopped bus leaves (terminal stop, or overnight). */
  waitS: number;
  outOfService: boolean;
  at: Date;
}

interface PositionedVehicle {
  id: string;
  currGeoLocation: string | null;
  gpsAtualizadoEm: Date | null;
  gpsDirecao: number | null;
  gpsVelocidade: number | null;
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

/** Route path "lng,lat;lng,lat" with cumulative distances. */
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

function unitHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

function pointAlong(g: Geometry, distance: number): LatLng {
  let i = 1;
  while (i < g.path.length - 1 && g.cumulative[i] < distance) i++;
  const seg = g.cumulative[i] - g.cumulative[i - 1];
  const t = seg > 0 ? Math.min(1, Math.max(0, (distance - g.cumulative[i - 1]) / seg)) : 0;
  const [a, b] = [g.path[i - 1], g.path[i]];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Travel speed of the active fare rule (Tarifa.velocidadeViagemKmh), in m/s. */
export async function travelSpeedMps(): Promise<number> {
  const rule = await prisma.tarifa.findFirst({ where: { ativa: true }, orderBy: { updatedAt: "desc" } });
  return ((rule?.velocidadeViagemKmh || DEFAULT_SPEED_KMH) * 1000) / 3600;
}

export function vehiclePosition(vehicle: PositionedVehicle, g: Geometry, speedMps: number, now = new Date()): VehiclePosition | null {
  const fix = parseLatLng(vehicle.currGeoLocation);
  if (fix && vehicle.gpsAtualizadoEm && now.getTime() - vehicle.gpsAtualizadoEm.getTime() < GPS_FRESH_MS) {
    const moving = (vehicle.gpsVelocidade ?? 1) > 0.5;
    let progress: number | null = null;
    let direction: 1 | -1 | null = null;
    if (g.path.length > 1) {
      const i = nearestIndex(g, fix);
      progress = g.cumulative[i];
      if (moving && vehicle.gpsDirecao != null) {
        const a = i < g.path.length - 1 ? i : i - 1;
        const diff = Math.abs(((bearing(g.path[a], g.path[a + 1]) - vehicle.gpsDirecao + 540) % 360) - 180);
        direction = diff <= 90 ? 1 : -1;
      }
    }
    return { point: fix, source: "gps", moving, progress, direction, waitS: 0, outOfService: false, at: vehicle.gpsAtualizadoEm };
  }

  if (g.path.length === 0) {
    return fix ? { point: fix, source: "horario", moving: false, progress: null, direction: null, waitS: 0, outOfService: false, at: now } : null;
  }
  const base = { source: "horario" as const, at: now };
  const phase = unitHash(vehicle.id);
  const minutes = (((now.getTime() / 60000 + MAPUTO_UTC_OFFSET_MIN) % 1440) + 1440) % 1440;
  if (g.length < 1) return { ...base, point: g.path[0], moving: false, progress: 0, direction: null, waitS: 0, outOfService: false };
  if (minutes < SERVICE_START_MIN || minutes >= SERVICE_END_MIN) {
    const waitS = ((((SERVICE_START_MIN - minutes) % 1440) + 1440) % 1440) * 60;
    return phase < 0.5
      ? { ...base, point: g.path[0], moving: false, progress: 0, direction: 1, waitS, outOfService: true }
      : { ...base, point: g.path[g.path.length - 1], moving: false, progress: g.length, direction: -1, waitS, outOfService: true };
  }
  const legS = g.length / speedMps;
  const cycleS = 2 * legS + 2 * TERMINAL_STOP_S;
  const t = ((minutes - SERVICE_START_MIN) * 60 + phase * cycleS) % cycleS;
  if (t < legS) {
    const progress = t * speedMps;
    return { ...base, point: pointAlong(g, progress), moving: true, progress, direction: 1, waitS: 0, outOfService: false };
  }
  if (t < legS + TERMINAL_STOP_S) {
    return { ...base, point: g.path[g.path.length - 1], moving: false, progress: g.length, direction: -1, waitS: legS + TERMINAL_STOP_S - t, outOfService: false };
  }
  if (t < 2 * legS + TERMINAL_STOP_S) {
    const progress = g.length - (t - legS - TERMINAL_STOP_S) * speedMps;
    return { ...base, point: pointAlong(g, progress), moving: true, progress, direction: -1, waitS: 0, outOfService: false };
  }
  return { ...base, point: g.path[0], moving: false, progress: 0, direction: 1, waitS: cycleS - t, outOfService: false };
}

/** The next stop the bus reaches in its direction of travel, and in how many minutes. */
export function nextStop(
  position: VehiclePosition,
  g: Geometry,
  stops: { nome: string; geoLocation: string | null }[],
  speedMps: number,
): { nome: string; minutos: number } | null {
  if (position.progress === null || g.path.length < 2) return null;
  const p = position.progress;
  const dir = position.direction ?? 1;
  const located = stops
    .map((s) => ({ nome: s.nome, at: parseLatLng(s.geoLocation) }))
    .filter((s): s is { nome: string; at: LatLng } => s.at !== null)
    .map((s) => ({ nome: s.nome, progress: g.cumulative[nearestIndex(g, s.at)] }));
  // Stops still ahead; a bus on its way to a terminal turns around there
  const ahead = located
    .filter((s) => (dir === 1 ? s.progress > p + 20 : s.progress < p - 20))
    .sort((a, b) => (dir === 1 ? a.progress - b.progress : b.progress - a.progress));
  if (ahead[0]) {
    const meters = Math.abs(ahead[0].progress - p);
    return { nome: ahead[0].nome, minutos: Math.max(1, Math.ceil((position.waitS + meters / speedMps) / 60)) };
  }
  // No stop left in this direction: it turns at the terminal, then meets the stop nearest to it
  const terminal = dir === 1 ? g.length : 0;
  const first = located.sort((a, b) => Math.abs(terminal - a.progress) - Math.abs(terminal - b.progress))[0];
  if (!first) return null;
  const meters = Math.abs(terminal - p) + Math.abs(terminal - first.progress);
  return { nome: first.nome, minutos: Math.max(1, Math.ceil((position.waitS + TERMINAL_STOP_S + meters / speedMps) / 60)) };
}

/** Everything the dashboard shows about where a vehicle is. */
export async function positionSummary(vehicle: PositionedVehicle, via: { geoLocationPath: string | null; paragens: { paragem: { nome: string; geoLocation: string | null } }[] } | null) {
  const speed = await travelSpeedMps();
  const g = routeGeometry(via?.geoLocationPath);
  const position = vehiclePosition(vehicle, g, speed);
  if (!position) return null;
  const next = nextStop(position, g, via?.paragens.map((vp) => vp.paragem) ?? [], speed);
  return {
    latitude: position.point[0],
    longitude: position.point[1],
    fonte: position.source,
    emMovimento: position.moving,
    foraDeServico: position.outOfService,
    velocidadeKmh: position.moving
      ? position.source === "gps" && vehicle.gpsVelocidade != null
        ? vehicle.gpsVelocidade
        : Math.round(speed * 3.6)
      : 0,
    atualizadoEm: position.at.toISOString(),
    proximaParagem: next?.nome ?? null,
    minutosAteProxima: next?.minutos ?? null,
  };
}

const SERVICE_S = (SERVICE_END_MIN - SERVICE_START_MIN) * 60;

/** Timetable state at a time of the service day (seconds since 05:00). */
function timetableAt(serviceS: number, g: Geometry, speedMps: number, phase: number) {
  const legS = g.length / speedMps;
  const cycleS = 2 * legS + 2 * TERMINAL_STOP_S;
  const t = (((serviceS + phase * cycleS) % cycleS) + cycleS) % cycleS;
  if (t < legS) return { progress: t * speedMps, moving: true };
  if (t < legS + TERMINAL_STOP_S) return { progress: g.length, moving: false };
  if (t < 2 * legS + TERMINAL_STOP_S) return { progress: g.length - (t - legS - TERMINAL_STOP_S) * speedMps, moving: true };
  return { progress: 0, moving: false };
}

/**
 * A vehicle's service day by its timetable: kilometres and trips so far and planned, per hour,
 * and the next times it passes each stop in each direction. Real GPS history is not stored,
 * so these are the timetable figures.
 */
export async function operationSummary(
  vehicle: { id: string },
  via: { geoLocationPath: string | null; terminalPartida: string; terminalChegada: string; paragens: { paragem: { nome: string; geoLocation: string | null } }[] } | null,
  now = new Date(),
) {
  const g = routeGeometry(via?.geoLocationPath);
  if (!via || g.path.length < 2 || g.length < 1) return null;
  const speed = await travelSpeedMps();
  const phase = unitHash(vehicle.id);
  const legS = g.length / speed;
  const cycleS = 2 * legS + 2 * TERMINAL_STOP_S;

  const dayMs = 86400000;
  const msOfDay = (((now.getTime() + MAPUTO_UTC_OFFSET_MIN * 60000) % dayMs) + dayMs) % dayMs;
  const serviceStart = now.getTime() - msOfDay + SERVICE_START_MIN * 60000; // today 05:00 Maputo
  const nowS = Math.min(Math.max((now.getTime() - serviceStart) / 1000, 0), SERVICE_S);

  // Walk the service day in 30 s steps
  const STEP = 30;
  const porHora = Array.from({ length: SERVICE_S / 3600 }, (_, h) => ({
    hora: `${String(SERVICE_START_MIN / 60 + h).padStart(2, "0")}h`,
    km: 0,
    viagens: 0,
  }));
  let kmHoje = 0;
  let kmDia = 0;
  let viagensHoje = 0;
  let prev = timetableAt(0, g, speed, phase);
  for (let s = STEP; s <= SERVICE_S; s += STEP) {
    const cur = timetableAt(s, g, speed, phase);
    const km = Math.abs(cur.progress - prev.progress) / 1000;
    const arrived = prev.moving && !cur.moving ? 1 : 0; // reached a terminal
    const bucket = porHora[Math.min(porHora.length - 1, Math.floor((s - STEP) / 3600))];
    bucket.km += km;
    bucket.viagens += arrived;
    kmDia += km;
    if (s <= nowS) {
      kmHoje += km;
      viagensHoje += arrived;
    }
    prev = cur;
  }
  let acumulado = 0;
  const porHoraOut = porHora.map((h) => {
    acumulado += h.km;
    return { hora: h.hora, km: Math.round(h.km), kmAcumulado: Math.round(acumulado), viagens: h.viagens };
  });

  // Next pass at each stop: going towards the last point of the path (ida) and back (volta)
  const nextPass = (cycleT: number) => {
    const from = Math.max((now.getTime() - serviceStart) / 1000, 0);
    const base = cycleT - phase * cycleS; // service seconds of the passes: base + k * cycle
    const today = base + Math.ceil((from - base) / cycleS) * cycleS;
    if (today < SERVICE_S) return new Date(serviceStart + today * 1000).toISOString();
    const tomorrow = base + Math.ceil(-base / cycleS) * cycleS; // first pass after 05:00 tomorrow
    return new Date(serviceStart + dayMs + tomorrow * 1000).toISOString();
  };
  const passagens = via.paragens
    .map((vp) => ({ nome: vp.paragem.nome, at: parseLatLng(vp.paragem.geoLocation) }))
    .filter((s): s is { nome: string; at: LatLng } => s.at !== null)
    .map((s) => ({ nome: s.nome, progress: g.cumulative[nearestIndex(g, s.at)] }))
    .sort((a, b) => a.progress - b.progress)
    .map((s) => ({
      nome: s.nome,
      km: Math.round(s.progress / 100) / 10,
      ida: nextPass(s.progress / speed),
      volta: nextPass(legS + TERMINAL_STOP_S + (g.length - s.progress) / speed),
    }));

  return {
    comprimentoKm: Math.round(g.length / 100) / 10,
    minutosPorSentido: Math.round(legS / 60),
    paragens: passagens.length,
    horasHoje: Math.round((nowS / 3600) * 10) / 10,
    kmHoje: Math.round(kmHoje),
    kmPlaneado: Math.round(kmDia),
    viagensHoje,
    viagensPlaneadas: porHora.reduce((sum, h) => sum + h.viagens, 0),
    porHora: porHoraOut,
    passagens,
    // Direction names: the path goes from its first point to its last
    ida: via.terminalChegada,
    volta: via.terminalPartida,
  };
}
