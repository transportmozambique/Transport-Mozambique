import { prisma } from './prisma';
import { getFareRule, type FareRule, type LatLng } from './fares';
import {
  POSITION_FIELDS,
  currentSpeedKmh,
  estimateBusTrip,
  minutesUntilPass,
  statusLabel,
  vehiclePosition,
  type Direction,
  type VehiclePosition,
} from './vehiclePosition';
import { firstBus, loadNetwork, pathBetween, ref, towards, vehiclesOn, type NetRoute, type Network, type StopRef, type Vehicle } from './journeys';
import { distanceMeters, walkMinutes } from './places';

/**
 * Acompanhar a viagem que o passageiro escolheu: os mesmos autocarros, etapa a etapa, com as
 * horas recalculadas pelas posições de agora (GPS quando recente, senão a viagem do motorista). A página diz
 * em que etapa o passageiro está (`active`) e se já está no autocarro dessa etapa (`onBoard`); as
 * caminhadas anteriores medem-se a partir de onde ele está agora.
 */

/** Um autocarro da viagem: o veículo, onde o passageiro entra e onde sai. */
export interface LegSpec {
  busId: string;
  from: string;
  to: string;
}

/** Feito, o passo em que o passageiro está agora, ou ainda por vir */
export type StepState = 'feito' | 'agora' | 'depois';

export interface LiveBus {
  lat: number;
  lng: number;
  heading: number | null;
  fonte: 'gps' | 'horario';
  /**
   * Onde está o autocarro nesta etapa: antes da paragem de embarque (ainda a caminho), entre as
   * duas paragens no sentido do passageiro, ou depois da paragem de saída
   */
  trecho: 'antes' | 'entre' | 'depois';
  /** Minutos e metros até chegar à paragem de embarque (null quando o passageiro já vai a bordo) */
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
  /** Quando o passageiro entra (null quando já está a bordo ou a etapa acabou) */
  embarque: string | null;
  /** Quando o passageiro sai (null quando a etapa acabou) */
  chegada: string | null;
  /** O autocarro passa na paragem de embarque antes de o passageiro lá chegar: apanha-o na passagem seguinte */
  perde: boolean;
  viagemMin: number;
  metros: number;
  /** Paragens depois da de embarque, até à de saída */
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

/** Um autocarro seguido sozinho (a partir do mapa), com as próximas paragens a que chega */
export interface FollowedBus {
  transporte: { id: string; matricula: string };
  via: { id: string; codigo: string; nome: string; cor: string };
  sentido: string;
  /** "Em circulação", "No terminal", ou "Fora de serviço" quando o motorista não iniciou a viagem */
  estado: ReturnType<typeof statusLabel>;
  velocidade: number;
  autocarro: Omit<LiveBus, 'trecho' | 'minutosAteEmbarque' | 'metrosAteEmbarque'>;
  percurso: [number, number][];
  /** As paragens à frente no sentido em que vai, com os minutos até passar em cada uma */
  proximas: { paragem: StopRef; minutos: number }[];
  /** A paragem do passageiro, quando foi indicada: a próxima passagem do autocarro por lá, num sentido ou noutro */
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

/**
 * Onde está um autocarro numa etapa de `a` a `b` metros ao longo do percurso, no sentido `travel`:
 * antes da paragem de embarque (ainda a caminho), entre as duas paragens, ou depois da de saída.
 * `riding`: o passageiro vai nele (um autocarro no outro sentido já passou a saída e deu a volta).
 */
export function trechoOf(position: VehiclePosition | null, a: number, b: number, travel: Direction, riding: boolean): LiveBus['trecho'] {
  const p = position?.progress ?? null;
  if (p === null || position?.direction == null) return riding ? 'entre' : 'antes';
  if (position.direction !== travel) return riding ? 'depois' : 'antes';
  const along = travel === 1 ? p : -p;
  const [from, to] = travel === 1 ? [a, b] : [-a, -b];
  return along < from ? 'antes' : along <= to ? 'entre' : 'depois';
}

/**
 * O autocarro em que vai o passageiro de uma etapa: o indicado, enquanto está em viagem entre as
 * duas paragens; senão o autocarro em viagem que passou a paragem de embarque há menos tempo (o
 * que ele apanhou, quando o indicado deixou de andar).
 */
export function ridingBus(route: NetRoute, vehicles: Vehicle[], preferred: string | null, a: number, b: number, travel: Direction, rule: FareRule, now: Date) {
  let best: { vehicle: Vehicle; position: VehiclePosition; behind: number } | null = null;
  for (const vehicle of vehicles) {
    const position = vehiclePosition(vehicle, route.g, now, rule);
    if (!position?.inService || trechoOf(position, a, b, travel, false) !== 'entre') continue;
    if (vehicle.id === preferred) return { vehicle, position };
    const behind = Math.abs(position.progress! - a);
    if (!best || behind < best.behind) best = { vehicle, position, behind };
  }
  return best;
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

/** A viagem `legs`, com as horas de agora. `position` é a do passageiro, quando o navegador a dá. */
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
  // Os outros autocarros das mesmas rotas: quando o indicado está parado, ou outro vem primeiro
  const onRoutes = await vehiclesOn([...vehicles.values()].flatMap((v) => (v.viaId ? [v.viaId] : [])));

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
    const asked = vehicles.get(leg.busId);
    const route = routeOf(net, asked);
    const a = route.at.get(leg.from);
    const b = route.at.get(leg.to);
    if (a === undefined || b === undefined || leg.from === leg.to) throw new FollowError('Paragem fora da rota deste autocarro');
    const de = stopRef(net, leg.from);
    const para = stopRef(net, leg.to);
    const estado: StepState = i < active ? 'feito' : i === active ? 'agora' : 'depois';

    // A caminhada até este autocarro: a partir de onde o passageiro está agora, enquanto for o passo seguinte
    const previous = i === 0 ? (startId && net.stops.has(startId) ? stopRef(net, startId) : null) : stopRef(net, legs[i - 1].to);
    if (i === active && !onBoard && position) walk('agora', here(position), de);
    else if (previous) walk(i < active || (i === active && onBoard) ? 'feito' : i === active ? 'agora' : 'depois', previous, de);
    else if (i === 0 && position && i < active) walk('feito', here(position), de);

    const path = route.g.path;
    const stops = route.routeStops;
    const travel: Direction = b > a ? 1 : -1;
    // O autocarro desta etapa: a bordo, o do passageiro; à espera, o primeiro em viagem que chega à
    // paragem (o próximo, quando o indicado parou ou outro vem antes); senão o indicado, parado
    const ridingNow = estado === 'agora' && onBoard;
    const sameRoute = onRoutes.get(route.id) ?? [asked!];
    const vehicle =
      (ridingNow
        ? ridingBus(route, sameRoute, leg.busId, a, b, travel, rule, now)?.vehicle
        : estado !== 'feito'
          ? firstBus(route, sameRoute, leg.from, leg.to, rule, new Date(t))?.vehicle
          : undefined) ?? asked;
    const busNow = vehiclePosition(vehicle!, route.g, now, rule);
    const fromNow = estimateBusTrip({ vehicle: vehicle!, path, stops, origemId: leg.from, destinoId: leg.to, rule, now });
    // No sentido contrário, um autocarro em que o passageiro vai já passou a paragem de saída e deu a
    // volta no terminal; um que ele espera ainda tem de dar a volta e vir
    const trecho = trechoOf(busNow, a, b, travel, ridingNow);

    let embarque: number | null = null;
    let chegada: number | null = null;
    let perde = false;
    if (estado === 'agora' && onBoard) {
      chegada = busNow?.inService ? now.getTime() + minutesUntilPass(busNow, route.g.length, b, travel, rule) * 60000 : null;
    } else if (estado !== 'feito') {
      const ready = new Date(t);
      const trip = estimateBusTrip({ vehicle: vehicle!, path, stops, origemId: leg.from, destinoId: leg.to, rule, now: ready });
      if (trip) {
        embarque = t + trip.tempoChegada * 60000;
        chegada = embarque + trip.tempoViagem * 60000;
        // Chega antes de o passageiro poder estar na paragem: a hora mostrada é a passagem seguinte
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

  // A caminhada do último autocarro até ao destino (ou directamente, quando todos os autocarros acabaram)
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

/** Um autocarro sozinho: onde está, as paragens à frente e a próxima passagem em `stopId`, se indicado. */
export async function followBus(busId: string, stopId: string | null, now = new Date()): Promise<FollowedBus> {
  const [net, rule, vehicles] = await Promise.all([loadNetwork(), getFareRule(), vehiclesById([busId])]);
  const vehicle = vehicles.get(busId);
  const route = routeOf(net, vehicle);
  const position = vehiclePosition(vehicle!, route.g, now, rule);
  const first = net.stops.get(route.stops[0].id)!;
  const dir: Direction = position?.direction ?? 1;
  const p = position?.progress ?? null;

  const proximas =
    position?.inService && p !== null
      ? route.stops
          .filter((s) => (dir === 1 ? s.at > p : s.at < p))
          .sort((x, y) => (dir === 1 ? x.at - y.at : y.at - x.at))
          .slice(0, 12)
          .map((s) => ({ paragem: stopRef(net, s.id), minutos: minutesUntilPass(position, route.g.length, s.at, dir, rule) }))
      : [];

  let paragem: FollowedBus['paragem'] = null;
  const at = stopId ? route.at.get(stopId) : undefined;
  if (stopId && at !== undefined && position?.inService && p !== null) {
    const ways = ([1, -1] as Direction[]).map((d) => ({ d, minutos: minutesUntilPass(position, route.g.length, at, d, rule) }));
    const soonest = ways.sort((x, y) => x.minutos - y.minutos)[0];
    paragem = { paragem: stopRef(net, stopId), minutos: soonest.minutos, sentido: towards(net, route, soonest.d) };
  }

  return {
    transporte: { id: vehicle!.id, matricula: vehicle!.matricula },
    via: { id: route.id, codigo: route.codigo, nome: route.nome, cor: route.cor },
    sentido: towards(net, route, dir),
    estado: statusLabel(position),
    velocidade: currentSpeedKmh(vehicle!, position, rule),
    autocarro: live(position, first.point),
    percurso: pathBetween(route, 0, route.g.length),
    proximas,
    paragem,
    atualizadoEm: now.toISOString(),
  };
}
