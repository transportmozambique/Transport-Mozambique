import { prisma } from './prisma';
import { getFareRule, haversineMeters, parseLatLng } from './fares';
import { GPS_FRESH_MS, vehiclePosition } from './vehiclePosition';

/**
 * As posições dos autocarros já não são escritas por um ciclo: lib/vehiclePosition.ts calcula a
 * posição de cada autocarro no momento da leitura (GPS real recente, senão o horário). Porquê:
 * num servidor serverless (Vercel) não há processo sempre ligado para correr um ciclo, e escrever
 * currGeoLocation apagaria a posição GPS real dos veículos.
 *
 * O que fica aqui é o SMS de chegada: um passageiro que pediu um autocarro (um MISSION) recebe
 * uma mensagem quando um autocarro de uma rota que passa na sua paragem está a menos de 1 km.
 */

// Tempo mínimo entre dois SMS de chegada para o mesmo alerta (não repetir a cada verificação)
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000;
// Tempo mínimo entre duas verificações na mesma instância do servidor (as visitas também as disparam)
const CHECK_INTERVAL_MS = 30 * 1000;

let lastCheck = 0;
let lastResult: { checkedAt: string; missions: number; notified: number } | null = null;

/** Envia os SMS de chegada dos alertas pendentes. Devolve quantos foram enviados. */
export async function checkAndNotifyUsers(now: Date = new Date()): Promise<number> {
  let notified = 0;
  try {
    // Alertas das últimas 24 horas que não foram avisados há pouco
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

        // Marcar primeiro, para que um SMS lento ou falhado não seja repetido a cada verificação
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

/** Corre a verificação de chegadas no máximo uma vez a cada CHECK_INTERVAL_MS nesta instância. */
export async function maybeCheckArrivals(): Promise<void> {
  if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
  lastCheck = Date.now();
  await checkAndNotifyUsers();
}

/** Como as posições são produzidas, e a última verificação de chegadas desta instância. */
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
