import { prisma } from './prisma';
import { getFareRule, parseLatLng, type FareRule, type LatLng, type RouteStop } from './fares';
import {
  POSITION_FIELDS,
  estimateBusTrip,
  progressOf,
  routeGeometry,
  type Direction,
  type PositionedVehicle,
  type RouteGeometry,
} from './vehiclePosition';
import { distanceMeters, groupPlaces, normalizeName, walkMinutes, type Place } from './places';

/**
 * Journey planning on the bus network: the destinations a stop reaches directly, and journeys
 * between two stops with up to two changes of bus, used by the web app and USSD.
 *
 * Buses shuttle back and forth along their route, so a bus reaches every stop of its route from
 * any other. Options are first ranked with fixed speeds and a fixed wait per bus, then the best
 * ones are timed with the real positions of the buses (estimateBusTrip): GPS when fresh, else
 * the timetable, at the moment the passenger reaches each stop.
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
  g: RouteGeometry;
  /** Stops in path order, with their distance along the path */
  stops: { id: string; at: number }[];
  at: Map<string, number>;
  routeStops: RouteStop[];
}

export interface Network {
  stops: Map<string, NetStop>;
  routes: Map<string, NetRoute>;
  /** Other stops within WALK_TRANSFER_M of each stop, nearest first */
  near: Map<string, { id: string; m: number }[]>;
  places: Place<NetStop>[];
}

const NETWORK_CACHE_MS = 5 * 60 * 1000;
/** Longest walk between two stops to change buses */
const WALK_TRANSFER_M = 400;
/** Longest walk from the chosen stop to a nearby stop with a better bus (and at the end) */
const WALK_END_M = 300;
/** Riding a bus for less than this is not worth a change */
const MIN_RIDE_M = 300;
/** Straight-line metres per second on foot (4.5 km/h, streets a quarter longer) */
const WALK_MPS = 1;
/** Wait assumed per bus when ranking options, before real times are computed */
const BOARD_PENALTY_S = 10 * 60;
const MAX_TIMED = 8;

let cache: { at: number; network: Promise<Network> } | null = null;

/** The network of routes that have buses, cached per server instance for a few minutes. */
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
    where: { transportes: { some: {} } },
    select: {
      id: true,
      codigo: true,
      nome: true,
      cor: true,
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

    // Without a drawn path, the line through the stops stands in for it
    let g = routeGeometry(via.geoLocationPath);
    if (g.path.length < 2) g = routeGeometry([...own.values()]);
    const ordered = [...own].map(([id, point]) => ({ id, at: progressOf(g, point) })).sort((a, b) => a.at - b.at);
    routes.set(via.id, {
      id: via.id,
      codigo: via.codigo,
      nome: via.nome,
      cor: via.cor,
      g,
      stops: ordered,
      at: new Map(ordered.map((s) => [s.id, s.at])),
      routeStops: ordered.map((s) => ({ id: s.id, point: own.get(s.id)! })),
    });
  }

  return { stops, routes, near: nearbyPairs(stops), places: groupPlaces([...stops.values()]) };
}

/** For every stop, the stops within WALK_TRANSFER_M (grid of ~500 m cells). */
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

/** "Avenida das Indústrias" → "Av. Indústrias": room for what tells same-name places apart. */
function shortPlaceName(nome: string): string {
  return nome
    .replace(/^Avenida\b/i, 'Av.')
    .replace(/^Estrada\b/i, 'Estr.')
    .replace(/\s+(da|das|de|do|dos)\s+/gi, ' ')
    .trim();
}

/** The nearest place with another name within 1.5 km of `place`, else its first route. */
function landmarkOf(net: Network, place: Place<NetStop>): { nome: string; m: number | null } {
  const name = normalizeName(place.nome);
  let best: { nome: string; m: number } | null = null;
  for (const p of net.places) {
    if (normalizeName(p.nome) === name) continue;
    const m = distanceMeters(place.point, p.point);
    if (m <= 1500 && (!best || m < best.m)) best = { nome: p.nome, m };
  }
  return best ?? { nome: net.routes.get(place.stops[0].routeIds[0])?.nome ?? '', m: null };
}

/**
 * The place's name, and when other places have the same name, what tells them apart: the
 * nearest place with another name ("Av. Indústrias - Machava-Sede"), with the distance to it
 * when two of them have the same one ("Av. Indústrias - Machava-Sede 960 m").
 */
export function placeLabel(net: Network, place: Place<NetStop>, max = Infinity): string {
  const name = normalizeName(place.nome);
  const twins = net.places.filter((p) => normalizeName(p.nome) === name);
  if (twins.length < 2) return place.nome;
  const own = landmarkOf(net, place);
  const shared = twins.some((t) => t !== place && landmarkOf(net, t).nome === own.nome);
  const tail = `${own.nome}${shared && own.m !== null ? ` ${Math.round(own.m / 10) * 10} m` : ''}`;
  // Short of room (USSD), the name is shortened first: the person typed it, the tail is new
  let head = shortPlaceName(place.nome);
  const room = max - tail.length - 3;
  if (head.length > room) head = `${head.slice(0, Math.max(3, room - 2))}..`;
  return `${head} - ${tail}`;
}

type Vehicle = PositionedVehicle & { matricula: string; viaId: string | null };

async function vehiclesOn(routeIds: Iterable<string>): Promise<Map<string, Vehicle[]>> {
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

/** The first bus of `route` to take a passenger who is at `fromId` at `ready` to `toId`. */
function firstBus(route: NetRoute, vehicles: Vehicle[], fromId: string, toId: string, rule: FareRule, ready: Date) {
  let best: { vehicle: Vehicle; trip: NonNullable<ReturnType<typeof estimateBusTrip>> } | null = null;
  for (const vehicle of vehicles) {
    const trip = estimateBusTrip({ vehicle, path: route.g.path, stops: route.routeStops, origemId: fromId, destinoId: toId, rule, now: ready });
    if (trip && (!best || trip.tempoChegada < best.trip.tempoChegada)) best = { vehicle, trip };
  }
  return best;
}

/** End of the route in direction `dir`, which names the direction ("sentido Baixa"). */
function towards(net: Network, route: NetRoute, dir: Direction): string {
  const end = dir === 1 ? route.stops[route.stops.length - 1] : route.stops[0];
  return net.stops.get(end.id)?.nome ?? '';
}

// ─── Destinations of one stop ─────────────────────────────────────────────────

export interface StopRef {
  id: string;
  nome: string;
  lat: number;
  lng: number;
}

const ref = (s: NetStop): StopRef => ({ id: s.id, nome: s.nome, lat: s.point[0], lng: s.point[1] });

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

/** Every stop reachable from `stopId` without changing bus, by route and direction, with the next bus. */
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
  /** Minutes from the moment the passenger is at the stop until the bus comes */
  esperaMin: number;
  embarque: string;
  chegada: string;
  viagemMin: number;
  metros: number;
  paragens: number;
  tarifa: number;
  /** [lng, lat] points along the road, for drawing */
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

/** Anchor of journeys that start where the passenger is, rather than at a stop. */
const ME = '@me';
/** From the passenger's position: stops within this walk, the nearest MAX_START_STOPS */
const WALK_FROM_POSITION_M = 800;
const MAX_START_STOPS = 8;

type Catchment = Map<string, { anchor: string; m: number }>;

/** Each stop within `radius` of one of `ids` (them included), with the nearest of `ids` and the distance. */
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

/** The stops a passenger at `point` can walk to. */
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

  // Cheapest way to each stop of a route boarding at an origin, and from each stop to a destination
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
  const out = new Map<string, Plan>(); // best plan per sequence of routes
  const keep = (plan: Plan) => {
    const key = plan.segs.map((s) => s.route.id).join('>');
    const old = out.get(key);
    if (!old || plan.cost < old.cost) out.set(key, plan);
  };

  // No change: origin and destination on the same route (a short ride is fine here)
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

  // One change
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

  // More changes, only when one is not enough
  if (out.size === 0) for (const plan of fewestBuses(net, origins, dests, v)) keep(plan);

  const plans = [...out.values()].sort((p, q) => p.cost - q.cost);
  // A change is only offered when it is clearly better than the best direct bus
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
 * Round by round, the cheapest way to every stop with 1, 2, … MAX_BUSES buses (one label per
 * stop and round, as in RAPTOR). Returns the plan of the first round that reaches a destination,
 * and of the next round when it is clearly faster.
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

    // Walk the labels back to the origin
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

function pathBetween(r: NetRoute, a: number, b: number): [number, number][] {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const pts = r.g.path.filter((_, i) => r.g.cumulative[i] >= lo && r.g.cumulative[i] <= hi);
  const lngLat = pts.map(([lat, lng]) => [lng, lat] as [number, number]);
  return a <= b ? lngLat : lngLat.reverse();
}

/**
 * Journeys to `to` (stops of the same place, or one stop), best first. `from` is likewise a list
 * of stops, or the passenger's position as [lat, lng]: the journey then starts with a walk to a
 * nearby stop. Walks to a nearby stop at either end, and between buses, are part of journeys.
 */
export async function planJourneys(
  from: string[] | LatLng,
  to: string[],
  now = new Date(),
  limit = 3,
): Promise<Journey[]> {
  const [net, rule] = await Promise.all([loadNetwork(), getFareRule()]);
  const position = typeof from[0] === 'number' ? (from as LatLng) : null;
  const fromIds = position ? [] : (from as string[]);
  if (fromIds.some((id) => to.includes(id))) return [];
  const origins = position ? catchmentOfPoint(net, position) : catchment(net, fromIds, WALK_END_M);
  const plans = candidatePlans(net, origins, catchment(net, to, WALK_END_M), rule);
  if (!plans.length) return [];
  const vehicles = await vehiclesOn(plans.flatMap((p) => p.segs.map((s) => s.route.id)));
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

  // Earliest arrival first. Options no other option beats on both arrival and changes come
  // first, then the rest (other routes) in order of arrival
  timed.sort((a, b) => a.chegada.localeCompare(b.chegada) || a.transbordos - b.transbordos);
  const beaten = (j: Journey, i: number) =>
    timed.some((k, n) => n < i && k.chegada <= j.chegada && k.transbordos <= j.transbordos);
  const best = timed.filter((j, i) => !beaten(j, i));
  return [...best, ...timed.filter((j) => !best.includes(j))].slice(0, limit);
}
