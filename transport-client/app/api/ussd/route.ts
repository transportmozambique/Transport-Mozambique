import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMS, toGsm } from '@/lib/notifications';
import { getFareRule, fareFor, parseLatLng, haversineMeters, orderStopsAlongRoute } from '@/lib/fares';
import { findDriverByPhone, verifyDriverPin, startTrip, endTrip, TripError } from '@/lib/driverTrips';
import { waitUntil } from '@vercel/functions';
import { POSITION_FIELDS, vehiclePosition } from '@/lib/vehiclePosition';
import { dayClock, startFollow } from '@/lib/journeyAlerts';
import { maybeCheckArrivals } from '@/lib/busSimulator';
import {
  hasConnection, loadNetwork, placeLabel, plannedFare, planJourneys, towards,
  type BusLeg, type Journey, type Network, type NetRoute, type NetStop, type PlannedFare,
} from '@/lib/journeys';
import { normalizeName, placeName, searchPlaces, type Place } from '@/lib/places';
import { USSD_MAX, cutText, render, replay, type Answer, type Menu, type Screen } from '@/lib/ussdSteps';
import { timingSafeEqual } from 'crypto';


// Formato USSD da Africa's Talking
interface USSDRequest {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
}

/**
 * A Africa's Talking não assina os seus pedidos, e os menus confiam em `phoneNumber`: os
 * resultados são-lhe enviados por SMS e a opção 6 faz entrar um motorista por ele. Com
 * USSD_CALLBACK_KEY definida, só são respondidos os pedidos cujo URL leva ?key=<esse valor> (o
 * URL de resposta registado na Africa's Talking). Porquê uma chave no URL: é a única coisa do
 * pedido que a Africa's Talking deixa configurar, e quem não a conhece recebe 403.
 */
function callbackAllowed(request: NextRequest): boolean {
  const expected = process.env.USSD_CALLBACK_KEY;
  if (!expected) return true;
  const given = Buffer.from(request.nextUrl.searchParams.get('key') || '');
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function POST(request: NextRequest) {
  if (!callbackAllowed(request)) {
    console.warn('USSD pedido recusado: chave do callback em falta ou errada');
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    // Ler os campos do formulário enviado pela Africa's Talking
    const formData = await request.formData();
    
    const sessionId = formData.get('sessionId') as string || '';
    const serviceCode = formData.get('serviceCode') as string || '';
    const phoneNumber = formData.get('phoneNumber') as string || '';
    const text = formData.get('text') as string || '';

    // Registo para depuração; a segunda resposta da opção 6 é o PIN do motorista, que fica de fora
    const parts = text.split('*');
    if (parts[0] === '6' && parts.length > 1) parts[1] = '***';
    console.log('📱 USSD Request:', {
      sessionId,
      serviceCode,
      phoneNumber,
      text: parts.join('*'),
      timestamp: new Date().toISOString()
    });

    // Tratar o pedido USSD; cada tecla é também uma ocasião para enviar os SMS de chegada pendentes
    waitUntil(maybeCheckArrivals());
    const response = toGsm(await handleUSSD(sessionId, phoneNumber, text));

    console.log('📤 USSD Response:', response);

    // Resposta em texto simples ("CON …" ou "END …"), como a Africa's Talking pede
    return new NextResponse(response, {
      status: 200,
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('❌ Erro USSD:', error);
    return new NextResponse('END Erro ao processar pedido. Tente novamente.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}


// ─── ECRÃS ────────────────────────────────────────────────────────────────────
// Como se lê cada tecla (a repetição da sessão) está em lib/ussdSteps.ts.

/** Um ecrã END que acaba com `note` na sua própria linha; o corpo é encurtado para o ecrã caber em USSD_MAX. */
function endWithNote(body: string, note: string): string {
  return `END ${cutText(body, USSD_MAX - note.length - 1)}
${note}`;
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
1 Viagem entre 2 locais
2 Rotas de um local
3 Paragens de uma rota
4 Preco de uma viagem
5 Autocarro (matricula)
6 Motoristas
Escreva so parte do nome
7 proximo 8 anterior 0 voltar`;

// As cores dos autocarros estão guardadas em hexadecimal, vindas do selector de cor do painel
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

/** Nome da paragem mais próxima de `geo` ("lat,lng"), para dizer onde está um autocarro. */
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
    // Sem acentos (toGsm): uma letra acentuada põe o SMS inteiro em Unicode (70 caracteres por parte em vez de 160)
    waitUntil(sendSMS(phoneNumber, toGsm(text)));
  } catch (e) {
    console.error('Erro de SMS:', e);
  }
}

/** Opções 1 a 5; cada uma é repetida tecla a tecla (lib/ussdSteps.ts). A opção 6 lê as suas teclas sozinha. */
const MENUS: Record<string, (phoneNumber: string) => Menu> = {
  '1': journeyMenu,
  '2': routesMenu,
  '3': routeStopsMenu,
  '4': fareMenu,
  '5': trackBusMenu,
};

async function handleUSSD(sessionId: string, phoneNumber: string, text: string): Promise<string> {
  const keys = text === '' ? [] : text.split('*');
  if (keys.length === 0) return MAIN_MENU;
  const [choice, ...rest] = keys;

  // 0 no menu principal, ou no primeiro ecrã de uma opção, mostra o menu principal outra vez
  if (choice === '0') return handleUSSD(sessionId, phoneNumber, rest.join('*'));
  if (choice === '6') return handleDriverMenuStateless(sessionId, phoneNumber, keys);
  if (choice === '7') return rest.length ? INVALID : HELP;

  const menu = MENUS[choice];
  if (!menu) return INVALID;
  const result = await replay(menu(phoneNumber), rest);
  if ('back' in result) return handleUSSD(sessionId, phoneNumber, result.back.join('*'));
  if ('invalid' in result) return INVALID;
  try {
    await result.screen.effect?.();
  } catch (error) {
    console.error('Efeito USSD falhou:', error);
  }
  return render(result.screen, result.page);
}

// ─── PASSOS PARTILHADOS: UM LOCAL, UMA ROTA ───────────────────────────────────

// Nomes de locais e de rotas precisam de mais espaço do que outras listas: 4 por página deixam cerca de 29 caracteres a cada um
const PLACES_PER_PAGE = 4;

/** O ecrã de um passo, ou o que ele escolheu e a posição da resposta seguinte */
type Step<T> = { screen: Screen } | ({ next: number } & T);

interface PlaceAsk {
  /** A pergunta */
  ask: string;
  /** Título da lista de resultados */
  title: string;
  /** A primeira linha quando nada coincide */
  none?: (typed: string) => string;
  /** Um local que não pode ser escolhido (a origem, quando se pede o destino) */
  except?: string;
}

/**
 * Um local: o nome escrito em answers[at] (qualquer parte, com erros, ver searchPlaces) e depois
 * o seu número na lista de resultados; com um só resultado não há lista. Quando nada coincide, ou
 * a lista mostra os locais errados, escrever outra vez faz uma nova pesquisa. Porquê pesquisar e
 * não listar: Maputo tem milhares de paragens, que não cabem em menus de 6 itens.
 */
function placeStep(net: Network, answers: Answer[], at: number, q: PlaceAsk): Step<{ place: Place<NetStop> }> {
  const typed = answers[at];
  if (!typed) return { screen: { kind: 'ask', text: q.ask } };
  const found = searchPlaces(net.places, typed.text).filter((p) => p.key !== q.except);
  if (!found.length) {
    const none = q.none?.(typed.text) ?? `Nenhuma paragem com "${cutText(typed.text, 30)}".`;
    return { screen: { kind: 'ask', retype: true, text: `${none}\nEscreva outra vez so uma parte do nome (ex: Museu)` } };
  }
  if (found.length === 1) return { place: found[0], next: at + 1 };
  const chosen = answers[at + 1];
  // Cabem cerca de 29 caracteres por item com 4 itens e todas as linhas de navegação
  if (!chosen) return { screen: { kind: 'list', title: q.title, items: found.map((p) => placeLabel(net, p, 29)), size: PLACES_PER_PAGE, retype: true } };
  return { place: found[chosen.index!], next: at + 2 };
}

/** Palavras à volta de um número de rota: "rota X12", "chapa 53" */
const ROUTE_WORDS = new Set(['rota', 'chapa', 'linha', 'autocarro', 'machimbombo', 'numero', 'n', 'no', 'nr']);

const byCode = (a: NetRoute, b: NetRoute) => a.codigo.localeCompare(b.codigo, 'pt', { numeric: true });

/** Rotas cujo código, o número no autocarro, é o que foi escrito: "X12", "x 12", "rota 53-0" */
function routesWithCode(net: Network, typed: string): NetRoute[] {
  const code = normalizeName(typed).split(' ').filter((w) => w && !ROUTE_WORDS.has(w)).join('');
  if (!/\d/.test(code)) return [];
  return [...net.routes.values()].filter((r) => normalizeName(r.codigo).replace(/ /g, '') === code).sort(byCode);
}

/** Rotas que passam em qualquer paragem de um local */
function routesAt(net: Network, place: Place<NetStop>): NetRoute[] {
  const ids = new Set(place.stops.flatMap((s) => s.routeIds));
  return [...ids].map((id) => net.routes.get(id)).filter((r): r is NetRoute => !!r).sort(byCode);
}

/**
 * Uma rota: o seu código escrito em answers[at] ("X12"), ou um local escrito aí (e escolhido), e
 * depois uma das rotas que passam por ele. Listas de um só item são saltadas.
 */
function routeStep(net: Network, answers: Answer[], at: number, ask: string): Step<{ route: NetRoute }> {
  const typed = answers[at];
  if (!typed) return { screen: { kind: 'ask', text: ask } };

  let routes = routesWithCode(net, typed.text);
  let next = at + 1;
  let title = routes.length ? `Rota ${routes[0].codigo}:` : '';
  if (!routes.length) {
    const p = placeStep(net, answers, at, {
      ask,
      title: 'Qual local?',
      none: (t) => `Nenhuma rota ou paragem com "${cutText(t, 30)}".`,
    });
    if ('screen' in p) return p;
    routes = routesAt(net, p.place);
    next = p.next;
    title = `Rotas em ${cutText(p.place.nome, 30)}:`;
  }
  if (routes.length === 1) return { route: routes[0], next };
  const chosen = answers[next];
  // Logo a seguir ao texto escrito, escrever outra vez também é uma nova pesquisa
  if (!chosen) {
    return { screen: { kind: 'list', title, items: routes.map((r) => `${r.codigo} ${r.nome}`), size: PLACES_PER_PAGE, retype: next === at + 1 } };
  }
  return { route: routes[chosen.index!], next: next + 1 };
}

/** As paragens de uma rota pela ordem de viagem; paragens seguidas com o mesmo nome (os dois lados de uma rua) uma só vez */
function routeStopList(net: Network, route: NetRoute): NetStop[] {
  const stops: NetStop[] = [];
  for (const { id } of route.stops) {
    const stop = net.stops.get(id);
    if (stop && placeName(stop.nome) !== placeName(stops[stops.length - 1]?.nome ?? '')) stops.push(stop);
  }
  return stops;
}

// ─── 1. VIAGEM: DE UM LOCAL A OUTRO ───────────────────────────────────────────

/**
 * O passageiro escreve parte do nome da origem e escolhe-a nos resultados, e depois o mesmo para o
 * destino. A resposta é a melhor viagem, com transbordos quando nenhum autocarro vai directo (o
 * mesmo planeador da aplicação web, para as duas darem a mesma resposta); 2 mostra a opção
 * seguinte, 1 acompanha-a por SMS: a viagem num SMS, e depois os avisos de cada etapa até ao
 * destino (lib/journeyAlerts.ts). Só contam os autocarros cujo motorista iniciou a viagem.
 *
 *   1*<origem escrita>[*<escolha>]*<destino escrito>[*<escolha>][*2…][*1]
 */
function journeyMenu(phoneNumber: string): Menu {
  const plans = new Map<string, Promise<Journey[]>>();
  const plan = (from: Place<NetStop>, to: Place<NetStop>) => {
    const key = `${from.key}>${to.key}`;
    if (!plans.has(key)) plans.set(key, planJourneys(from.stops.map((s) => s.id), to.stops.map((s) => s.id)));
    return plans.get(key)!;
  };

  return async (answers) => {
    const net = await loadNetwork();
    const from = placeStep(net, answers, 0, { ask: 'Onde esta?\nEscreva o nome da paragem ou do local (ex: Museu)', title: 'Qual paragem?' });
    if ('screen' in from) return from.screen;
    const to = placeStep(net, answers, from.next, {
      ask: `De: ${cutText(from.place.nome, 60)}\nPara onde vai? Escreva o nome do destino`,
      title: 'Para onde vai?',
      except: from.place.key,
    });
    if ('screen' in to) return to.screen;

    const journeys = await plan(from.place, to.place);
    if (!journeys.length) {
      // Há ligação, mas nenhum autocarro dela em viagem agora (os motoristas não a iniciaram)?
      const linked = await connected(from.place, to.place);
      return {
        kind: 'end',
        text: linked
          ? `Nenhum autocarro em servico agora de ${cutText(from.place.nome, 40)} para ${cutText(to.place.nome, 40)}. Tente mais tarde.`
          : `Nao ha autocarro de ${cutText(from.place.nome, 50)} para ${cutText(to.place.nome, 50)}.`,
      };
    }

    // Depois do destino: cada 2 mostra a opção seguinte; 1 acompanha por SMS a opção mostrada
    const rest = answers.slice(to.next).map((a) => a.text);
    const shown = rest.filter((k) => k === '2').length;
    const journey = journeys[shown % journeys.length];
    if (rest[rest.length - 1] === '1') {
      return {
        kind: 'end',
        text: 'Vai receber a viagem por SMS e avisos ate chegar: autocarro a 15, 10 e 5 min, chegada, transbordos e destino.',
        effect: () => waitUntil(startFollow({ telefone: phoneNumber, journey, from: from.place.nome, to: to.place.nome })),
      };
    }
    return {
      kind: 'keys',
      text: journeyScreen(journey, journeys.length > 1),
      keys: journeys.length > 1 ? ['1', '2'] : ['1'],
    };
  };
}

/** Verdadeiro quando as rotas ligam os dois locais (há um plano), mesmo sem autocarros em viagem agora. */
async function connected(from: Place<NetStop>, to: Place<NetStop>): Promise<boolean> {
  return hasConnection(from.stops.map((s) => s.id), to.stops.map((s) => s.id));
}

/** Uma viagem num só ecrã: onde apanhar cada autocarro e onde sair, com os nomes encurtados para caber. */
function journeyScreen(j: Journey, more: boolean): string {
  const buses = j.etapas.filter((e): e is BusLeg => e.tipo === 'autocarro');
  const head = `${j.transbordos === 0 ? 'Directo' : `${j.transbordos} transbordo${j.transbordos > 1 ? 's' : ''}`}, chega ${dayClock(j.chegada)}`;
  const total = j.duracaoMin < 60 ? `${j.duracaoMin} min` : `${Math.floor(j.duracaoMin / 60)} h ${j.duracaoMin % 60} min`;
  const summary = `${total}, ${j.tarifa} MT`;
  const nav = `1. Acompanhar por SMS${more ? '\n2. Outra opcao' : ''}\n0. Voltar`;
  for (let max = 30; max >= 6; max -= 2) {
    const lines =
      buses.length === 1
        ? [`Apanhe em ${cutText(buses[0].de.nome, max)} as ${dayClock(buses[0].embarque)}`, `Saia em ${cutText(buses[0].para.nome, max)}`]
        : buses.map((b, i) => `${i + 1}) ${cutText(b.de.nome, max)} ${dayClock(b.embarque)} > ${cutText(b.para.nome, max)}`);
    const body = [head, ...lines, summary, nav].join('\n');
    if (body.length <= USSD_MAX) return body;
  }
  return `${head}\n${summary}\n${nav}`;
}

// ─── 2. ROTAS: NUM LOCAL, OU PELO NÚMERO ──────────────────────────────────────

/**
 * O resumo de uma rota: escrita pelo número ("X12"), ou escolhida entre as rotas que passam num
 * local escrito.
 *
 *   2*<local ou número da rota>[*<escolha do local>][*<escolha da rota>]
 */
function routesMenu(phoneNumber: string): Menu {
  return async (answers) => {
    const net = await loadNetwork();
    const step = routeStep(net, answers, 0, 'Rotas de um local\nEscreva o nome do local ou o numero da rota (ex: Museu ou X19)');
    if ('screen' in step) return step.screen;
    const route = step.route;
    const meters = route.stops[route.stops.length - 1].at - route.stops[0].at;
    const [rule, buses, running] = await Promise.all([
      getFareRule(),
      prisma.transporte.count({ where: { viaId: route.id } }),
      prisma.transporte.count({ where: { viaId: route.id, motorista: { emViagem: true } } }),
    ]);
    const details = `${route.codigo} ${route.nome}
De: ${route.terminals[0] || towards(net, route, -1)}
Para: ${route.terminals[1] || towards(net, route, 1)}
Paragens: ${routeStopList(net, route).length}
Distancia: ${(meters / 1000).toFixed(1)} km
Tarifa (percurso todo): ${fareFor(meters, rule)} MT
Em servico: ${running} de ${buses}`;
    return { kind: 'end', text: cutText(details, USSD_MAX), effect: () => sms(phoneNumber, details) };
  };
}

// ─── 3. PARAGENS DE UMA ROTA ──────────────────────────────────────────────────

/**
 * Uma rota (como na opção 2), as suas paragens pela ordem de viagem, e depois os detalhes de uma
 * paragem. Paragens seguidas com o mesmo nome (os dois lados de uma rua) aparecem uma só vez.
 *
 *   3*<local ou número da rota>[*<escolha do local>][*<escolha da rota>]*<escolha da paragem>
 */
function routeStopsMenu(phoneNumber: string): Menu {
  return async (answers) => {
    const net = await loadNetwork();
    const step = routeStep(net, answers, 0, 'Paragens de uma rota\nEscreva o numero da rota ou um local onde passa (ex: X19 ou Museu)');
    if ('screen' in step) return step.screen;
    const route = step.route;

    const stops = routeStopList(net, route);
    const chosen = answers[step.next];
    if (!chosen) return { kind: 'list', title: `${route.codigo}: ${stops.length} paragens`, items: stops.map((s) => s.nome) };

    const stop = stops[chosen.index!];
    const codes = [...new Set(stop.routeIds.map((id) => net.routes.get(id)?.codigo).filter(Boolean))].sort();
    const details = `${stop.nome}
Paragem ${chosen.index! + 1} de ${stops.length}
Rota: ${route.codigo} ${route.nome}
Rotas que passam aqui: ${codes.join(', ')}`;
    return { kind: 'end', text: cutText(details, USSD_MAX), effect: () => sms(phoneNumber, details) };
  };
}

// ─── 4. PREÇO ─────────────────────────────────────────────────────────────────

/**
 * A tarifa entre dois locais escritos: a da melhor viagem, contando todos os autocarros (o mesmo
 * planeador da opção 1 e da web), com os autocarros e o tempo a bordo e a pé. Porquê a da viagem
 * e não uma distância em linha recta: o passageiro paga cada autocarro que apanha. Sem autocarros
 * em viagem, a da melhor ligação pelas rotas (plannedFare): o preço não depende dos motoristas.
 *
 *   4*<origem escrita>[*<escolha>]*<destino escrito>[*<escolha>]
 */
function fareMenu(phoneNumber: string): Menu {
  const plans = new Map<string, Promise<PlannedFare | null>>();
  const fareOf = async (from: string[], to: string[]): Promise<PlannedFare | null> => {
    const [best] = await planJourneys(from, to);
    if (!best) return plannedFare(from, to);
    const buses = best.etapas.filter((e): e is BusLeg => e.tipo === 'autocarro');
    return {
      tarifa: best.tarifa,
      codigos: buses.map((b) => b.via.codigo),
      minutos: best.etapas.reduce((sum, e) => sum + (e.tipo === 'pe' ? e.minutos : e.viagemMin), 0),
      metros: buses.reduce((sum, b) => sum + b.metros, 0),
    };
  };
  return async (answers) => {
    const net = await loadNetwork();
    const from = placeStep(net, answers, 0, { ask: 'Calcular tarifa\nDe onde parte? Escreva o nome da paragem ou do local', title: 'De onde?' });
    if ('screen' in from) return from.screen;
    const to = placeStep(net, answers, from.next, {
      ask: `De: ${cutText(from.place.nome, 60)}\nPara onde vai? Escreva o nome do destino`,
      title: 'Para onde vai?',
      except: from.place.key,
    });
    if ('screen' in to) return to.screen;

    const key = `${from.place.key}>${to.place.key}`;
    if (!plans.has(key)) plans.set(key, fareOf(from.place.stops.map((s) => s.id), to.place.stops.map((s) => s.id)));
    const best = await plans.get(key)!;
    if (!best) return { kind: 'end', text: `Nao ha autocarro de ${cutText(from.place.nome, 50)} para ${cutText(to.place.nome, 50)}.` };

    const codes = best.codigos;
    const details = `TARIFA
De: ${from.place.nome}
Para: ${to.place.nome}
Preco: ${best.tarifa} MT
${codes.length === 1 ? `Directo, rota ${codes[0]}` : `${codes.length - 1} transbordo${codes.length > 2 ? 's' : ''}: rotas ${codes.join(' > ')}`}
Viagem: ${best.minutos} min, ${(best.metros / 1000).toFixed(1)} km`;
    return { kind: 'end', text: cutText(details, USSD_MAX), effect: () => sms(phoneNumber, details) };
  };
}

// ─── 5. SEGUIR UM AUTOCARRO ───────────────────────────────────────────────────

/** Só letras e algarismos: "ack 145m" e "ACK-145M" são iguais */
const plateKey = (plate: string) => plate.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Um autocarro pela matrícula, ou parte dela ("ADA", "193M"), e depois o seu estado e onde está agora (GPS, ou a viagem do motorista).
 *
 *   5*<matrícula escrita>[*<escolha>]
 */
function trackBusMenu(phoneNumber: string): Menu {
  let plates: Promise<{ id: string; matricula: string }[]> | null = null;
  return async (answers) => {
    const typed = answers[0];
    if (!typed) return { kind: 'ask', text: 'Rastrear autocarro\nEscreva a matricula ou parte dela (ex: ADA ou 193M)' };
    const wanted = plateKey(typed.text);
    if (wanted.length < 3) return { kind: 'ask', retype: true, text: 'Escreva pelo menos 3 letras ou numeros da matricula (ex: ADA)' };

    // Só os autocarros das rotas activas, como no mapa
    plates ??= prisma.transporte.findMany({ where: { via: { ativa: true } }, select: { id: true, matricula: true }, orderBy: { matricula: 'asc' } });
    const matches = (await plates).filter((t) => plateKey(t.matricula).includes(wanted)).slice(0, 30);
    if (!matches.length) {
      return { kind: 'ask', retype: true, text: `Nenhum autocarro com "${cutText(typed.text, 20)}".\nEscreva outra vez parte da matricula (ex: ADA)` };
    }
    let chosen = matches[0];
    if (matches.length > 1) {
      const pick = answers[1];
      if (!pick) return { kind: 'list', title: 'Qual autocarro?', items: matches.map((m) => m.matricula), retype: true };
      chosen = matches[pick.index!];
    }

    const transport = await prisma.transporte.findUnique({
      where: { id: chosen.id },
      select: {
        ...POSITION_FIELDS,
        matricula: true,
        marca: true,
        modelo: true,
        via: {
          select: {
            codigo: true,
            nome: true,
            geoLocationPath: true,
            paragens: { select: { paragem: { select: { nome: true, geoLocation: true } } } },
          },
        },
      },
    });
    if (!transport) return { kind: 'end', text: 'Autocarro nao encontrado.' };
    const position = vehiclePosition(transport, transport.via?.geoLocationPath, new Date(), await getFareRule());
    const near = position && nearestStopName(position.point.join(','), transport.via?.paragens.map((vp) => vp.paragem) ?? []);
    // O mesmo estado que o portal do motorista: parado até o motorista iniciar a viagem
    const state = !position ? 'Localizacao indisponivel' : !position.inService ? 'Parado, fora de servico' : position.moving ? 'Em circulacao' : 'No terminal';
    const details = `AUTOCARRO ${transport.matricula}
${transport.marca || ''} ${transport.modelo || ''}
Rota: ${transport.via ? `${transport.via.codigo} ${transport.via.nome}` : 'Sem rota atribuida'}
${state}${near ? `\n${position?.inService ? 'Perto de' : 'Em'}: ${near}` : ''}`;
    return { kind: 'end', text: cutText(details, USSD_MAX), effect: () => sms(phoneNumber, details) };
  };
}

// ─── 6. MOTORISTAS (SEM SESSÃO) ───────────────────────────────────────────────

async function handleDriverMenuStateless(sessionId: string, phoneNumber: string, inputs: string[]): Promise<string> {
  // Há um motorista com este número de telefone?
  const driver = await findDriverByPhone(phoneNumber);

  if (!driver) {
    const msg = `Ola! O numero ${phoneNumber} nao esta registado como motorista. Contacte o administrador para se registrar.`;
    sms(phoneNumber, msg);
    return `END Desculpe, o seu numero nao esta registado como motorista no sistema.`;
  }

  const level = inputs.length; // ex: ['6'] -> nível 1, ['6', 'pin'] -> nível 2, etc.

  // Nível 1: pedir o PIN
  if (level === 1) {
    return `CON Area do Motorista
PIN:`;
  }

  // A partir do nível 2 o PIN está em inputs[1]; é verificado a cada pedido, porque não há sessão
  const password = inputs[1] || '';

  if (!driver.password) {
    return `END Ainda nao tem PIN. Peca ao administrador para gerar o seu PIN.`;
  }
  if (!(await verifyDriverPin(driver.password, password))) {
    return `END PIN incorreto. Por favor, disque novamente para tentar de novo.`;
  }

  // Ler o motorista com as relações de que os menus precisam
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

  // O veículo com a viagem do motorista, para a posição ser a mesma que os passageiros vêem
  const t = driverInfo?.transporte ? { ...driverInfo.transporte, motorista: driverInfo } : null;
  const v = t?.via;
  const statusLabel = driverInfo?.emViagem ? 'ONLINE' : 'OFFLINE';

  // Nível 2: menu principal do motorista
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

  // Nível 3: tratar a escolha no submenu
  if (level === 3) {
    const subChoice = inputs[2];

    if (subChoice === '0') {
      return `END Sessao encerrada. Obrigado por usar o sistema!`;
    }

    switch (subChoice) {
      case '1': {
        // Ecrã de confirmação de iniciar / terminar viagem
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
        // Dados do motorista
        const info = `${driverInfo?.nome || 'N/A'}
BI: ${driverInfo?.bi || 'N/A'}
Carta: ${driverInfo?.categoriaCarta || 'N/A'} (${driverInfo?.experienciaAnos || 0} anos)
Viagem: ${statusLabel}
Autocarro: ${t?.matricula || 'N/A'}
Rota: ${v?.nome || 'N/A'}`;
        sms(phoneNumber, `SUA INFORMACAO:\n${info}\nTelefone: ${driverInfo?.telefone || 'N/A'}`);
        return endWithNote(info, 'Detalhes enviados por SMS.');
      }

      case '3': {
        // Dados da rota: paragens pela ordem de viagem, nomes de rua repetidos juntos
        const names: string[] = [];
        for (const vp of v ? orderStopsAlongRoute(v.paragens, v.geoLocationPath, (x) => x.paragem.geoLocation) : []) {
          if (names[names.length - 1] !== vp.paragem.nome) names.push(vp.paragem.nome);
        }
        sms(phoneNumber, `ROTA ${v?.nome || 'N/A'}: ${names.join(' > ') || 'sem paragens'}`);
        // Os nomes longos são encurtados um a um, para o número de paragens aparecer sempre
        return endWithNote(`Rota: ${cutText(v?.nome || 'N/A', 40)}
${cutText(v?.terminalPartida || 'N/A', 30)} -> ${cutText(v?.terminalChegada || 'N/A', 30)}
Paragens: ${v?.paragens?.length || 0}
${names.slice(0, 4).join(' > ')}${names.length > 4 ? ' > ...' : ''}`, 'Lista completa enviada por SMS.');
      }

      case '4': {
        // Dados do autocarro
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
        return endWithNote(tInfo, 'Detalhes enviados por SMS.');
      }

      default:
        return `END Opcao invalida.`;
    }
  }

  // Nível 4: confirmar iniciar / terminar viagem
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
          // Sem veículo, sem rota, ou rota desactivada: a viagem não começa, e o motorista sabe porquê
          if (error instanceof TripError) return `END ${error.message}`;
          console.error('Erro ao actualizar a viagem do motorista:', error);
          return `END Erro ao atualizar status da viagem. Tente novamente.`;
        }
      }
      return `END Operacao cancelada.`;
    }
  }

  return `END Obrigado por usar o Sistema de Transportes!`;
}
