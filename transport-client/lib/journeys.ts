import { prisma } from './prisma';
import { fareFor, getFareRule, parseLatLng, travelMinutes, type FareRule, type LatLng, type RouteStop } from './fares';
import {
  POSITION_FIELDS,
  estimateBusTrip,
  pointAlong,
  progressOf,
  routeGeometry,
  type Direction,
  type PositionedVehicle,
  type RouteGeometry,
} from './vehiclePosition';
import { distanceMeters, groupPlaces, normalizeName, placeName, walkMinutes, type Place } from './places';

/**
 * Planeamento de viagens na rede de autocarros: os destinos a que uma paragem chega directamente
 * ou com transbordos, e as viagens entre dois locais, usados pela aplicação web e pelo USSD.
 *
 * Os autocarros vão e voltam ao longo da sua via, por isso um autocarro chega a todas as paragens
 * da via a partir de qualquer outra. As opções são primeiro ordenadas com velocidades fixas e uma
 * espera fixa por autocarro (rápido, para muitas candidatas); depois as melhores são cronometradas
 * com as posições reais dos autocarros (estimateBusTrip): GPS quando recente, senão a posição pela
 * viagem que o motorista iniciou, no momento em que o passageiro chega a cada paragem. Só contam os
 * autocarros em viagem; um autocarro parado não aparece em nenhuma viagem.
 */

export interface NetStop {
  id: string;
  nome: string;
  codigo: string;
  point: LatLng;
  routeIds: string[];
}

export interface NetRoute {
  id: string;
  codigo: string;
  nome: string;
  cor: string;
  /** Terminais de início e de fim, como o nome da via os diz (Via.terminalPartida, terminalChegada) */
  terminals: [string, string];
  g: RouteGeometry;
  /** Paragens pela ordem do percurso, com a distância ao longo do percurso */
  stops: { id: string; at: number }[];
  at: Map<string, number>;
  routeStops: RouteStop[];
}

export interface Network {
  stops: Map<string, NetStop>;
  routes: Map<string, NetRoute>;
  /** Outras paragens a menos de WALK_TRANSFER_M de cada paragem, a mais próxima primeiro */
  near: Map<string, { id: string; m: number }[]>;
  places: Place<NetStop>[];
}

const NETWORK_CACHE_MS = 5 * 60 * 1000;
/** Caminhada mais longa entre duas paragens para mudar de autocarro */
const WALK_TRANSFER_M = 400;
/** Caminhada mais longa no fim, até uma paragem perto do destino; e no início, da paragem escolhida
 * até uma próxima, só quando nenhum autocarro da paragem escolhida chega lá */
const WALK_END_M = 300;
/** Andar menos do que isto num autocarro não compensa um transbordo */
const MIN_RIDE_M = 300;
/** Metros em linha recta por segundo a pé (4,5 km/h, com as ruas um quarto mais longas) */
const WALK_MPS = 1;
/** Espera assumida por autocarro ao ordenar as opções, antes de calcular as horas reais */
const BOARD_PENALTY_S = 10 * 60;
const MAX_TIMED = 8;

let cache: { at: number; network: Promise<Network> } | null = null;

/**
 * A rede das vias activas que têm autocarros, guardada em memória por instância do servidor
 * durante uns minutos (evita ler a base de dados a cada pedido). As rotas desactivadas no painel
 * (Via.ativa) ficam de fora de tudo o que os passageiros vêem: mapa, viagens, USSD e SMS.
 */
export function loadNetwork(): Promise<Network> {
  if (cache && Date.now() - cache.at < NETWORK_CACHE_MS) return cache.network;
  const network = buildNetwork().catch((error) => {
    cache = null;
    throw error;
  });
  cache = { at: Date.now(), network };
  return network;
}

async function buildNetwork(): Promise<Network> {
  const vias = await prisma.via.findMany({
    where: { ativa: true, transportes: { some: {} } },
    select: {
      id: true,
      codigo: true,
      nome: true,
      cor: true,
      terminalPartida: true,
      terminalChegada: true,
      geoLocationPath: true,
      paragens: { select: { paragem: { select: { id: true, nome: true, codigo: true, geoLocation: true } } } },
    },
  });

  const stops = new Map<string, NetStop>();
  const routes = new Map<string, NetRoute>();
  for (const via of vias) {
    const own = new Map<string, LatLng>();
    for (const { paragem } of via.paragens) {
      const point = parseLatLng(paragem.geoLocation);
      if (!point) continue;
      own.set(paragem.id, point);
      const stop = stops.get(paragem.id) ?? { id: paragem.id, nome: paragem.nome, codigo: paragem.codigo, point, routeIds: [] };
      stop.routeIds.push(via.id);
      stops.set(paragem.id, stop);
    }
    if (own.size < 2) continue;

    // Sem percurso desenhado, a linha pelas paragens faz as vezes dele
    let g = routeGeometry(via.geoLocationPath);
    if (g.path.length < 2) g = routeGeometry([...own.values()]);
    const ordered = [...own].map(([id, point]) => ({ id, at: progressOf(g, point) })).sort((a, b) => a.at - b.at);
    routes.set(via.id, {
      id: via.id,
      codigo: via.codigo,
      nome: via.nome,
      cor: via.cor,
      terminals: [via.terminalPartida, via.terminalChegada],
      g,
      stops: ordered,
      at: new Map(ordered.map((s) => [s.id, s.at])),
      routeStops: ordered.map((s) => ({ id: s.id, point: own.get(s.id)! })),
    });
  }

  return { stops, routes, near: nearbyPairs(stops), places: groupPlaces([...stops.values()]) };
}

/** Para cada paragem, as paragens a menos de WALK_TRANSFER_M (grelha de células de ~500 m, para não comparar todas com todas). */
function nearbyPairs(stops: Map<string, NetStop>) {
  const cell = (p: LatLng) => `${Math.floor(p[0] / 0.005)},${Math.floor(p[1] / 0.005)}`;
  const grid = new Map<string, NetStop[]>();
  for (const s of stops.values()) {
    const k = cell(s.point);
    const list = grid.get(k);
    if (list) list.push(s);
    else grid.set(k, [s]);
  }
  const near = new Map<string, { id: string; m: number }[]>();
  for (const s of stops.values()) {
    const [ci, cj] = cell(s.point).split(',').map(Number);
    const found: { id: string; m: number }[] = [];
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (const o of grid.get(`${ci + di},${cj + dj}`) ?? []) {
          if (o.id === s.id) continue;
          const m = distanceMeters(s.point, o.point);
          if (m <= WALK_TRANSFER_M) found.push({ id: o.id, m });
        }
      }
    }
    near.set(s.id, found.sort((a, b) => a.m - b.m));
  }
  return near;
}

/** "Avenida das Indústrias" → "Av. Indústrias": espaço para o que distingue locais com o mesmo nome. */
function shortPlaceName(nome: string): string {
  return nome
    .replace(/^Avenida\b/i, 'Av.')
    .replace(/^Estrada\b/i, 'Estr.')
    .replace(/\s+(da|das|de|do|dos)\s+/gi, ' ')
    .trim();
}

/** O local mais próximo com outro nome (as paragens de uma estrada longa ficam longe de todos), senão a primeira via. */
function landmarkOf(net: Network, place: Place<NetStop>): { nome: string; m: number | null } {
  const name = normalizeName(place.nome);
  let best: { nome: string; m: number } | null = null;
  for (const p of net.places) {
    if (normalizeName(p.nome) === name) continue;
    const m = distanceMeters(place.point, p.point);
    if (!best || m < best.m) best = { nome: p.nome, m };
  }
  return best ?? { nome: net.routes.get(place.stops[0].routeIds[0])?.nome ?? '', m: null };
}

/**
 * O nome do local e, quando outros locais têm o mesmo nome, o que os distingue: o local mais
 * próximo com outro nome ("Av. Indústrias - Machava-Sede"), com a distância até ele quando dois
 * têm o mesmo ("Av. Indústrias - Machava-Sede 960 m").
 */
export function placeLabel(net: Network, place: Place<NetStop>, max = Infinity): string {
  const name = normalizeName(place.nome);
  const twins = net.places.filter((p) => normalizeName(p.nome) === name);
  if (twins.length < 2) return place.nome;
  const own = landmarkOf(net, place);
  const shared = twins.some((t) => t !== place && landmarkOf(net, t).nome === own.nome);
  const distance = shared && own.m !== null ? ` ${Math.round(own.m / 10) * 10} m` : '';
  if (place.nome.length + own.nome.length + distance.length + 3 <= max) return `${place.nome} - ${own.nome}${distance}`;
  // Com pouco espaço (USSD), encurta-se primeiro o nome: a pessoa escreveu-o, o resto é novo.
  // O nome fica com pelo menos 10 caracteres; uma referência demasiado longa também é cortada
  const cut = (text: string, n: number) => (text.length > n ? `${text.slice(0, Math.max(1, n - 2)).trimEnd()}..` : text);
  let head = shortPlaceName(place.nome);
  head = cut(head, Math.max(Math.min(head.length, 10), max - own.nome.length - distance.length - 3));
  return `${head} - ${cut(own.nome, max - head.length - distance.length - 3)}${distance}`;
}

export type Vehicle = PositionedVehicle & { matricula: string; viaId: string | null };

export async function vehiclesOn(routeIds: Iterable<string>): Promise<Map<string, Vehicle[]>> {
  const rows = await prisma.transporte.findMany({
    where: { viaId: { in: [...new Set(routeIds)] } },
    select: { ...POSITION_FIELDS, matricula: true, viaId: true },
  });
  const byRoute = new Map<string, Vehicle[]>();
  for (const v of rows) {
    const list = byRoute.get(v.viaId!);
    if (list) list.push(v);
    else byRoute.set(v.viaId!, [v]);
  }
  return byRoute;
}

/**
 * O primeiro autocarro de `route` que leva um passageiro que está em `fromId` às `ready` até `toId`.
 * Só os autocarros em viagem contam (estimateBusTrip não dá hora aos que estão parados).
 */
export function firstBus(route: NetRoute, vehicles: Vehicle[], fromId: string, toId: string, rule: FareRule, ready: Date) {
  let best: { vehicle: Vehicle; trip: NonNullable<ReturnType<typeof estimateBusTrip>> } | null = null;
  for (const vehicle of vehicles) {
    const trip = estimateBusTrip({ vehicle, path: route.g.path, stops: route.routeStops, origemId: fromId, destinoId: toId, rule, now: ready });
    if (trip && (!best || trip.tempoChegada < best.trip.tempoChegada)) best = { vehicle, trip };
  }
  return best;
}

/** Fim da via no sentido `dir`, que dá o nome ao sentido ("sentido Baixa"). */
export function towards(net: Network, route: NetRoute, dir: Direction): string {
  const end = dir === 1 ? route.stops[route.stops.length - 1] : route.stops[0];
  return placeName(net.stops.get(end.id)?.nome ?? '');
}

// ─── Destinos de uma paragem ──────────────────────────────────────────────────

export interface StopRef {
  id: string;
  nome: string;
  lat: number;
  lng: number;
}

export const ref = (s: NetStop): StopRef => ({ id: s.id, nome: s.nome, lat: s.point[0], lng: s.point[1] });

export interface StopDestinations {
  paragem: StopRef & { codigo: string };
  rotas: {
    via: { id: string; codigo: string; nome: string; cor: string };
    sentidos: {
      para: string;
      proximo: { minutos: number; matricula: string; transporteId: string } | null;
      paragens: StopRef[];
    }[];
  }[];
}

/** Todas as paragens a que se chega a partir de `stopId` sem mudar de autocarro, por via e sentido, com o próximo autocarro. */
export async function stopDestinations(stopId: string, now = new Date()): Promise<StopDestinations | null> {
  const net = await loadNetwork();
  const stop = net.stops.get(stopId);
  if (!stop) return null;
  const [rule, vehicles] = await Promise.all([getFareRule(), vehiclesOn(stop.routeIds)]);

  const rotas = stop.routeIds.flatMap((routeId) => {
    const route = net.routes.get(routeId);
    if (!route) return [];
    const i = route.stops.findIndex((s) => s.id === stopId);
    const ways: [Direction, { id: string }[]][] = [
      [1, route.stops.slice(i + 1)],
      [-1, route.stops.slice(0, i).reverse()],
    ];
    const sentidos = ways
      .filter(([, list]) => list.length > 0)
      .map(([dir, list]) => {
        const bus = firstBus(route, vehicles.get(routeId) ?? [], stopId, list[list.length - 1].id, rule, now);
        return {
          para: towards(net, route, dir),
          proximo: bus ? { minutos: bus.trip.tempoChegada, matricula: bus.vehicle.matricula, transporteId: bus.vehicle.id } : null,
          paragens: list.map((s) => ref(net.stops.get(s.id)!)),
        };
      });
    return [{ via: { id: route.id, codigo: route.codigo, nome: route.nome, cor: route.cor }, sentidos }];
  });

  return { paragem: { ...ref(stop), codigo: stop.codigo }, rotas };
}

// ─── Journeys ────────────────────────────────────────────────────────────────

export interface WalkLeg {
  tipo: 'pe';
  de: StopRef;
  para: StopRef;
  metros: number;
  minutos: number;
}

export interface BusLeg {
  tipo: 'autocarro';
  via: { id: string; codigo: string; nome: string; cor: string };
  transporte: { id: string; matricula: string };
  sentido: string;
  de: StopRef;
  para: StopRef;
  /** Minutos desde que o passageiro está na paragem até o autocarro chegar */
  esperaMin: number;
  embarque: string;
  chegada: string;
  viagemMin: number;
  metros: number;
  paragens: number;
  tarifa: number;
  /** Pontos [lng, lat] ao longo da estrada, para desenhar */
  percurso: [number, number][];
}

export interface Journey {
  transbordos: number;
  partida: string;
  chegada: string;
  duracaoMin: number;
  tarifa: number;
  metrosAPe: number;
  etapas: (WalkLeg | BusLeg)[];
}

interface Segment {
  route: NetRoute;
  from: string;
  to: string;
}

interface Plan {
  origin: string;
  dest: string;
  segs: Segment[];
  cost: number;
}

/** Ponto de partida das viagens que começam onde o passageiro está, e não numa paragem. */
const ME = '@me';
/** A partir da posição do passageiro: paragens dentro desta caminhada, as MAX_START_STOPS mais próximas */
const WALK_FROM_POSITION_M = 800;
const MAX_START_STOPS = 8;

type Catchment = Map<string, { anchor: string; m: number }>;

/** Cada paragem a menos de `radius` de uma das `ids` (incluídas), com a mais próxima das `ids` e a distância. */
function catchment(net: Network, ids: string[], radius: number): Catchment {
  const out: Catchment = new Map();
  const put = (id: string, anchor: string, m: number) => {
    const old = out.get(id);
    if (!old || m < old.m) out.set(id, { anchor, m });
  };
  for (const id of ids) {
    if (!net.stops.has(id)) continue;
    put(id, id, 0);
    for (const n of net.near.get(id) ?? []) if (n.m <= radius) put(n.id, id, n.m);
  }
  return out;
}

/** As paragens a que um passageiro em `point` pode ir a pé. */
function catchmentOfPoint(net: Network, point: LatLng): Catchment {
  const near = [...net.stops.values()]
    .map((s) => ({ id: s.id, m: distanceMeters(point, s.point) }))
    .filter((s) => s.m <= WALK_FROM_POSITION_M)
    .sort((a, b) => a.m - b.m)
    .slice(0, MAX_START_STOPS);
  return new Map(near.map((s) => [s.id, { anchor: ME, m: s.m }]));
}

function candidatePlans(net: Network, origins: Catchment, dests: Catchment, rule: FareRule): Plan[] {
  const v = (rule.velocidadeViagemKmh * 1000) / 3600;
  const rideM = (r: NetRoute, a: string, b: string) => Math.abs(r.at.get(a)! - r.at.get(b)!);
  const routesAt = (ids: Iterable<string>) => new Set([...ids].flatMap((id) => net.stops.get(id)?.routeIds ?? []));

  // Forma mais barata de chegar a cada paragem de uma via entrando numa origem, e de cada paragem a um destino
  const fromOrigins = (r: NetRoute) => {
    const best = new Map<string, { cost: number; o: string }>();
    for (const [o, w] of origins) {
      if (!r.at.has(o)) continue;
      for (const s of r.stops) {
        const m = rideM(r, o, s.id);
        if (m < MIN_RIDE_M) continue;
        const cost = w.m / WALK_MPS + m / v;
        const old = best.get(s.id);
        if (!old || cost < old.cost) best.set(s.id, { cost, o });
      }
    }
    return best;
  };
  const toDests = (r: NetRoute) => {
    const best = new Map<string, { cost: number; d: string }>();
    for (const [d, w] of dests) {
      if (!r.at.has(d)) continue;
      for (const s of r.stops) {
        const m = rideM(r, s.id, d);
        if (m < MIN_RIDE_M) continue;
        const cost = m / v + w.m / WALK_MPS;
        const old = best.get(s.id);
        if (!old || cost < old.cost) best.set(s.id, { cost, d });
      }
    }
    return best;
  };
  const walkTo = (id: string) => [{ id, m: 0 }, ...(net.near.get(id) ?? [])];

  const firstRoutes = [...routesAt(origins.keys())].map((id) => net.routes.get(id)!).filter(Boolean);
  const lastRoutes = [...routesAt(dests.keys())].map((id) => net.routes.get(id)!).filter(Boolean);
  const out = new Map<string, Plan>(); // o melhor plano por sequência de vias
  const keep = (plan: Plan) => {
    const key = plan.segs.map((s) => s.route.id).join('>');
    const old = out.get(key);
    if (!old || plan.cost < old.cost) out.set(key, plan);
  };

  // Sem transbordo: origem e destino na mesma via (aqui uma viagem curta serve)
  for (const r of firstRoutes) {
    for (const [o, wo] of origins) {
      if (!r.at.has(o)) continue;
      for (const [d, wd] of dests) {
        if (!r.at.has(d) || d === o) continue;
        const cost = wo.m / WALK_MPS + BOARD_PENALTY_S + rideM(r, o, d) / v + wd.m / WALK_MPS;
        keep({ origin: wo.anchor, dest: wd.anchor, segs: [{ route: r, from: o, to: d }], cost });
      }
    }
  }

  const first = new Map(firstRoutes.map((r) => [r.id, fromOrigins(r)]));
  const last = new Map(lastRoutes.map((r) => [r.id, toDests(r)]));

  // Um transbordo
  for (const r1 of firstRoutes) {
    const a = first.get(r1.id)!;
    for (const r2 of lastRoutes) {
      if (r1.id === r2.id) continue;
      const b = last.get(r2.id)!;
      for (const [x, ax] of a) {
        for (const { id: y, m } of walkTo(x)) {
          const by = b.get(y);
          if (!by) continue;
          const cost = 2 * BOARD_PENALTY_S + ax.cost + m / WALK_MPS + by.cost;
          keep({
            origin: origins.get(ax.o)!.anchor,
            dest: dests.get(by.d)!.anchor,
            segs: [{ route: r1, from: ax.o, to: x }, { route: r2, from: y, to: by.d }],
            cost,
          });
        }
      }
    }
  }

  // Mais transbordos, só quando um não chega
  if (out.size === 0) for (const plan of fewestBuses(net, origins, dests, v)) keep(plan);

  const plans = [...out.values()].sort((p, q) => p.cost - q.cost);
  // Um transbordo só é oferecido quando é claramente melhor do que o melhor autocarro directo
  const direct = plans.find((p) => p.segs.length === 1);
  return plans
    .filter((p) => p.segs.length === 1 || !direct || p.cost < direct.cost - 10 * 60)
    .slice(0, MAX_TIMED);
}

type Label =
  | { cost: number; prev: { type: 'start'; anchor: string } }
  | { cost: number; prev: { type: 'bus'; route: NetRoute; from: string } }
  | { cost: number; prev: { type: 'walk'; from: string } };

/**
 * Ronda a ronda, a forma mais barata de chegar a cada paragem com 1, 2, … MAX_BUSES autocarros
 * (uma etiqueta por paragem e ronda, como no RAPTOR). Devolve o plano da primeira ronda que
 * chega a um destino, e o da ronda seguinte quando é claramente mais rápido.
 */
function fewestBuses(
  net: Network,
  origins: Map<string, { anchor: string; m: number }>,
  dests: Map<string, { anchor: string; m: number }>,
  v: number,
): Plan[] {
  const MAX_BUSES = 5;
  const any: Map<string, Label>[] = [new Map([...origins].map(([id, o]) => [id, { cost: o.m / WALK_MPS, prev: { type: 'start', anchor: o.anchor } }]))];
  const byBus: Map<string, Label>[] = [new Map()];
  const routeInto = (k: number, stop: string): string | null => {
    let label = any[k].get(stop);
    if (label?.prev.type === 'walk') label = byBus[k].get(label.prev.from);
    return label?.prev.type === 'bus' ? label.prev.route.id : null;
  };

  const found: Plan[] = [];
  for (let k = 1; k <= MAX_BUSES; k++) {
    const bus = new Map<string, Label>();
    for (const r of net.routes.values()) {
      const boardings = r.stops.filter((s) => any[k - 1].has(s.id) && routeInto(k - 1, s.id) !== r.id);
      if (!boardings.length) continue;
      for (const z of r.stops) {
        for (const y of boardings) {
          const m = Math.abs(z.at - y.at);
          if (m < MIN_RIDE_M) continue;
          const cost = any[k - 1].get(y.id)!.cost + BOARD_PENALTY_S + m / v;
          if (cost < (bus.get(z.id)?.cost ?? Infinity)) bus.set(z.id, { cost, prev: { type: 'bus', route: r, from: y.id } });
        }
      }
    }
    const reached = new Map<string, Label>(bus);
    for (const [z, label] of bus) {
      for (const { id: w, m } of net.near.get(z) ?? []) {
        const cost = label.cost + m / WALK_MPS;
        if (cost < (reached.get(w)?.cost ?? Infinity)) reached.set(w, { cost, prev: { type: 'walk', from: z } });
      }
    }
    byBus.push(bus);
    any.push(reached);
    if (!bus.size) break;

    let best: { cost: number; d: string } | null = null;
    for (const [d, w] of dests) {
      const label = reached.get(d);
      if (label && (!best || label.cost + w.m / WALK_MPS < best.cost)) best = { cost: label.cost + w.m / WALK_MPS, d };
    }
    if (!best) continue;

    // Seguir as etiquetas para trás até à origem
    const segs: Segment[] = [];
    let stop = best.d;
    let origin = '';
    for (let round = k; round >= 0; round--) {
      let label = any[round].get(stop)!;
      if (label.prev.type === 'start') {
        origin = label.prev.anchor;
        break;
      }
      if (label.prev.type === 'walk') {
        stop = label.prev.from;
        label = byBus[round].get(stop)!;
      }
      if (label.prev.type !== 'bus') break;
      segs.unshift({ route: label.prev.route, from: label.prev.from, to: stop });
      stop = label.prev.from;
    }
    if (!origin || segs.length !== k) continue;
    const plan = { origin, dest: dests.get(best.d)!.anchor, segs, cost: best.cost };
    if (!found.length) found.push(plan);
    else {
      if (plan.cost < found[0].cost - 15 * 60) found.push(plan);
      break;
    }
  }
  return found;
}

// ─── Chegada mais cedo a todo o lado ──────────────────────────────────────────

/** Máximo de autocarros numa viagem na pesquisa dependente do tempo */
const MAX_TIMED_BUSES = 4;
/**
 * Uma paragem de partida mais perto do passageiro ganha a outra mais longe, a montante na mesma
 * via, quando o seu autocarro chega no máximo este tempo mais tarde: normalmente são o mesmo
 * autocarro, e as estimativas da passagem em cada paragem diferem um pouco.
 */
const BOARD_SLACK_MS = 2 * 60000;

interface TimedLabel {
  /** Quando o passageiro está na paragem (ms) */
  t: number;
  prev:
    | { type: 'start'; anchor: string }
    | { type: 'bus'; route: NetRoute; from: string }
    | { type: 'walk'; from: string };
}

interface Arrivals {
  /** rounds[k]: as paragens cuja chegada mais cedo melhorou com k autocarros */
  rounds: Map<string, TimedLabel>[];
  /** O mesmo, sem a caminhada no fim da ronda */
  byBus: Map<string, TimedLabel>[];
  /** Chegada mais cedo a cada paragem, e a ronda em que foi alcançada */
  best: Map<string, { t: number; k: number }>;
}

/**
 * Chegada mais cedo a todas as paragens a partir de `origins`, com 1, 2, … MAX_TIMED_BUSES
 * autocarros, usando a próxima passagem real de cada autocarro (GPS quando recente, senão a
 * viagem do motorista) no momento em que o passageiro está na paragem: um RAPTOR dependente do tempo. Cada
 * ronda percorre todas as vias que passam numa paragem melhorada na ronda anterior, nos dois
 * sentidos, ficando no autocarro já apanhado a menos que outro, numa paragem seguinte, chegue
 * mais cedo. Porquê RAPTOR: é o algoritmo usado em planeadores de transportes públicos, rápido
 * numa rede deste tamanho e natural para contar transbordos (uma ronda = um autocarro).
 */
function earliestArrivals(net: Network, origins: Catchment, vehicles: Map<string, Vehicle[]>, rule: FareRule, now: Date): Arrivals {
  // A bordo, à velocidade do autocarro apanhado (a média do GPS, ou a da tarifa), como estimateBusTrip
  const ride = (m: number, kmh: number) => Math.max(1, Math.ceil(m / ((kmh * 1000) / 3600) / 60)) * 60000;
  const start = new Map<string, TimedLabel>();
  for (const [id, o] of origins) {
    start.set(id, { t: now.getTime() + (o.m > 0 ? walkMinutes(o.m) * 60000 : 0), prev: { type: 'start', anchor: o.anchor } });
  }
  const best = new Map([...start].map(([id, l]) => [id, { t: l.t, k: 0 }]));
  const rounds = [start];
  const byBus: Map<string, TimedLabel>[] = [new Map()];
  const cameBy = (k: number, stop: string): string | null => {
    let label = rounds[k].get(stop);
    if (label?.prev.type === 'walk') label = byBus[k].get(label.prev.from);
    return label?.prev.type === 'bus' ? label.prev.route.id : null;
  };

  for (let k = 1; k <= MAX_TIMED_BUSES; k++) {
    const marked = rounds[k - 1];
    const routeIds = new Set([...marked.keys()].flatMap((id) => net.stops.get(id)?.routeIds ?? []));
    const bus = new Map<string, TimedLabel>();

    for (const routeId of routeIds) {
      const r = net.routes.get(routeId);
      const vs = vehicles.get(routeId) ?? [];
      if (!r || !vs.length) continue;
      for (const order of [r.stops, [...r.stops].reverse()]) {
        let cur: { from: string; board: number; at: number; kmh: number } | null = null;
        for (let i = 0; i < order.length; i++) {
          const z = order[i];
          const curAtZ = cur ? cur.board + ride(Math.abs(z.at - cur.at), cur.kmh) : Infinity;
          if (cur && Math.abs(z.at - cur.at) >= MIN_RIDE_M && curAtZ < (best.get(z.id)?.t ?? Infinity) && curAtZ < (bus.get(z.id)?.t ?? Infinity)) {
            bus.set(z.id, { t: curAtZ, prev: { type: 'bus', route: r, from: cur.from } });
          }
          // Entrar aqui quando o passageiro chega antes do autocarro já apanhado
          const ready = marked.get(z.id);
          if (!ready || i === order.length - 1 || ready.t >= curAtZ || cameBy(k - 1, z.id) === r.id) continue;
          const closerStart = k === 1 && cur !== null && ready.t < (start.get(cur.from)?.t ?? Infinity);
          let boardAt = closerStart ? curAtZ + BOARD_SLACK_MS : curAtZ;
          for (const vehicle of vs) {
            const trip = estimateBusTrip({ vehicle, path: r.g.path, stops: r.routeStops, origemId: z.id, destinoId: order[i + 1].id, rule, now: new Date(ready.t) });
            if (!trip) continue;
            const board = ready.t + trip.tempoChegada * 60000;
            if (board < boardAt) {
              boardAt = board;
              cur = { from: z.id, board, at: z.at, kmh: trip.position?.speedKmh ?? rule.velocidadeViagemKmh };
            }
          }
        }
      }
    }

    // Uma caminhada curta até às paragens próximas, para mudar de autocarro lá
    const reached = new Map<string, TimedLabel>(bus);
    for (const [z, label] of bus) {
      for (const { id: w, m } of net.near.get(z) ?? []) {
        const t = label.t + walkMinutes(m) * 60000;
        if (t < (best.get(w)?.t ?? Infinity) && t < (reached.get(w)?.t ?? Infinity)) reached.set(w, { t, prev: { type: 'walk', from: z } });
      }
    }
    for (const [id, l] of reached) best.set(id, { t: l.t, k });
    rounds.push(reached);
    byBus.push(bus);
    if (!reached.size) break;
  }
  return { rounds, byBus, best };
}

/** Os autocarros apanhados para chegar a `stop`, lidos das etiquetas (e a origem onde começou). */
function segmentsTo(a: Arrivals, stop: string): { origin: string; segs: Segment[] } | null {
  const reached = a.best.get(stop);
  if (!reached) return null;
  const segs: Segment[] = [];
  let at = stop;
  for (let k = reached.k; k >= 0; k--) {
    let label = a.rounds[k].get(at);
    if (!label) return null;
    if (label.prev.type === 'start') return { origin: label.prev.anchor, segs };
    if (label.prev.type === 'walk') {
      at = label.prev.from;
      label = a.byBus[k].get(at);
    }
    if (label?.prev.type !== 'bus') return null;
    segs.unshift({ route: label.prev.route, from: label.prev.from, to: at });
    at = label.prev.from;
  }
  const first = a.rounds[0].get(at);
  return first?.prev.type === 'start' ? { origin: first.prev.anchor, segs } : null;
}

async function allVehicles(): Promise<Map<string, Vehicle[]>> {
  const rows = await prisma.transporte.findMany({
    where: { viaId: { not: null }, via: { ativa: true } },
    select: { ...POSITION_FIELDS, matricula: true, viaId: true },
  });
  const byRoute = new Map<string, Vehicle[]>();
  for (const v of rows) {
    const list = byRoute.get(v.viaId!);
    if (list) list.push(v);
    else byRoute.set(v.viaId!, [v]);
  }
  return byRoute;
}

export function pathBetween(r: NetRoute, a: number, b: number): [number, number][] {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const inner = r.g.path.filter((_, i) => r.g.cumulative[i] > lo && r.g.cumulative[i] < hi);
  // Cortar exactamente nas duas paragens: um percurso simplificado pode ter um só ponto para uma avenida inteira
  const pts = r.g.path.length > 1 ? [pointAlong(r.g, lo).point, ...inner, pointAlong(r.g, hi).point] : inner;
  const lngLat = pts.map(([lat, lng]) => [lng, lat] as [number, number]);
  return a <= b ? lngLat : lngLat.reverse();
}

/**
 * Viagens até `to` (paragens do mesmo local, ou uma paragem), a melhor primeiro. `from` é também
 * uma lista de paragens, ou a posição do passageiro como [lat, lng]: a viagem começa então com uma
 * caminhada até uma paragem próxima. A partir de paragens, o primeiro autocarro é apanhado numa
 * delas; só quando nenhum autocarro de lá chega a `to` é que a viagem começa com uma caminhada
 * até uma paragem próxima. As caminhadas entre autocarros, e até uma paragem perto de `to` no
 * fim, fazem parte das viagens.
 */
export async function planJourneys(
  from: string[] | LatLng,
  to: string[],
  now = new Date(),
  limit = 3,
): Promise<Journey[]> {
  if (typeof from[0] === 'number') return planFrom(from, to, now, limit, 0);
  if ((from as string[]).some((id) => to.includes(id))) return [];
  const there = await planFrom(from, to, now, limit, 0);
  return there.length ? there : planFrom(from, to, now, limit, WALK_END_M);
}

/**
 * Verdadeiro quando as rotas ligam as paragens `from` às `to` (com transbordos), haja ou não
 * autocarros em viagem agora: distingue "não há ligação" de "nenhum autocarro em serviço agora".
 */
export async function hasConnection(from: string[], to: string[]): Promise<boolean> {
  const [net, rule] = await Promise.all([loadNetwork(), getFareRule()]);
  const dests = catchment(net, to, WALK_END_M);
  return [0, WALK_END_M].some((radius) => candidatePlans(net, catchment(net, from, radius), dests, rule).length > 0);
}

/** A tarifa de uma ligação pelas rotas, sem horas: o que a opção 4 do USSD mostra. */
export interface PlannedFare {
  tarifa: number;
  codigos: string[];
  /** A bordo e a pé, sem as esperas */
  minutos: number;
  /** Só a bordo */
  metros: number;
}

/**
 * A tarifa e o tempo da melhor ligação pelas rotas entre as paragens `from` e `to`, haja ou não
 * autocarros em viagem. Porquê: o preço não depende de um motorista ter iniciado a viagem, e a
 * opção 4 do USSD deve dá-lo sempre (planJourneys só dá viagens com autocarros em serviço).
 */
export async function plannedFare(from: string[], to: string[]): Promise<PlannedFare | null> {
  if (from.some((id) => to.includes(id))) return null;
  const [net, rule] = await Promise.all([loadNetwork(), getFareRule()]);
  const dests = catchment(net, to, WALK_END_M);
  for (const radius of [0, WALK_END_M]) {
    const [plan] = candidatePlans(net, catchment(net, from, radius), dests, rule);
    if (!plan) continue;
    const point = (id: string) => net.stops.get(id)!.point;
    const walk = (a: string, b: string) => (a === b ? 0 : walkMinutes(Math.round(distanceMeters(point(a), point(b)))));
    let at = plan.origin;
    let minutos = 0;
    let metros = 0;
    let tarifa = 0;
    for (const seg of plan.segs) {
      // As mesmas contas que estimateBusTrip faz para cada autocarro
      const m = Math.abs(seg.route.at.get(seg.to)! - seg.route.at.get(seg.from)!);
      minutos += walk(at, seg.from) + Math.max(1, travelMinutes(m, rule));
      metros += m;
      tarifa += fareFor(m, rule);
      at = seg.to;
    }
    minutos += walk(at, plan.dest);
    return { tarifa, codigos: plan.segs.map((s) => s.route.codigo), minutos, metros };
  }
  return null;
}

/** planJourneys, com o primeiro autocarro apanhado a menos de `startRadius` das paragens de partida. */
async function planFrom(from: string[] | LatLng, to: string[], now: Date, limit: number, startRadius: number): Promise<Journey[]> {
  const [net, rule] = await Promise.all([loadNetwork(), getFareRule()]);
  const position = typeof from[0] === 'number' ? (from as LatLng) : null;
  const fromIds = position ? [] : (from as string[]);
  const origins = position ? catchmentOfPoint(net, position) : catchment(net, fromIds, startRadius);
  const dests = catchment(net, to, WALK_END_M);
  const plans = candidatePlans(net, origins, dests, rule);
  const vehicles = await allVehicles();

  // A chegada mais cedo com as horas reais dos autocarros: pode ganhar a todas as candidatas de
  // velocidade fixa (um autocarro que vem mais cedo), e é o que a lista de destinos de uma paragem mostra
  const arrivals = earliestArrivals(net, origins, vehicles, rule, now);
  let soonest: { id: string; t: number } | null = null;
  for (const [d, w] of dests) {
    const b = arrivals.best.get(d);
    const t = b && b.k > 0 ? b.t + (w.m > 0 ? walkMinutes(w.m) * 60000 : 0) : Infinity;
    if (t < (soonest?.t ?? Infinity)) soonest = { id: d, t };
  }
  const fastest = soonest ? segmentsTo(arrivals, soonest.id) : null;
  if (fastest?.segs.length) {
    const key = (segs: Segment[]) => segs.map((s) => `${s.route.id}:${s.from}:${s.to}`).join('>');
    if (!plans.some((p) => key(p.segs) === key(fastest.segs))) {
      plans.unshift({ origin: fastest.origin, dest: dests.get(soonest!.id)!.anchor, segs: fastest.segs, cost: 0 });
    }
  }
  if (!plans.length) return [];
  const refOf = (id: string): StopRef =>
    id === ME && position ? { id: '', nome: 'A sua localização', lat: position[0], lng: position[1] } : ref(net.stops.get(id)!);

  const timed: Journey[] = [];
  for (const plan of plans) {
    const etapas: (WalkLeg | BusLeg)[] = [];
    let t = now.getTime();
    let at = plan.origin;
    const walk = (to: string) => {
      if (to === at) return;
      const a = refOf(at);
      const b = refOf(to);
      const metros = Math.round(distanceMeters([a.lat, a.lng], [b.lat, b.lng]));
      const minutos = walkMinutes(metros);
      etapas.push({ tipo: 'pe', de: a, para: b, metros, minutos });
      t += minutos * 60000;
      at = to;
    };

    let ok = true;
    for (const seg of plan.segs) {
      walk(seg.from);
      const bus = firstBus(seg.route, vehicles.get(seg.route.id) ?? [], seg.from, seg.to, rule, new Date(t));
      if (!bus) {
        ok = false;
        break;
      }
      const board = t + bus.trip.tempoChegada * 60000;
      const arrive = board + bus.trip.tempoViagem * 60000;
      const a = seg.route.at.get(seg.from)!;
      const b = seg.route.at.get(seg.to)!;
      etapas.push({
        tipo: 'autocarro',
        via: { id: seg.route.id, codigo: seg.route.codigo, nome: seg.route.nome, cor: seg.route.cor },
        transporte: { id: bus.vehicle.id, matricula: bus.vehicle.matricula },
        sentido: towards(net, seg.route, bus.trip.sentido),
        de: ref(net.stops.get(seg.from)!),
        para: ref(net.stops.get(seg.to)!),
        esperaMin: bus.trip.tempoChegada,
        embarque: new Date(board).toISOString(),
        chegada: new Date(arrive).toISOString(),
        viagemMin: bus.trip.tempoViagem,
        metros: Math.round(bus.trip.distanciaViagem),
        paragens: seg.route.stops.filter((s) => s.at > Math.min(a, b) && s.at <= Math.max(a, b)).length,
        tarifa: bus.trip.fare,
        percurso: pathBetween(seg.route, a, b),
      });
      t = arrive;
      at = seg.to;
    }
    if (!ok) continue;
    walk(plan.dest);

    const buses = etapas.filter((e): e is BusLeg => e.tipo === 'autocarro');
    timed.push({
      transbordos: buses.length - 1,
      partida: buses[0].embarque,
      chegada: new Date(t).toISOString(),
      duracaoMin: Math.round((t - now.getTime()) / 60000),
      tarifa: buses.reduce((sum, e) => sum + e.tarifa, 0),
      metrosAPe: etapas.reduce((sum, e) => sum + (e.tipo === 'pe' ? e.metros : 0), 0),
      etapas,
    });
  }

  // A chegada mais cedo primeiro. As opções que nenhuma outra bate na chegada e nos transbordos
  // vêm primeiro, depois as restantes (outras vias) por ordem de chegada
  timed.sort((a, b) => a.chegada.localeCompare(b.chegada) || a.transbordos - b.transbordos);
  // Um autocarro um ou dois minutos mais tarde numa paragem mais perto ganha a uma caminhada mais
  // longa para o apanhar antes: a mesma regra da lista de destinos (BOARD_SLACK_MS), para que a viagem escolhida coincida com a lista
  if (timed.length) {
    const first = timed[0];
    const closer = timed
      .filter((j) => j.transbordos === first.transbordos && j.metrosAPe < first.metrosAPe && Date.parse(j.chegada) - Date.parse(first.chegada) <= BOARD_SLACK_MS)
      .sort((a, b) => a.metrosAPe - b.metrosAPe)[0];
    if (closer) timed.unshift(...timed.splice(timed.indexOf(closer), 1));
  }
  const beaten = (j: Journey, i: number) =>
    timed.some((k, n) => n < i && k.chegada <= j.chegada && k.transbordos <= j.transbordos);
  const best = timed.filter((j, i) => !beaten(j, i));
  return [...best, ...timed.filter((j) => !best.includes(j))].slice(0, limit);
}

// ─── Todos os destinos de uma paragem ─────────────────────────────────────────

export interface Destino {
  /** As paragens do local, para planear a viagem até lá */
  ids: string[];
  nome: string;
  chegada: string;
  minutos: number;
  transbordos: number;
  /** As vias dos autocarros, pela ordem em que são apanhados */
  vias: { codigo: string; nome: string; cor: string }[];
  /** Onde se apanha o primeiro autocarro (B em A → B → C), e a caminhada até lá desde o início */
  embarque: StopRef;
  metrosAtePrimeira: number;
}

const labelCache = new WeakMap<Network, Map<Place<NetStop>, string>>();

function labelOf(net: Network, place: Place<NetStop>): string {
  let labels = labelCache.get(net);
  if (!labels) labelCache.set(net, (labels = new Map()));
  let label = labels.get(place);
  if (label === undefined) labels.set(place, (label = placeLabel(net, place)));
  return label;
}

/**
 * Todos os locais a que se chega a partir de `from` com até MAX_TIMED_BUSES autocarros, a chegada
 * mais cedo primeiro, com as horas reais dos autocarros. `from` é uma paragem (ou as paragens de
 * um local), onde se apanha o primeiro autocarro, ou uma posição: a primeira paragem de cada
 * viagem é então a que chega lá mais cedo, a uma caminhada curta. Os locais a uma caminhada curta
 * do início ficam de fora.
 */
export async function reachFrom(from: string[] | LatLng, now = new Date()): Promise<Destino[] | null> {
  const [net, rule, vehicles] = await Promise.all([loadNetwork(), getFareRule(), allVehicles()]);
  const position = typeof from[0] === 'number' ? (from as LatLng) : null;
  const ids = position ? [] : (from as string[]);
  if (!position && !ids.some((id) => net.stops.has(id))) return null;
  const origins = position ? catchmentOfPoint(net, position) : catchment(net, ids, 0);
  if (!origins.size) return [];
  const arrivals = earliestArrivals(net, origins, vehicles, rule, now);
  const walkable = position ? origins : catchment(net, ids, WALK_END_M);

  const out: Destino[] = [];
  for (const place of net.places) {
    if (place.stops.some((s) => walkable.has(s.id))) continue;
    // Como em planJourneys: as paragens do local, ou uma paragem a uma caminhada curta delas
    let soonest: { id: string; t: number } | null = null;
    for (const [id, w] of catchment(net, place.stops.map((s) => s.id), WALK_END_M)) {
      const b = arrivals.best.get(id);
      const t = b && b.k > 0 ? b.t + (w.m > 0 ? walkMinutes(w.m) * 60000 : 0) : Infinity;
      if (t < (soonest?.t ?? Infinity)) soonest = { id, t };
    }
    const path = soonest && segmentsTo(arrivals, soonest.id);
    if (!soonest || !path?.segs.length) continue;
    const board = net.stops.get(path.segs[0].from)!;
    out.push({
      ids: place.stops.map((s) => s.id),
      nome: labelOf(net, place),
      chegada: new Date(soonest.t).toISOString(),
      minutos: Math.round((soonest.t - now.getTime()) / 60000),
      transbordos: path.segs.length - 1,
      vias: path.segs.map((s) => ({ codigo: s.route.codigo, nome: s.route.nome, cor: s.route.cor })),
      embarque: ref(board),
      metrosAtePrimeira: Math.round(origins.get(board.id)?.m ?? 0),
    });
  }
  return out.sort((x, y) => x.chegada.localeCompare(y.chegada) || x.transbordos - y.transbordos);
}
