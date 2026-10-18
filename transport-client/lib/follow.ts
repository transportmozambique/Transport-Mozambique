import { prisma } from './prisma';
import { getFareRule, type LatLng } from './fares';
import {
  POSITION_FIELDS,
  estimateBusTrip,
  minutesUntilPass,
  vehiclePosition,
  type Direction,
  type VehiclePosition,
} from './vehiclePosition';
import { loadNetwork, pathBetween, ref, towards, type NetRoute, type Network, type StopRef, type Vehicle } from './journeys';
import { distanceMeters, walkMinutes } from './places';

/**
 * Following a journey the passenger chose: the same buses, leg after leg, timed again with the
 * buses' positions now (GPS when fresh, else the timetable). The page says which leg the
 * passenger is on (`active`) and whether they are on that leg's bus (`onBoard`); the walks
 * before it are measured from where they are now.
 */

/** One bus of the journey: the vehicle, where the passenger gets on and where they get off. */
export interface LegSpec {
  busId: string;
  from: string;
  to: string;
}

/** Done, the step the passenger is on now, or still to come */
export type StepState = 'feito' | 'agora' | 'depois';

export interface LiveBus {
  lat: number;
  lng: number;
  heading: number | null;
  fonte: 'gps' | 'horario';
  /**
   * Where the bus is on this leg: before the boarding stop (still coming), between the two
   * stops going the passenger's way, or past the alighting stop
   */
  trecho: 'antes' | 'entre' | 'depois';
  /** Minutes and metres until it reaches the boarding stop (null once the passenger is on board) */
  minutosAteEmbarque: number | null;
  metrosAteEmbarque: number | null;
}

export interface FollowWalk {
  tipo: 'pe';
  estado: StepState;
  de: StopRef;
  para: StopRef;
  metros: number;
  minutos: number;
}

export interface FollowBus {
  tipo: 'autocarro';
  estado: StepState;
  via: { id: string; codigo: string; nome: string; cor: string };
  transporte: { id: string; matricula: string };
  sentido: string;
  de: StopRef;
  para: StopRef;
  /** When the passenger gets on (null once on board or done) */
  embarque: string | null;
  /** When the passenger gets off (null when done) */
  chegada: string | null;
  /** The bus passes the boarding stop before the passenger can be there: they will catch it on its next pass */
  perde: boolean;
  viagemMin: number;
  metros: number;
  /** Stops after the boarding one, up to the alighting one */
  paragens: StopRef[];
  tarifa: number;
  percurso: [number, number][];
  autocarro: LiveBus;
}

export interface FollowedJourney {
  etapas: (FollowWalk | FollowBus)[];
  chegada: string;
  duracaoMin: number;
  tarifa: number;
  atualizadoEm: string;
}

/** A bus followed on its own (from the map), with the next stops it reaches */
export interface FollowedBus {
  transporte: { id: string; matricula: string };
  via: { id: string; codigo: string; nome: string; cor: string };
  sentido: string;
  autocarro: Omit<LiveBus, 'trecho' | 'minutosAteEmbarque' | 'metrosAteEmbarque'>;
  percurso: [number, number][];
  /** The stops ahead in the direction it is going, with the minutes until it passes each */
  proximas: { paragem: StopRef; minutos: number }[];
  /** The passenger's stop when one was given: the bus's next pass there, either way */
  paragem: { paragem: StopRef; minutos: number; sentido: string } | null;
  atualizadoEm: string;
}

export class FollowError extends Error {}

async function vehiclesById(ids: string[]): Promise<Map<string, Vehicle>> {
  const rows = await prisma.transporte.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { ...POSITION_FIELDS, matricula: true, viaId: true },
  });
  return new Map(rows.map((v) => [v.id, v]));
}

function routeOf(net: Network, vehicle: Vehicle | undefined): NetRoute {
  const route = vehicle?.viaId ? net.routes.get(vehicle.viaId) : undefined;
  if (!vehicle || !route) throw new FollowError('Autocarro não encontrado');
  return route;
}

const stopRef = (net: Network, id: string): StopRef => {
  const s = net.stops.get(id);
  if (!s) throw new FollowError('Paragem não encontrada');
  return ref(s);
};

const here = (p: LatLng): StopRef => ({ id: '', nome: 'A sua localização', lat: p[0], lng: p[1] });

function live(position: VehiclePosition | null, fallback: LatLng) {
  return {
    lat: position?.point[0] ?? fallback[0],
    lng: position?.point[1] ?? fallback[1],
    heading: position?.heading ?? null,
    fonte: position?.source ?? ('horario' as const),
  };
}

/** The journey `legs`, timed now. `position` is the passenger's, when the browser gives it. */
export async function followJourney(args: {
  legs: LegSpec[];
  position: LatLng | null;
  startId: string | null;
  endId: string | null;
  active: number;
  onBoard: boolean;
  now?: Date;
}): Promise<FollowedJourney> {
  const { legs, position, startId, endId } = args;
  const now = args.now ?? new Date();
  const active = Math.max(0, Math.min(args.active, legs.length));
  const onBoard = args.onBoard && active < legs.length;
  const [net, rule, vehicles] = await Promise.all([loadNetwork(), getFareRule(), vehiclesById(legs.map((l) => l.busId))]);

  const etapas: (FollowWalk | FollowBus)[] = [];
  let t = now.getTime();
  let tarifa = 0;

  const walk = (estado: StepState, de: StopRef, para: StopRef) => {
    const metros = Math.round(distanceMeters([de.lat, de.lng], [para.lat, para.lng]));
    if (metros < 15) return;
    const minutos = walkMinutes(metros);
    etapas.push({ tipo: 'pe', estado, de, para, metros, minutos });
    if (estado !== 'feito') t += minutos * 60000;
  };

  legs.forEach((leg, i) => {
    const vehicle = vehicles.get(leg.busId);
    const route = routeOf(net, vehicle);
    const a = route.at.get(leg.from);
    const b = route.at.get(leg.to);
    if (a === undefined || b === undefined || leg.from === leg.to) throw new FollowError('Paragem fora da rota deste autocarro');
    const de = stopRef(net, leg.from);
    const para = stopRef(net, leg.to);
    const estado: StepState = i < active ? 'feito' : i === active ? 'agora' : 'depois';

    // The walk to this bus: from where the passenger is now while it is the next thing to do
    const previous = i === 0 ? (startId && net.stops.has(startId) ? stopRef(net, startId) : null) : stopRef(net, legs[i - 1].to);
    if (i === active && !onBoard && position) walk('agora', here(position), de);
    else if (previous) walk(i < active || (i === active && onBoard) ? 'feito' : i === active ? 'agora' : 'depois', previous, de);
    else if (i === 0 && position && i < active) walk('feito', here(position), de);

    const path = route.g.path;
    const stops = route.routeStops;
    const travel: Direction = b > a ? 1 : -1;
    const busNow = vehiclePosition(vehicle!, route.g, now, rule);
    const fromNow = estimateBusTrip({ vehicle: vehicle!, path, stops, origemId: leg.from, destinoId: leg.to, rule, now });
    const p = busNow?.progress ?? null;
    // Going the other way, a bus the passenger is on has passed the alighting stop and turned
    // at the terminal; one they wait for still has to turn and come
    const ridingNow = estado === 'agora' && onBoard;
    const along = p === null ? null : travel === 1 ? p : -p;
    const [from, to] = travel === 1 ? [a, b] : [-a, -b];
    const trecho: LiveBus['trecho'] =
      along === null || busNow?.direction == null
        ? ridingNow ? 'entre' : 'antes'
        : busNow.direction !== travel
          ? ridingNow ? 'depois' : 'antes'
          : along < from ? 'antes' : along <= to ? 'entre' : 'depois';

    let embarque: number | null = null;
    let chegada: number | null = null;
    let perde = false;
    if (estado === 'agora' && onBoard) {
      chegada = busNow ? now.getTime() + minutesUntilPass(busNow, route.g.length, b, travel, rule) * 60000 : null;
    } else if (estado !== 'feito') {
      const ready = new Date(t);
      const trip = estimateBusTrip({ vehicle: vehicle!, path, stops, origemId: leg.from, destinoId: leg.to, rule, now: ready });
      if (trip) {
        embarque = t + trip.tempoChegada * 60000;
        chegada = embarque + trip.tempoViagem * 60000;
        // Comes sooner than the passenger can be at the stop: the time shown is its next pass
        perde = estado === 'agora' && fromNow !== null && now.getTime() + fromNow.tempoChegada * 60000 < t;
      }
    }
    if (chegada !== null) t = chegada;
    tarifa += fromNow?.fare ?? 0;

    etapas.push({
      tipo: 'autocarro',
      estado,
      via: { id: route.id, codigo: route.codigo, nome: route.nome, cor: route.cor },
      transporte: { id: vehicle!.id, matricula: vehicle!.matricula },
      sentido: towards(net, route, travel),
      de,
      para,
      embarque: embarque === null ? null : new Date(embarque).toISOString(),
      chegada: chegada === null ? null : new Date(chegada).toISOString(),
      perde,
      viagemMin: fromNow?.tempoViagem ?? 0,
      metros: Math.round(fromNow?.distanciaViagem ?? Math.abs(b - a)),
      paragens: route.stops
        .filter((s) => (travel === 1 ? s.at > a && s.at <= b : s.at < a && s.at >= b))
        .sort((x, y) => (travel === 1 ? x.at - y.at : y.at - x.at))
        .map((s) => stopRef(net, s.id)),
      tarifa: fromNow?.fare ?? 0,
      percurso: pathBetween(route, a, b),
      autocarro: {
        ...live(busNow, net.stops.get(leg.from)!.point),
        trecho,
        minutosAteEmbarque: estado === 'feito' || (estado === 'agora' && onBoard) ? null : (fromNow?.tempoChegada ?? null),
        metrosAteEmbarque: estado === 'feito' || (estado === 'agora' && onBoard) ? null : Math.round(fromNow?.distanciaAteOrigem ?? 0),
      },
    });
  });

  // The walk from the last bus to the destination (or straight there, when every bus is done)
  if (endId && net.stops.has(endId) && legs.length) {
    const last = stopRef(net, legs[legs.length - 1].to);
    const end = stopRef(net, endId);
    if (active >= legs.length && position) walk('agora', here(position), end);
    else walk(active >= legs.length ? 'agora' : 'depois', last, end);
  }

  return {
    etapas,
    chegada: new Date(t).toISOString(),
    duracaoMin: Math.max(0, Math.round((t - now.getTime()) / 60000)),
    tarifa,
    atualizadoEm: now.toISOString(),
  };
}

/** One bus on its own: where it is, the stops ahead, and its next pass at `stopId` if given. */
export async function followBus(busId: string, stopId: string | null, now = new Date()): Promise<FollowedBus> {
  const [net, rule, vehicles] = await Promise.all([loadNetwork(), getFareRule(), vehiclesById([busId])]);
  const vehicle = vehicles.get(busId);
  const route = routeOf(net, vehicle);
  const position = vehiclePosition(vehicle!, route.g, now, rule);
  const first = net.stops.get(route.stops[0].id)!;
  const dir: Direction = position?.direction ?? 1;
  const p = position?.progress ?? null;

  const proximas =
    position && p !== null
      ? route.stops
          .filter((s) => (dir === 1 ? s.at > p : s.at < p))
          .sort((x, y) => (dir === 1 ? x.at - y.at : y.at - x.at))
          .slice(0, 12)
          .map((s) => ({ paragem: stopRef(net, s.id), minutos: minutesUntilPass(position, route.g.length, s.at, dir, rule) }))
      : [];

  let paragem: FollowedBus['paragem'] = null;
  const at = stopId ? route.at.get(stopId) : undefined;
  if (stopId && at !== undefined && position && p !== null) {
    const ways = ([1, -1] as Direction[]).map((d) => ({ d, minutos: minutesUntilPass(position, route.g.length, at, d, rule) }));
    const soonest = ways.sort((x, y) => x.minutos - y.minutos)[0];
    paragem = { paragem: stopRef(net, stopId), minutos: soonest.minutos, sentido: towards(net, route, soonest.d) };
  }

  return {
    transporte: { id: vehicle!.id, matricula: vehicle!.matricula },
    via: { id: route.id, codigo: route.codigo, nome: route.nome, cor: route.cor },
    sentido: towards(net, route, dir),
    autocarro: live(position, first.point),
    percurso: pathBetween(route, 0, route.g.length),
    proximas,
    paragem,
    atualizadoEm: now.toISOString(),
  };
}
