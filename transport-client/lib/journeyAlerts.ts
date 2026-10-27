import { prisma } from './prisma';
import { getFareRule, type FareRule } from './fares';
import { firstBus, loadNetwork, vehiclesOn, type BusLeg, type Journey, type Network, type Vehicle } from './journeys';
import { ridingBus, trechoOf } from './follow';
import { distanceMeters, walkMinutes } from './places';
import { maputoClock } from './eta';
import { sendSMS, toGsm } from './notifications';
import { TERMINAL_STOP_S, minutesUntilPass, vehiclePosition, type Direction } from './vehiclePosition';

/**
 * Avisos por SMS ao longo de uma viagem escolhida no USSD (opção 1 → "Acompanhar por SMS") ou na
 * web: um acompanhamento (tabela Acompanhamento) guarda os autocarros da viagem, a etapa em que o
 * passageiro está, e o último aviso enviado. A verificação de chegadas (lib/busSimulator.ts, a
 * cada minuto) chama checkJourneyAlerts(), que olha para os autocarros agora e envia o aviso
 * seguinte de cada etapa, até ao destino:
 *
 *   à espera      o autocarro chega em 15, 10 e 5 min; o autocarro está a chegar (e o próximo,
 *                 se o perder); nenhum autocarro em serviço; o autocarro deixou de circular
 *   a bordo       chega à paragem de saída em 15, 10 e 5 min
 *   na saída      saia aqui e apanhe o autocarro seguinte, que chega em N min (e volta ao "à
 *                 espera" da etapa seguinte); ou chegou ao destino, e o acompanhamento acaba
 *
 * Cada aviso sai uma vez. Os números dos avisos (AVISO) crescem ao longo de uma etapa e o último
 * enviado fica em Acompanhamento.aviso; quando uma verificação salta vários (a verificação
 * atrasou-se), só sai o mais recente, com os minutos de agora. Porquê guardar o último e não
 * calcular tudo de novo: o servidor não guarda memória entre pedidos (serverless), e o mesmo
 * aviso não pode sair duas vezes quando duas verificações correm ao mesmo tempo (ver claim()).
 *
 * Que o passageiro entrou no autocarro não se sabe ao certo: conta-se a partir do momento em que o
 * autocarro anunciado passa a paragem de embarque. O aviso "está a chegar" diz quando chega o
 * próximo, para quem o perdeu.
 */

/** Os autocarros de uma viagem, pela ordem: a via, o autocarro escolhido, onde se entra e onde se sai */
export interface AlertLeg {
  viaId: string;
  busId: string;
  from: string;
  to: string;
}

/** O último aviso enviado numa etapa; crescem ao longo dela */
export const AVISO = {
  NENHUM: 0,
  SEM_AUTOCARRO: 5, // nenhum autocarro da rota em viagem
  LONGE: 7, // um autocarro em viagem, a mais de 15 min
  ESPERA_15: 10,
  ESPERA_10: 20,
  ESPERA_5: 30,
  A_CHEGAR: 40, // o autocarro chega à paragem de embarque: entrar
  A_BORDO: 50, // no autocarro, a mais de 15 min da saída
  BORDO_15: 60,
  BORDO_10: 70,
  BORDO_5: 80,
  SAIDA: 90, // chegou à paragem de saída
} as const;

/** Um acompanhamento acaba sozinho ao fim deste tempo (uma viagem esquecida não manda SMS para sempre) */
const MAX_FOLLOW_MS = 4 * 60 * 60 * 1000;
/** Mais perto do que isto da paragem, o autocarro está a chegar */
const AT_STOP_M = 150;
/** Mais longe do que isto da paragem de embarque, no sentido da viagem, o autocarro já saiu dela */
const LEFT_STOP_M = 30;

/** O aviso de espera para um autocarro a `minutes` minutos e `meters` metros da paragem */
export function waitLevel(minutes: number, meters = Infinity): number {
  if (minutes <= 1 || meters <= AT_STOP_M) return AVISO.A_CHEGAR;
  if (minutes <= 5) return AVISO.ESPERA_5;
  if (minutes <= 10) return AVISO.ESPERA_10;
  if (minutes <= 15) return AVISO.ESPERA_15;
  return AVISO.LONGE;
}

/** O aviso a bordo, a `minutes` minutos da paragem de saída */
export function rideLevel(minutes: number): number {
  if (minutes <= 1) return AVISO.SAIDA;
  if (minutes <= 5) return AVISO.BORDO_5;
  if (minutes <= 10) return AVISO.BORDO_10;
  if (minutes <= 15) return AVISO.BORDO_15;
  return AVISO.A_BORDO;
}

const min = (m: number) => `${m} min`;
const busName = (v: { matricula: string }, codigo: string) => `autocarro ${v.matricula} (rota ${codigo})`;
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// ─── Começar ──────────────────────────────────────────────────────────────────

/** "16:34", ou "amanha 06:32" no dia seguinte (hora de Maputo). */
export function dayClock(iso: string, now = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString('pt-PT', { timeZone: 'Africa/Maputo' });
  const at = new Date(iso);
  return `${day(at) === day(now) ? '' : 'amanha '}${maputoClock(at)}`;
}

/** A viagem inteira num SMS: caminhadas, cada autocarro com a rota e a matrícula, horas e tarifas. */
export function journeyText(j: Journey, from: string, to: string): string {
  const steps = j.etapas.map((e, i) =>
    e.tipo === 'pe'
      ? `${i + 1}) Caminhe ${e.metros} m ate ${e.para.nome}.`
      : `${i + 1}) Apanhe a rota ${e.via.codigo} (${e.transporte.matricula}) em ${e.de.nome} as ${dayClock(e.embarque)}; saia em ${e.para.nome} as ${dayClock(e.chegada)} (${e.tarifa} MT).`,
  );
  return `Viagem ${from} > ${to}: chega ${dayClock(j.chegada)}, ${j.tarifa} MT. ${steps.join(' ')}`;
}

/**
 * Começa a acompanhar `journey` para `telefone`: envia a viagem por SMS e guarda o acompanhamento
 * para a verificação de chegadas enviar os avisos. Um acompanhamento anterior do mesmo telefone
 * acaba (um passageiro faz uma viagem de cada vez).
 */
export async function startFollow(args: { telefone: string; journey: Journey; from: string; to: string; utenteId?: string | null; now?: Date }) {
  const { telefone, journey, from, to } = args;
  const now = args.now ?? new Date();
  const buses = journey.etapas.filter((e): e is BusLeg => e.tipo === 'autocarro');
  if (!buses.length) return null;
  const last = journey.etapas[journey.etapas.length - 1];
  const legs: AlertLeg[] = buses.map((b) => ({ viaId: b.via.id, busId: b.transporte.id, from: b.de.id, to: b.para.id }));
  // O primeiro aviso a seguir ao SMS da viagem é o seguinte ao que a viagem já diz (sem repetir "chega em 12 min")
  const untilFirst = Math.max(0, Math.round((Date.parse(buses[0].embarque) - now.getTime()) / 60000));

  await prisma.acompanhamento.updateMany({ where: { telefone, terminadoEm: null }, data: { terminadoEm: now } });
  const follow = await prisma.acompanhamento.create({
    data: {
      telefone,
      utenteId: args.utenteId ?? null,
      etapas: legs as unknown as object,
      destinoId: last.tipo === 'pe' && last.para.id ? last.para.id : null,
      destinoNome: to,
      // "Está a chegar, entre" sai sempre, mesmo quando o autocarro já está quase na paragem
      aviso: Math.min(waitLevel(untilFirst), AVISO.ESPERA_5),
      transporteId: buses[0].transporte.id,
    },
  });
  await sendSMS(telefone, toGsm(`${journeyText(journey, from, to)} Vamos avisar por SMS: autocarro a 15, 10 e 5 min, chegada, transbordos e destino.`));
  // Logo a seguir, o primeiro aviso, quando já é altura (o autocarro está a chegar à paragem)
  await checkJourneyAlerts(now, follow.id);
  return follow;
}

// ─── Verificar ────────────────────────────────────────────────────────────────

type Follow = Awaited<ReturnType<typeof prisma.acompanhamento.findMany>>[number];

/** O que muda num acompanhamento depois de uma verificação, e o SMS a enviar (null: nada a dizer) */
export interface Step {
  etapa: number;
  aviso: number;
  transporteId: string | null;
  terminado: boolean;
  sms: string | null;
}

interface Context {
  net: Network;
  rule: FareRule;
  vehicles: Map<string, Vehicle[]>;
  now: Date;
}

/** Minutos até o mesmo autocarro voltar à paragem no mesmo sentido: vai ao fim, volta, e vem outra vez */
function laterPassMin(lengthM: number, rule: FareRule): number {
  const v = (rule.velocidadeViagemKmh * 1000) / 3600;
  return Math.round((2 * lengthM) / v / 60 + (2 * TERMINAL_STOP_S) / 60);
}

/**
 * O passo seguinte de um acompanhamento, a partir dos autocarros agora. Não escreve nada: quem
 * chama guarda o passo e envia o SMS (checkJourneyAlerts). Exportado para os testes.
 */
export function nextStep(follow: Pick<Follow, 'etapas' | 'etapa' | 'aviso' | 'transporteId' | 'destinoId' | 'destinoNome' | 'createdAt'>, ctx: Context): Step {
  const { net, rule, vehicles, now } = ctx;
  const legs = follow.etapas as unknown as AlertLeg[];
  const same = { etapa: follow.etapa, aviso: follow.aviso, transporteId: follow.transporteId };
  const stay: Step = { ...same, terminado: false, sms: null };
  const end = (sms: string | null): Step => ({ ...same, terminado: true, sms });
  if (now.getTime() - follow.createdAt.getTime() > MAX_FOLLOW_MS || follow.etapa >= legs.length) return end(null);

  const leg = legs[follow.etapa];
  const route = net.routes.get(leg.viaId);
  const a = route?.at.get(leg.from);
  const b = route?.at.get(leg.to);
  const de = net.stops.get(leg.from);
  const para = net.stops.get(leg.to);
  if (!route || a === undefined || b === undefined || !de || !para) {
    return end(`A rota da sua viagem deixou de estar disponivel. Os avisos por SMS terminaram.`);
  }
  const travel: Direction = b > a ? 1 : -1;
  const onRoute = vehicles.get(route.id) ?? [];
  const told = onRoute.find((v) => v.id === follow.transporteId) ?? null;
  const toldAt = told ? vehiclePosition(told, route.g, now, rule) : null;

  // ── A bordo: o passageiro foi avisado para entrar, ou o autocarro anunciado já saiu da paragem
  // (um autocarro parado no terminal onde se entra ainda não levou ninguém)
  const toldTrecho = toldAt?.inService ? trechoOf(toldAt, a, b, travel, false) : null;
  const leftStop = toldAt?.progress != null && Math.abs(toldAt.progress - a) > LEFT_STOP_M;
  // Só um autocarro que vinha a caminho (a 15 min ou menos no último aviso): um que já tinha passado
  // a paragem e só volta depois de uma volta inteira também está "entre" as duas paragens
  const boardedTold = follow.aviso < AVISO.A_CHEGAR && follow.aviso >= AVISO.ESPERA_15 && toldTrecho === 'entre' && leftStop;
  // Entre duas verificações, o autocarro anunciado (a menos de 15 min) passou as duas paragens
  const rodeTold = follow.aviso < AVISO.A_CHEGAR && follow.aviso >= AVISO.ESPERA_15 && toldTrecho === 'depois';
  if (rodeTold) return arrive(follow, legs, ctx);
  if (follow.aviso >= AVISO.A_CHEGAR || boardedTold) {
    let bus = toldAt?.inService ? { vehicle: told!, position: toldAt } : null;
    // O anunciado deixou de andar: o que passou a paragem há menos tempo
    bus ??= ridingBus(route, onRoute, follow.transporteId, a, b, travel, rule, now);
    if (!bus) return stay;
    const passed = trechoOf(bus.position, a, b, travel, true) === 'depois';
    const left = passed ? 0 : minutesUntilPass(bus.position, route.g.length, b, travel, rule);
    const level = passed ? AVISO.SAIDA : Math.max(AVISO.A_BORDO, rideLevel(left));
    if (level <= follow.aviso) return stay;
    if (level === AVISO.SAIDA) return arrive(follow, legs, ctx);
    const moved = { ...same, aviso: level, transporteId: bus.vehicle.id, terminado: false };
    if (follow.aviso < AVISO.A_CHEGAR) {
      return { ...moved, sms: `Ja deve ir no ${busName(bus.vehicle, route.codigo)}. Saia em ${para.nome} daqui a ${min(left)}.` };
    }
    if (level === AVISO.A_BORDO) return { ...moved, sms: null };
    return {
      ...moved,
      sms: level === AVISO.BORDO_5
        ? `Chega a ${para.nome} em ${min(left)}. Prepare-se para sair.`
        : `Chega a ${para.nome} em ${min(left)}.`,
    };
  }

  // ── À espera: o primeiro autocarro em viagem que chega à paragem
  const first = firstBus(route, onRoute, leg.from, leg.to, rule, now);
  if (!first) {
    if (follow.aviso === AVISO.SEM_AUTOCARRO) return stay;
    const why = told && follow.aviso > AVISO.SEM_AUTOCARRO ? `O autocarro ${told.matricula} deixou de circular. ` : '';
    return { ...same, aviso: AVISO.SEM_AUTOCARRO, transporteId: null, terminado: false, sms: `${why}Nenhum autocarro da rota ${route.codigo} esta em servico agora. Avisamos quando um partir para ${de.nome}.` };
  }
  const m = first.trip.tempoChegada;
  const level = waitLevel(m, first.trip.distanciaAteOrigem);
  const bus = busName(first.vehicle, route.codigo);
  const moved = { ...same, aviso: level, transporteId: first.vehicle.id, terminado: false };

  // O autocarro anunciado parou (o motorista terminou a viagem): diz-se qual vem agora, mesmo mais tarde
  if (told && !toldAt?.inService && follow.aviso >= AVISO.LONGE) {
    return { ...moved, sms: `O autocarro ${told.matricula} deixou de circular. ${capital(bus)} chega a ${de.nome} em ${min(m)}.` };
  }
  if (level <= follow.aviso) return stay;
  if (level === AVISO.LONGE) {
    // Só depois de "nenhum autocarro em serviço": um partiu
    return { ...moved, sms: `${capital(bus)} partiu: chega a ${de.nome} em ${min(m)}.` };
  }
  if (level === AVISO.A_CHEGAR) {
    // O seguinte, para quem o perder: outro autocarro, ou este na volta seguinte
    let next = m + laterPassMin(route.g.length, rule);
    for (const v of onRoute) {
      if (v.id === first.vehicle.id) continue;
      const other = firstBus(route, [v], leg.from, leg.to, rule, now);
      if (other) next = Math.min(next, other.trip.tempoChegada);
    }
    // Até à saída, com a espera no terminal quando o autocarro está parado na paragem de embarque.
    // Entrar é o primeiro aviso a bordo: o seguinte é o da contagem até à saída
    const ride = first.trip.position ? minutesUntilPass(first.trip.position, route.g.length, b, travel, rule) : m + first.trip.tempoViagem;
    return {
      ...moved,
      aviso: Math.max(AVISO.A_CHEGAR, rideLevel(ride) === AVISO.SAIDA ? AVISO.BORDO_5 : rideLevel(ride)),
      sms: `${capital(bus)} esta a chegar a ${de.nome}. Entre e saia em ${para.nome} daqui a ${min(ride)}. Se o perder, o proximo chega em ${min(next)}.`,
    };
  }
  return { ...moved, sms: `${capital(bus)} chega a ${de.nome} em ${min(m)}.` };
}

/** Chegou à paragem de saída de uma etapa: o transbordo para a seguinte, ou o fim da viagem. */
function arrive(follow: Pick<Follow, 'etapas' | 'etapa' | 'destinoId' | 'destinoNome'>, legs: AlertLeg[], ctx: Context): Step {
  const { net, rule, vehicles, now } = ctx;
  const here = net.stops.get(legs[follow.etapa].to)!;
  const nextLeg = legs[follow.etapa + 1];

  if (!nextLeg) {
    const end = follow.destinoId ? net.stops.get(follow.destinoId) : null;
    const walk = end ? Math.round(distanceMeters(here.point, end.point)) : 0;
    const sms = walk >= 15
      ? `Saia agora em ${here.nome} e caminhe ${walk} m ate ${end!.nome}: chegou ao seu destino, ${follow.destinoNome}. Boa viagem!`
      : `Saia agora em ${here.nome}: chegou ao seu destino, ${follow.destinoNome}. Boa viagem!`;
    return { etapa: follow.etapa + 1, aviso: AVISO.SAIDA, transporteId: null, terminado: true, sms };
  }

  const route = net.routes.get(nextLeg.viaId);
  const board = net.stops.get(nextLeg.from);
  if (!route || !board) {
    return { etapa: follow.etapa + 1, aviso: AVISO.NENHUM, transporteId: null, terminado: true, sms: `Saia agora em ${here.nome}. A rota seguinte deixou de estar disponivel; os avisos terminaram.` };
  }
  const walk = Math.round(distanceMeters(here.point, board.point));
  const walkMin = walk >= 15 ? walkMinutes(walk) : 0;
  const ready = new Date(now.getTime() + walkMin * 60000);
  const bus = firstBus(route, vehicles.get(route.id) ?? [], nextLeg.from, nextLeg.to, rule, ready);
  const where = walk >= 15 ? `caminhe ${walk} m ate ${board.nome} e apanhe` : `apanhe em ${board.nome}`;
  const head = `Saia agora em ${here.nome}, ${where} a rota ${route.codigo}`;
  if (!bus) {
    return { etapa: follow.etapa + 1, aviso: AVISO.SEM_AUTOCARRO, transporteId: null, terminado: false, sms: `${head}. Nenhum autocarro dessa rota esta em servico agora; avisamos quando um partir.` };
  }
  const m = walkMin + bus.trip.tempoChegada;
  return {
    etapa: follow.etapa + 1,
    // Como no início: "está a chegar, entre" sai depois deste, mesmo para um autocarro quase na paragem
    aviso: Math.min(waitLevel(m, walkMin ? Infinity : bus.trip.distanciaAteOrigem), AVISO.ESPERA_5),
    transporteId: bus.vehicle.id,
    terminado: false,
    sms: `${head}: o autocarro ${bus.vehicle.matricula} chega em ${min(m)}.`,
  };
}

/**
 * Guarda o passo só se o acompanhamento ainda está como foi lido: quando duas verificações correm
 * ao mesmo tempo (o agendamento e uma visita à web), só uma ganha e envia o SMS.
 */
async function claim(follow: Follow, step: Step, now: Date): Promise<boolean> {
  const { count } = await prisma.acompanhamento.updateMany({
    where: { id: follow.id, etapa: follow.etapa, aviso: follow.aviso, transporteId: follow.transporteId, terminadoEm: null },
    data: { etapa: step.etapa, aviso: step.aviso, transporteId: step.transporteId, terminadoEm: step.terminado ? now : null },
  });
  return count === 1;
}

/** Envia o aviso seguinte de cada viagem acompanhada (ou só da `only`). Devolve quantos SMS foram enviados. */
export async function checkJourneyAlerts(now: Date = new Date(), only?: string): Promise<number> {
  const follows = await prisma.acompanhamento.findMany({ where: { terminadoEm: null, ...(only ? { id: only } : {}) } });
  if (!follows.length) return 0;
  const routeIds = new Set(follows.flatMap((f) => (f.etapas as unknown as AlertLeg[]).map((l) => l.viaId)));
  const [net, rule, vehicles] = await Promise.all([loadNetwork(), getFareRule(), vehiclesOn(routeIds)]);

  let sent = 0;
  for (const follow of follows) {
    try {
      const step = nextStep(follow, { net, rule, vehicles, now });
      const changed =
        step.terminado || step.etapa !== follow.etapa || step.aviso !== follow.aviso || step.transporteId !== follow.transporteId;
      if (!changed || !(await claim(follow, step, now))) continue;
      if (step.sms) {
        await sendSMS(follow.telefone, toGsm(step.sms));
        sent++;
      }
    } catch (error) {
      console.error('Erro num acompanhamento por SMS:', follow.id, error);
    }
  }
  return sent;
}
