import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/notifications';
import {
  getFareRule, fareFor, travelMinutes,
  estimatedRoadMeters, pathLengthMeters, parseLatLng, haversineMeters, orderStopsAlongRoute, type LatLng,
} from '@/lib/fares';
import { findDriverByPhone, verifyDriverPin, startTrip, endTrip } from '@/lib/driverTrips';
import { waitUntil } from '@vercel/functions';
import { POSITION_FIELDS, estimateBusTrip, vehiclePosition } from '@/lib/vehiclePosition';
import { formatEta, maputoClock } from '@/lib/eta';

// Africa's Talking USSD format
interface USSDRequest {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data from Africa's Talking
    const formData = await request.formData();
    
    const sessionId = formData.get('sessionId') as string || '';
    const serviceCode = formData.get('serviceCode') as string || '';
    const phoneNumber = formData.get('phoneNumber') as string || '';
    const text = formData.get('text') as string || '';

    // Log for debugging; the second input of option 6 is the driver's password
    const parts = text.split('*');
    if (parts[0] === '6' && parts.length > 1) parts[1] = '***';
    console.log('📱 USSD Request:', {
      sessionId,
      serviceCode,
      phoneNumber,
      text: parts.join('*'),
      timestamp: new Date().toISOString()
    });

    // Process the USSD request
    const response = toGsm(await handleUSSD(sessionId, phoneNumber, text));

    console.log('📤 USSD Response:', response);

    // Return plain text response
    return new NextResponse(response, {
      status: 200,
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('❌ USSD Error:', error);
    return new NextResponse('END Erro ao processar pedido. Tente novamente.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}


// ─── MENU ENGINE ──────────────────────────────────────────────────────────────

// Phones show at most 182 characters per USSD screen (text after CON/END)
const USSD_MAX = 182;
const PAGE_SIZE = 6;

/**
 * Most phones and networks only show GSM-7 characters on USSD; accented letters
 * either break the screen or cut its length in half, so strip them.
 */
function toGsm(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function cutText(text: string, max: number): string {
  return text.length > max ? text.slice(0, Math.max(1, max - 2)) + '..' : text;
}

/** A page of `list` with numbered items, shortened so the screen fits USSD_MAX. */
function paginateList(title: string, list: string[], currentPage: number): string {
  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  const pageItems = list.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const nav = [
    currentPage < totalPages - 1 ? '7. Proximo' : null,
    currentPage > 0 ? '8. Anterior' : null,
    '0. Voltar',
  ].filter(Boolean).join('\n');

  // Room left for item names: each line also has "n. " and a line break
  const room = USSD_MAX - title.length - 1 - nav.length;
  const perItem = Math.max(8, Math.floor(room / Math.max(1, pageItems.length)) - 4);
  const items = pageItems.map((item, i) => `${i + 1}. ${cutText(item, perItem)}`).join('\n');
  return `CON ${title}\n${items}\n${nav}`;
}

/** The item chosen with key `choice` on page `page` of `list`. */
function pickFromList<T>(list: T[], page: number, choice: string | undefined): T | null {
  const n = Number(choice);
  if (!Number.isInteger(n) || n < 1 || n > PAGE_SIZE) return null;
  return list[page * PAGE_SIZE + n - 1] ?? null;
}

/**
 * Africa's Talking sends the whole session as "1*3*7*2". Keys 7, 8 and 0 move to the
 * next page, previous page and back; `pages[i]` is the page inputs[i] was chosen on.
 */
function parseInputs(text: string) {
  const raw = text === '' ? [] : text.split('*');

  // Typed answers (driver password, plate number) are not navigation keys
  if (raw[0] === '5' || raw[0] === '6') {
    return { inputs: raw, pages: raw.map(() => 0), currPg: 0 };
  }

  const inputs: string[] = [];
  const pages: number[] = [];
  let currPg = 0;
  for (const val of raw) {
    if (val === '7' && inputs.length > 0) currPg++;
    else if (val === '8' && inputs.length > 0) currPg = Math.max(0, currPg - 1);
    else if (val === '0') {
      if (inputs.length > 0) {
        inputs.pop();
        pages.pop();
      }
      currPg = 0;
    } else {
      inputs.push(val);
      pages.push(currPg);
      currPg = 0;
    }
  }
  return { inputs, pages, currPg };
}

const MAIN_MENU = `CON Transportes Mocambique
1. Encontrar transporte
2. Procurar rotas
3. Paragens de uma rota
4. Calcular tarifa
5. Rastrear autocarro
6. Area do motorista
7. Ajuda`;

const HELP = `END Ajuda
1 Autocarro e tempo de chegada
2 Rotas de um local
3 Paragens de uma rota
4 Preco da viagem
5 Autocarro pela matricula
6 Motoristas
Listas: 7 proximo, 8 anterior, 0 voltar`;

// Bus colours are stored as hex from the admin colour picker
const COLOR_NAMES: [string, number, number, number][] = [
  ['Branco', 255, 255, 255], ['Preto', 0, 0, 0], ['Cinzento', 128, 128, 128],
  ['Vermelho', 220, 30, 30], ['Verde', 30, 160, 60], ['Azul', 30, 70, 200],
  ['Amarelo', 245, 210, 30], ['Laranja', 245, 130, 20], ['Castanho', 120, 70, 30],
];

function colorName(color: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(color?.trim() ?? '');
  if (!m) return color || 'N/A';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  let best = COLOR_NAMES[0];
  for (const c of COLOR_NAMES) {
    if ((c[1] - r) ** 2 + (c[2] - g) ** 2 + (c[3] - b) ** 2 < (best[1] - r) ** 2 + (best[2] - g) ** 2 + (best[3] - b) ** 2) best = c;
  }
  return best[0];
}

/** Name of the stop closest to `geo` ("lat,lng"), for saying where a bus is. */
function nearestStopName(geo: string | null | undefined, stops: { nome: string; geoLocation: string | null }[]): string | null {
  const at = parseLatLng(geo);
  if (!at) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const stop of stops) {
    const pt = parseLatLng(stop.geoLocation);
    if (!pt) continue;
    const d = haversineMeters(at, pt);
    if (d < bestDist) {
      bestDist = d;
      best = stop.nome;
    }
  }
  return best;
}

const INVALID = 'END Opcao invalida. Tente novamente.';

function sms(phoneNumber: string, text: string) {
  try {
    // Without accents: one accented letter makes the whole SMS Unicode (70 characters per part)
    waitUntil(sendSMS(phoneNumber, toGsm(text)));
  } catch (e) {
    console.error('SMS Error:', e);
  }
}

async function handleUSSD(sessionId: string, phoneNumber: string, text: string): Promise<string> {
  const { inputs, pages, currPg } = parseInputs(text);

  if (inputs[0] === '6') {
    return handleDriverMenuStateless(sessionId, phoneNumber, inputs);
  }
  if (inputs.length === 0) return MAIN_MENU;

  switch (inputs[0]) {
    case '1': return findTransportMenu(phoneNumber, inputs, pages, currPg);
    case '2': return routesMenu(phoneNumber, inputs, pages, currPg);
    case '3': return routeStopsMenu(phoneNumber, inputs, pages, currPg);
    case '4': return fareMenu(phoneNumber, inputs, pages, currPg);
    case '5': return trackBusMenu(phoneNumber, inputs);
    case '7': return HELP;
    default: return INVALID;
  }
}

// ─── 1. FIND TRANSPORT ────────────────────────────────────────────────────────

async function findTransportMenu(phoneNumber: string, inputs: string[], pages: number[], currPg: number) {
  const locations = await getAvailableLocations();
  if (inputs.length === 1) {
    if (locations.length === 0) return 'END Nenhuma localizacao disponivel de momento.';
    return paginateList('Onde esta agora?', locations, currPg);
  }

  const origin = pickFromList(locations, pages[1], inputs[1]);
  if (!origin) return INVALID;
  const destinations = await getAvailableDestinations(origin);
  if (inputs.length === 2) {
    if (destinations.length === 0) return `END Nenhum transporte disponivel de ${origin}.`;
    const nearest = await findNearestStop(origin);
    return paginateList(`Perto de: ${nearest?.name ?? origin}\nPara onde vai?`, destinations, currPg);
  }

  const destination = pickFromList(destinations, pages[2], inputs[2]);
  if (!destination) return INVALID;
  const info = await findTransportInfo(origin, destination);
  if (!info) return `END Nenhum transporte encontrado de ${origin} para ${destination}.`;

  if (inputs.length === 3) {
    // Lets the bus-arrival SMS find this passenger
    try {
      await createMissionForUser(phoneNumber, info.origem);
    } catch (error) {
      console.error('Error creating mission:', error);
    }
    // Long waits (the first bus of the morning) as a clock time
    const eta = formatEta(info.timeUntilBusArrives);
    return `CON TRANSPORTE ENCONTRADO
Autocarro: ${info.busId}
Chega ${eta.isClock ? eta.text : `em: ${eta.text}`}
Viagem: ${info.travelTime} min
Tarifa: ${info.fare} MT

1. Receber por SMS
0. Voltar`;
  }

  if (inputs[3] === '1') {
    const eta = formatEta(info.timeUntilBusArrives);
    sms(phoneNumber, `Autocarro ${info.busId}: chega ${eta.isClock ? eta.text : `em ${eta.text}`} a ${info.from}. Viagem ate ${info.to}: ${info.travelTime} min, ${info.distance} km. Tarifa: ${info.fare} MT. Chegada prevista: ${info.arrivalTime}.`);
    return 'END Detalhes enviados por SMS.';
  }
  return INVALID;
}

// ─── 2. ROUTES FROM A PLACE ───────────────────────────────────────────────────

async function routesMenu(phoneNumber: string, inputs: string[], pages: number[], currPg: number) {
  const origins = await getAvailableOrigins();
  if (inputs.length === 1) {
    if (origins.length === 0) return 'END Nenhuma rota disponivel de momento.';
    return paginateList('Procurar rotas - origem:', origins, currPg);
  }

  const origin = pickFromList(origins, pages[1], inputs[1]);
  if (!origin) return INVALID;
  const routes = await getRoutesFrom(origin);
  if (inputs.length === 2) {
    if (routes.length === 0) return `END Nenhuma rota encontrada de ${origin}.`;
    return paginateList(`Rotas de ${origin}:`, routes.map((r) => `${r.terminalChegada} (${r.nome})`), currPg);
  }

  const route = pickFromList(routes, pages[2], inputs[2]);
  if (!route) return INVALID;
  const rule = await getFareRule();
  const meters = pathLengthMeters(route.stops);
  const details = `${route.nome}
De: ${route.terminalPartida}
Para: ${route.terminalChegada}
Paragens: ${route.stops.length}
Distancia: ${(meters / 1000).toFixed(1)} km
Tarifa (percurso todo): ${fareFor(meters, rule)} MT
Autocarros: ${route.buses}`;
  sms(phoneNumber, details);
  return `END ${details}`;
}

// ─── 3. STOPS OF A ROUTE ──────────────────────────────────────────────────────

async function routeStopsMenu(phoneNumber: string, inputs: string[], pages: number[], currPg: number) {
  const locations = await getAvailableLocations();
  if (inputs.length === 1) {
    if (locations.length === 0) return 'END Nenhuma rota disponivel de momento.';
    return paginateList('Paragens - inicio da rota:', locations, currPg);
  }

  const origin = pickFromList(locations, pages[1], inputs[1]);
  if (!origin) return INVALID;
  const destinations = await getAvailableDestinations(origin);
  if (inputs.length === 2) {
    if (destinations.length === 0) return `END Nenhuma rota disponivel de ${origin}.`;
    return paginateList(`De ${origin}\nFim da rota:`, destinations, currPg);
  }

  const destination = pickFromList(destinations, pages[2], inputs[2]);
  if (!destination) return INVALID;
  const stops = await getRouteStopNames(origin, destination);
  if (stops.length === 0) return 'END Esta rota nao tem paragens registadas.';
  if (inputs.length === 3) {
    return paginateList(`Paragens (${stops.length}):`, stops.map((s) => s.nome), currPg);
  }

  const stop = pickFromList(stops, pages[3], inputs[3]);
  if (!stop) return INVALID;
  const details = `${stop.nome}
Paragem ${stop.position} de ${stops.length}
Rota: ${origin} -> ${destination}
Rotas que passam aqui: ${stop.routes}`;
  sms(phoneNumber, details);
  return `END ${cutText(details, USSD_MAX)}`;
}

// ─── 4. FARE ──────────────────────────────────────────────────────────────────

async function fareMenu(phoneNumber: string, inputs: string[], pages: number[], currPg: number) {
  const locations = await getAvailableLocations();
  if (inputs.length === 1) {
    if (locations.length === 0) return 'END Nenhuma localizacao disponivel de momento.';
    return paginateList('Calcular tarifa - origem:', locations, currPg);
  }

  const origin = pickFromList(locations, pages[1], inputs[1]);
  if (!origin) return INVALID;
  const destinations = await getAvailableDestinations(origin);
  if (inputs.length === 2) {
    if (destinations.length === 0) return `END Nenhum destino disponivel de ${origin}.`;
    return paginateList(`De: ${origin}\nPara onde?`, destinations, currPg);
  }

  const destination = pickFromList(destinations, pages[2], inputs[2]);
  if (!destination) return INVALID;
  const fareInfo = await calculateFare(origin, destination);
  if (!fareInfo) return 'END Erro ao calcular tarifa. Tente novamente.';

  const details = `TARIFA
De: ${origin}
Para: ${destination}
Distancia: ${fareInfo.distance} km
Tarifa: ${fareInfo.fare} MT
Tempo: ${fareInfo.duration}
Rotas disponiveis: ${fareInfo.routeCount}`;
  sms(phoneNumber, details);
  return `END ${details}`;
}

// ─── 5. TRACK A BUS ───────────────────────────────────────────────────────────

async function trackBusMenu(phoneNumber: string, inputs: string[]) {
  if (inputs.length === 1) {
    return `CON Digite a matricula do autocarro
(ex: ACK ou 184M):`;
  }

  const matricula = inputs[1].trim().toUpperCase();
  if (matricula.length < 3) return 'END Insira pelo menos 3 caracteres da matricula.';

  const matches = await prisma.transporte.findMany({
    where: { matricula: { contains: matricula, mode: 'insensitive' } },
    select: {
      ...POSITION_FIELDS,
      matricula: true,
      marca: true,
      modelo: true,
      via: {
        select: {
          nome: true,
          geoLocationPath: true,
          paragens: { select: { paragem: { select: { nome: true, geoLocation: true } } } },
        },
      },
    },
    orderBy: { matricula: 'asc' },
    take: PAGE_SIZE + 1,
  });
  if (matches.length === 0) return `END Nenhum autocarro encontrado com a matricula "${matricula}".`;

  // Typed input is not a navigation key here, so offer one page and ask for more digits beyond that
  if (matches.length > 1 && inputs.length === 2) {
    const items = matches.slice(0, PAGE_SIZE).map((m, i) => `${i + 1}. ${m.matricula}`).join('\n');
    const more = matches.length > PAGE_SIZE ? '\nMais resultados: use mais digitos.' : '';
    return `CON Escolha o autocarro:\n${items}${more}`;
  }
  const transport = matches.length === 1 ? matches[0] : pickFromList(matches.slice(0, PAGE_SIZE), 0, inputs[2]);
  if (!transport) return INVALID;

  const position = vehiclePosition(transport, transport.via?.geoLocationPath, new Date(), await getFareRule());
  const near = position && nearestStopName(position.point.join(','), transport.via?.paragens.map((vp) => vp.paragem) ?? []);
  const details = `AUTOCARRO ${transport.matricula}
${transport.marca || ''} ${transport.modelo || ''}
Rota: ${transport.via?.nome || 'Sem rota atribuida'}
${near ? `Perto de: ${near}` : position ? 'Em circulacao' : 'Localizacao indisponivel'}`;
  sms(phoneNumber, details);
  return `END ${details}`;
}

// NEW: Get available locations from database (terminals and major stops)
async function getAvailableLocations(): Promise<string[]> {
  try {
    // Get unique terminal names from routes
    const routes = await prisma.via.findMany({
      where: {
        transportes: {
          some: {}
        }
      },
      select: {
        terminalPartida: true,
        terminalChegada: true,
      },
      distinct: ['terminalPartida'],
    });

    const locations = new Set<string>();
    
    routes.forEach(route => {
      if (route.terminalPartida) locations.add(route.terminalPartida);
    });

    return Array.from(locations).sort();
  } catch (error) {
    console.error('Error getting available locations:', error);
    return [];
  }
}

// NEW: Get available origins from database
async function getAvailableOrigins(): Promise<string[]> {
  try {
    const routes = await prisma.via.findMany({
      where: {
        transportes: {
          some: {}
        }
      },
      select: {
        terminalPartida: true,
      },
      distinct: ['terminalPartida'],
      orderBy: {
        terminalPartida: 'asc',
      },
    });

    return routes
      .map(r => r.terminalPartida)
      .filter(t => t && t.trim().length > 0);
  } catch (error) {
    console.error('Error getting available origins:', error);
    return [];
  }
}

// NEW: Get available destinations from a given origin
async function getAvailableDestinations(origin: string): Promise<string[]> {
  try {
    const routes = await prisma.via.findMany({
      where: {
        AND: [
          {
            OR: [
              { terminalPartida: { contains: origin } },
              { nome: { contains: origin } }
            ]
          },
          {
            transportes: { some: {} }
          }
        ]
      },
      select: {
        terminalChegada: true,
      },
      distinct: ['terminalChegada'],
      orderBy: {
        terminalChegada: 'asc',
      },
    });

    return routes
      .map(r => r.terminalChegada)
      .filter(t => t && t.trim().length > 0 && t !== origin);
  } catch (error) {
    console.error('Error getting available destinations:', error);
    return [];
  }
}

/** Routes with buses that start at `origin`, with their stops in travel order. */
async function getRoutesFrom(origin: string) {
  const vias = await prisma.via.findMany({
    where: { terminalPartida: origin, transportes: { some: {} } },
    select: {
      nome: true,
      terminalPartida: true,
      terminalChegada: true,
      geoLocationPath: true,
      paragens: { select: { paragem: { select: { geoLocation: true } } } },
      _count: { select: { transportes: true } },
    },
    orderBy: { terminalChegada: 'asc' },
  });

  return vias.map((via) => ({
    nome: via.nome,
    terminalPartida: via.terminalPartida,
    terminalChegada: via.terminalChegada,
    buses: via._count.transportes,
    stops: orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation)
      .map((vp) => parseLatLng(vp.paragem.geoLocation))
      .filter((pt): pt is LatLng => pt !== null),
  }));
}

/** Stops of the route from `origin` to `destination` in travel order; repeated names next to each other are merged. */
async function getRouteStopNames(origin: string, destination: string) {
  const via = await prisma.via.findFirst({
    where: {
      OR: [{ terminalPartida: { contains: origin } }, { nome: { contains: origin } }],
      terminalChegada: destination,
      transportes: { some: {} },
    },
    select: {
      geoLocationPath: true,
      paragens: {
        select: {
          paragem: {
            select: {
              nome: true,
              geoLocation: true,
              vias: { take: 4, select: { via: { select: { nome: true } } } },
            },
          },
        },
      },
    },
  });
  if (!via) return [];

  const stops: { nome: string; position: number; routes: string }[] = [];
  for (const vp of orderStopsAlongRoute(via.paragens, via.geoLocationPath, (v) => v.paragem.geoLocation)) {
    // Consecutive stops on the same street share a name
    if (stops.length > 0 && stops[stops.length - 1].nome === vp.paragem.nome) continue;
    stops.push({
      nome: vp.paragem.nome,
      position: stops.length + 1,
      routes: vp.paragem.vias.map((v) => v.via.nome).join(', '),
    });
  }
  return stops;
}

// NEW: Find nearest stop based on location name
async function findNearestStop(locationName: string) {
  try {
    const stop = await prisma.paragem.findFirst({
      where: {
        nome: { contains: locationName }
      }
    });

    if (!stop) return null;

    return {
      id: stop.id,
      name: stop.nome || 'Paragem',
      location: stop.geoLocation || '0,0'
    };
  } catch (error) {
    console.error('Error finding nearest stop:', error);
    return null;
  }
}

// NEW: Find transport info (routes, ETA, fare) - SIMPLIFIED for USSD performance
const sameName = (a: string | null | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The bus that reaches `from` soonest on a route from `from` to `to`, with the same
 * estimate as the web app. Origin and destination are the route's stops with those
 * names, or its first and last stops when the terminal is not a stop name.
 */
async function findTransportInfo(from: string, to: string) {
  try {
    const rule = await getFareRule();

    const transports = await prisma.transporte.findMany({
      where: {
        via: {
          AND: [
            { OR: [{ terminalPartida: { contains: from } }, { nome: { contains: from } }] },
            { terminalChegada: { contains: to } }
          ]
        }
      },
      select: {
        ...POSITION_FIELDS,
        matricula: true,
        marca: true,
        modelo: true,
        via: {
          select: {
            geoLocationPath: true,
            paragens: {
              orderBy: { id: 'asc' },
              select: { paragemId: true, paragem: { select: { nome: true, geoLocation: true } } }
            }
          }
        },
      },
    });

    let best: {
      transport: (typeof transports)[number];
      trip: NonNullable<ReturnType<typeof estimateBusTrip>>;
      origem: { id: string; nome: string; geoLocation: string };
      destino: { nome: string };
    } | null = null;

    for (const transport of transports) {
      if (!transport.via) continue;
      const route = orderStopsAlongRoute(transport.via.paragens, transport.via.geoLocationPath, (vp) => vp.paragem.geoLocation)
        .filter((vp) => parseLatLng(vp.paragem.geoLocation) !== null);
      if (route.length < 2) continue;

      // Stops named like the chosen places; otherwise the terminal at the other end. The path
      // can run either way, and buses serve both directions.
      const last = route.length - 1;
      let o = route.findIndex((vp) => sameName(vp.paragem.nome, from));
      let d = route.findLastIndex((vp) => sameName(vp.paragem.nome, to));
      if (o === -1 && d === -1) [o, d] = [0, last];
      else if (o === -1) o = d < last / 2 ? last : 0;
      else if (d === -1) d = o < last / 2 ? last : 0;
      if (o === d) continue;

      const stops = route.map((vp) => ({ id: vp.paragemId, point: parseLatLng(vp.paragem.geoLocation)! }));
      // Real GPS when fresh, otherwise the timetable position
      const trip = estimateBusTrip({
        vehicle: transport,
        path: transport.via.geoLocationPath,
        stops,
        origemId: stops[o].id,
        destinoId: stops[d].id,
        rule,
      });
      if (trip && (!best || trip.tempoChegada < best.trip.tempoChegada)) {
        best = {
          transport,
          trip,
          origem: { id: route[o].paragemId, nome: route[o].paragem.nome, geoLocation: route[o].paragem.geoLocation },
          destino: { nome: route[d].paragem.nome },
        };
      }
    }

    if (!best) return null;
    const { transport, trip, origem, destino } = best;

    // In Maputo time: the server runs in UTC
    const arrivalTimeStr = maputoClock(new Date(Date.now() + (trip.tempoChegada + trip.tempoViagem) * 60000));

    return {
      busId: `${transport.marca || 'N/A'} ${transport.modelo || 'N/A'} - ${transport.matricula || 'N/A'}`,
      timeUntilBusArrives: trip.tempoChegada,
      travelTime: trip.tempoViagem,
      arrivalTime: arrivalTimeStr,
      origem,
      from: origem.nome || 'Origem',
      to: destino.nome || 'Destino',
      distance: (trip.distanciaViagem / 1000).toFixed(1),
      fare: trip.fare
    };
  } catch (error) {
    console.error('Error finding transport info:', error);
    return null;
  }
}


// Calculate fare between two terminals with the shared fare rule (same formula as the web app)
async function calculateFare(origin: string, destination: string) {
  try {
    const rule = await getFareRule();

    // Same route match as getAvailableDestinations()
    const vias = await prisma.via.findMany({
      where: {
        OR: [{ terminalPartida: { contains: origin } }, { nome: { contains: origin } }],
        terminalChegada: destination,
        transportes: { some: {} },
      },
      select: {
        geoLocationPath: true,
        paragens: {
          orderBy: { id: 'asc' },
          select: { paragem: { select: { geoLocation: true } } }
        }
      }
    });

    // Prefer the real route: distance along its stops, terminal to terminal (shortest if several)
    let distanceMeters: number | null = null;
    for (const via of vias) {
      const points = orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation)
        .map((vp) => parseLatLng(vp.paragem.geoLocation))
        .filter((pt): pt is LatLng => pt !== null);
      if (points.length > 1) {
        const meters = pathLengthMeters(points);
        distanceMeters = distanceMeters === null ? meters : Math.min(distanceMeters, meters);
      }
    }

    // Otherwise estimate from the two places' coordinates
    if (distanceMeters === null) {
      const [from, to] = await Promise.all([findPlaceCoords(origin), findPlaceCoords(destination)]);
      if (from && to) distanceMeters = estimatedRoadMeters(from, to, rule);
    }

    if (distanceMeters === null) return null;

    return {
      distance: (distanceMeters / 1000).toFixed(1),
      fare: fareFor(distanceMeters, rule).toString(),
      duration: `${travelMinutes(distanceMeters, rule)} min`,
      routeCount: vias.length
    };
  } catch (error) {
    console.error('Error calculating fare:', error);
    return null;
  }
}

// Coordinates of the stop named `name` (exact match first, then partial)
async function findPlaceCoords(name: string): Promise<LatLng | null> {
  const stop =
    (await prisma.paragem.findFirst({
      where: { nome: { equals: name, mode: 'insensitive' } },
      select: { geoLocation: true }
    })) ??
    (await prisma.paragem.findFirst({
      where: { nome: { contains: name, mode: 'insensitive' } },
      select: { geoLocation: true }
    }));
  return parseLatLng(stop?.geoLocation);
}

/** Arrival alert: the simulator texts the passenger when a bus nears `stop`. */
async function createMissionForUser(phoneNumber: string, stop: { id: string; geoLocation: string }) {
  let user = await prisma.utente.findFirst({
    where: { telefone: phoneNumber }
  });

  if (!user) {
    user = await prisma.utente.create({
      data: {
        nome: `User ${phoneNumber.slice(-4)}`,
        telefone: phoneNumber,
        email: `${phoneNumber}@temp.com`,
        senha: 'temp', // Will be updated when user registers
        mISSION: `USSD-${phoneNumber}-${Date.now()}`, // Unique mission identifier
      }
    });
  }

  // Reuse today's mission for this stop instead of adding one per lookup
  const existing = await prisma.mISSION.findFirst({
    where: { utenteId: user.id, paragemId: stop.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (existing) return existing;

  return prisma.mISSION.create({
    data: {
      mISSIONUtente: `USSD-${Date.now()}`,
      codigoParagem: stop.id,
      geoLocationUtente: stop.geoLocation,
      geoLocationParagem: stop.geoLocation,
      utenteId: user.id,
      paragemId: stop.id,
    }
  });
}

// ─── STATELESS DRIVER SYSTEM ──────────────────────────────────────────────────

async function handleDriverMenuStateless(sessionId: string, phoneNumber: string, inputs: string[]): Promise<string> {
  // Check if driver exists with this phone number
  const driver = await findDriverByPhone(phoneNumber);

  if (!driver) {
    const msg = `Ola! O numero ${phoneNumber} nao esta registado como motorista. Contacte o administrador para se registrar.`;
    sms(phoneNumber, msg);
    return `END Desculpe, o seu numero nao esta registado como motorista no sistema.`;
  }

  const level = inputs.length; // e.g. ['6'] -> level 1, ['6', 'password'] -> level 2, etc.

  // Level 1: Ask for password
  if (level === 1) {
    return `CON Area do Motorista
PIN:`;
  }

  // From Level 2 onwards, we have the password in inputs[1]
  const password = inputs[1] || '';

  if (!driver.password) {
    return `END Ainda nao tem PIN. Peca ao administrador para gerar o seu PIN.`;
  }
  if (!(await verifyDriverPin(driver.password, password))) {
    return `END PIN incorreto. Por favor, disque novamente para tentar de novo.`;
  }

  // Load complete driver info with relations for menus
  const driverInfo = await prisma.motorista.findUnique({
    where: { id: driver.id },
    include: {
      transporte: {
        include: {
          via: {
            include: {
              paragens: {
                include: { paragem: true },
                orderBy: { id: 'asc' }
              }
            }
          }
        }
      }
    }
  });

  const t = driverInfo?.transporte;
  const v = t?.via;
  const statusLabel = driverInfo?.emViagem ? 'ONLINE' : 'OFFLINE';

  // Level 2: Show driver main menu
  if (level === 2) {
    const actionLabel = statusLabel === 'ONLINE' ? '1. Encerrar Viagem' : '1. Iniciar Viagem';

    let dashboard = `CON BEM-VINDO, ${driver.nome.toUpperCase().split(' ')[0]}

STATUS: ${statusLabel}
`;

    if (t) {
      dashboard += `MATRICULA: ${t.matricula}
`;
    }
    if (v) {
      dashboard += `ROTA: ${cutText(v.nome, 30)}
`;
    }

    dashboard += `
${actionLabel}
2. Ver Minha Info
3. Ver Rota
4. Ver Autocarro
0. Sair`;

    return dashboard;
  }

  // Level 3: Process submenu selection
  if (level === 3) {
    const subChoice = inputs[2];

    if (subChoice === '0') {
      return `END Sessao encerrada. Obrigado por usar o sistema!`;
    }

    switch (subChoice) {
      case '1': {
        // Start / End ride confirmation screen
        if (statusLabel === 'OFFLINE') {
          return `CON INICIAR VIAGEM

Veiculo: ${t?.matricula || 'N/A'}
Rota: ${v?.terminalPartida || 'N/A'} -> ${v?.terminalChegada || 'N/A'}

1. Confirmar - Iniciar Viagem
0. Cancelar`;
        } else {
          return `CON ENCERRAR VIAGEM

Veiculo: ${t?.matricula || 'N/A'}
Rota: ${v?.terminalPartida || 'N/A'} -> ${v?.terminalChegada || 'N/A'}

1. Confirmar - Encerrar Viagem
0. Cancelar`;
        }
      }

      case '2': {
        // Driver Info
        const info = `${driverInfo?.nome || 'N/A'}
BI: ${driverInfo?.bi || 'N/A'}
Carta: ${driverInfo?.categoriaCarta || 'N/A'} (${driverInfo?.experienciaAnos || 0} anos)
Viagem: ${statusLabel}
Autocarro: ${t?.matricula || 'N/A'}
Rota: ${v?.nome || 'N/A'}`;
        sms(phoneNumber, `SUA INFORMACAO:\n${info}\nTelefone: ${driverInfo?.telefone || 'N/A'}`);
        return `END ${cutText(info, USSD_MAX - 22)}
Detalhes enviados por SMS.`;
      }

      case '3': {
        // Route Info: stops in travel order, repeated street names merged
        const names: string[] = [];
        for (const vp of v ? orderStopsAlongRoute(v.paragens, v.geoLocationPath, (x) => x.paragem.geoLocation) : []) {
          if (names[names.length - 1] !== vp.paragem.nome) names.push(vp.paragem.nome);
        }
        sms(phoneNumber, `ROTA ${v?.nome || 'N/A'}: ${names.join(' > ') || 'sem paragens'}`);
        return `END ${cutText(`Rota: ${v?.nome || 'N/A'}
${v?.terminalPartida || 'N/A'} -> ${v?.terminalChegada || 'N/A'}
Paragens: ${v?.paragens?.length || 0}
${names.slice(0, 4).join(' > ')}${names.length > 4 ? ' > ...' : ''}`, USSD_MAX - 30)}
Lista completa enviada por SMS.`;
      }

      case '4': {
        // Autocarro Info
        const position = t ? vehiclePosition(t, v?.geoLocationPath, new Date(), await getFareRule()) : null;
        const geo = position ? `${position.point[0].toFixed(5)},${position.point[1].toFixed(5)}` : null;
        const near = nearestStopName(geo, v?.paragens.map((vp) => vp.paragem) ?? []);
        const tInfo = `Matricula: ${t?.matricula || 'N/A'}
${t?.marca || ''} ${t?.modelo || ''}
Cor: ${colorName(t?.cor)}
Lotacao: ${t?.lotacao || 'N/A'}
Perto de: ${near || 'N/A'}`;

        sms(phoneNumber, `AUTOCARRO
${tInfo}
${position?.source === 'gps' ? 'GPS' : 'Posicao estimada'}: ${geo || 'N/A'}`);
        return `END ${cutText(tInfo, USSD_MAX - 26)}
Detalhes enviados por SMS.`;
      }

      default:
        return `END Opcao invalida.`;
    }
  }

  // Level 4: Confirm Start/End ride
  if (level === 4) {
    const subChoice = inputs[2];
    const confirmChoice = inputs[3];

    if (subChoice === '1') {
      if (confirmChoice === '1') {
        const newStatus = driverInfo?.emViagem ? 'OFFLINE' : 'ONLINE';

        try {
          if (newStatus === 'ONLINE') await startTrip(driver.id);
          else await endTrip(driver.id);

          if (newStatus === 'ONLINE') {
            const msg = `Viagem iniciada com sucesso! Veiculo: ${t?.matricula || 'N/A'}. Bons trabalhos!`;
            sms(phoneNumber, msg);
            return `END VIAGEM INICIADA

STATUS: ONLINE

Boa viagem, ${driver.nome.split(' ')[0]}!
Veiculo: ${t?.matricula || 'N/A'}
Rota: ${v?.terminalPartida || 'N/A'} -> ${v?.terminalChegada || 'N/A'}

Bom trabalho!`;
          } else {
            const msg = `Viagem encerrada com sucesso. Obrigado pelo trabalho de hoje!`;
            sms(phoneNumber, msg);
            return `END VIAGEM ENCERRADA

STATUS: OFFLINE

Ate logo, ${driver.nome.split(' ')[0]}!
Obrigado pelo trabalho de hoje.
Veiculo: ${t?.matricula || 'N/A'}

Ate proxima viagem!`;
          }
        } catch (error) {
          console.error('Error updating driver trip:', error);
          return `END Erro ao atualizar status da viagem. Tente novamente.`;
        }
      }
      return `END Operacao cancelada.`;
    }
  }

  return `END Obrigado por usar o Sistema de Transportes!`;
}
