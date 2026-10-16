import { prisma } from './prisma';
import { getFareRule, haversineMeters, parseLatLng } from './fares';
import { GPS_FRESH_MS, vehiclePosition } from './vehiclePosition';

/**
 * Bus positions are no longer written by a loop: lib/vehiclePosition.ts gives each bus's
 * position on read (fresh real GPS, otherwise the timetable). A loop could not run on
 * serverless anyway, and writing currGeoLocation would overwrite the vehicles' real GPS.
 *
 * What remains here is the arrival SMS: a passenger who asked for a bus (a MISSION) gets one
 * message when a bus on a route through their stop is less than 1 km away.
 */

// Minimum time between two arrival SMS for the same mission
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000;
// Minimum time between two checks in the same server instance (they are triggered by visits)
const CHECK_INTERVAL_MS = 30 * 1000;

let lastCheck = 0;
let lastResult: { checkedAt: string; missions: number; notified: number } | null = null;

/** Sends arrival SMS for pending missions. Returns how many were sent. */
export async function checkAndNotifyUsers(now: Date = new Date()): Promise<number> {
  let notified = 0;
  try {
    // Missions from the last 24 hours that were not notified recently
    const missions = await prisma.mISSION.findMany({
      where: {
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        OR: [
          { notificadoEm: null },
          { notificadoEm: { lt: new Date(now.getTime() - NOTIFY_COOLDOWN_MS) } },
        ],
      },
      include: { utente: true, paragem: true },
    });
    if (missions.length === 0) {
      lastResult = { checkedAt: now.toISOString(), missions: 0, notified: 0 };
      return 0;
    }

    const transportes = await prisma.transporte.findMany({
      where: { via: { paragens: { some: { paragemId: { in: missions.map((m) => m.paragemId) } } } } },
      include: { via: { select: { geoLocationPath: true, paragens: { select: { paragemId: true } } } } },
    });

    const rule = await getFareRule();
    for (const mission of missions) {
      const stop = parseLatLng(mission.geoLocationParagem);
      if (!stop) continue;

      for (const transporte of transportes) {
        if (!transporte.via?.paragens.some((vp) => vp.paragemId === mission.paragemId)) continue;
        const position = vehiclePosition(transporte, transporte.via.geoLocationPath, now, rule);
        if (!position?.moving) continue;

        const distance = haversineMeters(position.point, stop);
        if (distance >= 1000) continue;

        const tempoEstimado = Math.max(1, Math.ceil((distance / 1000 / rule.velocidadeViagemKmh) * 60));
        console.log(`🔔 Autocarro ${transporte.matricula} a ${tempoEstimado} min da ${mission.paragem.nome} (${position.source})`);

        // Mark first, so a slow or failing SMS is not retried on every check
        await prisma.mISSION.update({ where: { id: mission.id }, data: { notificadoEm: new Date() } });
        try {
          const { notifyBusArrival } = await import('./notifications');
          await notifyBusArrival(mission.utente.telefone, transporte.matricula, mission.paragem.nome, tempoEstimado);
          notified++;
        } catch (error) {
          console.error('Erro ao enviar notificação SMS:', error);
        }
        break;
      }
    }
    lastResult = { checkedAt: now.toISOString(), missions: missions.length, notified };
  } catch (error) {
    console.error('Erro ao verificar notificações:', error);
  }
  return notified;
}

/** Runs the arrival check at most once per CHECK_INTERVAL_MS in this server instance. */
export async function maybeCheckArrivals(): Promise<void> {
  if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
  lastCheck = Date.now();
  await checkAndNotifyUsers();
}

/** How positions are produced, and the last arrival check of this instance. */
export async function getSimulationStatus() {
  const [busCount, withFreshGps] = await Promise.all([
    prisma.transporte.count({ where: { viaId: { not: null } } }),
    prisma.transporte.count({ where: { gpsAtualizadoEm: { gte: new Date(Date.now() - GPS_FRESH_MS) } } }),
  ]);
  return {
    mode: 'gps-or-timetable',
    busCount,
    withFreshGps,
    lastArrivalCheck: lastResult,
  };
}
