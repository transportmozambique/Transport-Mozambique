import { prisma } from './prisma';
import { getFareRule } from './fares';
import { GPS_FRESH_MS } from './vehiclePosition';
import { firstBus, loadNetwork, vehiclesOn } from './journeys';
import { checkJourneyAlerts } from './journeyAlerts';

/**
 * As posições dos autocarros já não são escritas por um ciclo: lib/vehiclePosition.ts calcula a
 * posição de cada autocarro no momento da leitura (GPS real recente, senão a viagem em curso do
 * motorista). Porquê: num servidor serverless (Vercel) não há processo sempre ligado para correr
 * um ciclo, e escrever currGeoLocation apagaria a posição GPS real dos veículos.
 *
 * O que fica aqui é a verificação de chegadas, que envia os SMS:
 * - os avisos das viagens acompanhadas (lib/journeyAlerts.ts): 15, 10 e 5 min, chegada,
 *   transbordos e destino;
 * - os alertas de paragem da web (um MISSION): um SMS quando o próximo autocarro em viagem de uma
 *   rota que passa na paragem está a 5 min ou menos.
 * Corre a cada visita (no máximo a cada 30 s por instância), por um pedido agendado externo a cada
 * minuto (docs/africas-talking.md) e, como reserva, pelo GitHub Actions (.github/workflows/arrival-check.yml).
 */

// Tempo mínimo entre dois SMS de chegada para o mesmo alerta de paragem (não repetir a cada verificação)
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000;
/** Um alerta de paragem avisa quando o próximo autocarro chega em até isto */
const STOP_ALERT_MIN = 5;
// Tempo mínimo entre duas verificações na mesma instância do servidor (as visitas também as disparam)
const CHECK_INTERVAL_MS = 30 * 1000;

let lastCheck = 0;
let lastResult: { checkedAt: string; missions: number; notified: number; journeys: number } | null = null;

/** Os SMS dos alertas de paragem pendentes. Devolve quantos foram enviados. */
async function checkStopAlerts(now: Date): Promise<{ missions: number; notified: number }> {
  // Alertas das últimas 24 horas que não foram avisados há pouco
  const missions = await prisma.mISSION.findMany({
    where: {
      createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      OR: [{ notificadoEm: null }, { notificadoEm: { lt: new Date(now.getTime() - NOTIFY_COOLDOWN_MS) } }],
    },
    include: { utente: true, paragem: true },
  });
  if (missions.length === 0) return { missions: 0, notified: 0 };

  const [net, rule] = await Promise.all([loadNetwork(), getFareRule()]);
  const routeIds = new Set(missions.flatMap((m) => net.stops.get(m.paragemId)?.routeIds ?? []));
  const vehicles = await vehiclesOn(routeIds);

  let notified = 0;
  for (const mission of missions) {
    const stop = net.stops.get(mission.paragemId);
    if (!stop) continue;
    // O próximo autocarro em viagem que pára aqui, em qualquer rota e sentido
    let soonest: { matricula: string; codigo: string; minutos: number } | null = null;
    for (const routeId of stop.routeIds) {
      const route = net.routes.get(routeId);
      if (!route) continue;
      const i = route.stops.findIndex((s) => s.id === stop.id);
      for (const to of [route.stops[i + 1], route.stops[i - 1]]) {
        if (!to) continue;
        const bus = firstBus(route, vehicles.get(routeId) ?? [], stop.id, to.id, rule, now);
        if (bus && (!soonest || bus.trip.tempoChegada < soonest.minutos)) {
          soonest = { matricula: bus.vehicle.matricula, codigo: route.codigo, minutos: bus.trip.tempoChegada };
        }
      }
    }
    if (!soonest || soonest.minutos > STOP_ALERT_MIN) continue;

    // Marcar primeiro, para que um SMS lento ou falhado não seja repetido a cada verificação
    const { count } = await prisma.mISSION.updateMany({
      where: { id: mission.id, notificadoEm: mission.notificadoEm },
      data: { notificadoEm: now },
    });
    if (count !== 1) continue;
    try {
      const { notifyBusArrival } = await import('./notifications');
      await notifyBusArrival(mission.utente.telefone, soonest.matricula, soonest.codigo, mission.paragem.nome, soonest.minutos);
      notified++;
    } catch (error) {
      console.error('Erro ao enviar notificação SMS:', error);
    }
  }
  return { missions: missions.length, notified };
}

/** Envia os SMS de chegada pendentes (viagens acompanhadas e alertas de paragem). Devolve quantos foram enviados. */
export async function checkAndNotifyUsers(now: Date = new Date()): Promise<number> {
  let stops = { missions: 0, notified: 0 };
  let journeys = 0;
  try {
    journeys = await checkJourneyAlerts(now);
  } catch (error) {
    console.error('Erro ao verificar as viagens acompanhadas:', error);
  }
  try {
    stops = await checkStopAlerts(now);
  } catch (error) {
    console.error('Erro ao verificar os alertas de paragem:', error);
  }
  lastResult = { checkedAt: now.toISOString(), missions: stops.missions, notified: stops.notified + journeys, journeys };
  return stops.notified + journeys;
}

/** Corre a verificação de chegadas no máximo uma vez a cada CHECK_INTERVAL_MS nesta instância. */
export async function maybeCheckArrivals(): Promise<void> {
  if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
  lastCheck = Date.now();
  await checkAndNotifyUsers();
}

/** Como as posições são produzidas, e a última verificação de chegadas desta instância. */
export async function getSimulationStatus() {
  const [busCount, inService, withFreshGps, following] = await Promise.all([
    prisma.transporte.count({ where: { via: { ativa: true } } }),
    prisma.transporte.count({ where: { via: { ativa: true }, motorista: { emViagem: true } } }),
    prisma.transporte.count({ where: { gpsAtualizadoEm: { gte: new Date(Date.now() - GPS_FRESH_MS) } } }),
    prisma.acompanhamento.count({ where: { terminadoEm: null } }),
  ]);
  return {
    mode: 'gps-or-driver-trip',
    busCount,
    inService,
    withFreshGps,
    following,
    lastArrivalCheck: lastResult,
  };
}
