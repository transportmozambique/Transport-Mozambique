import { prisma } from './prisma';

/**
 * Simulador de Movimento de Autocarros
 * Atualiza a posição dos autocarros seguindo suas rotas
 */

interface BusPosition {
  transporteId: string;
  currentIndex: number;
  routePath: [number, number][];
  direction: 'forward' | 'backward';
}

// Armazenar posição atual de cada autocarro
const busPositions = new Map<string, BusPosition>();

/**
 * Calcular distância entre dois pontos (em metros)
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Interpolar posição entre dois pontos
 */
function interpolatePosition(
  start: [number, number],
  end: [number, number],
  progress: number
): [number, number] {
  const lng = start[0] + (end[0] - start[0]) * progress;
  const lat = start[1] + (end[1] - start[1]) * progress;
  return [lng, lat];
}

/**
 * Inicializar posições dos autocarros
 */
export async function initializeBusPositions() {
  console.log('🚌 Inicializando posições dos autocarros...');

  const transportes = await prisma.transporte.findMany({
    include: {
      via: true,
    },
  });

  for (const transporte of transportes) {
    if (!transporte.via) continue;
    const { via } = transporte;

    // Parsear rota do autocarro
    let routePath: [number, number][] = [];
    
    if (transporte.routePath) {
      routePath = transporte.routePath.split(';').map((coord) => {
        const [lng, lat] = coord.split(',').map(Number);
        return [lng, lat] as [number, number];
      });
    } else if (via.geoLocationPath) {
      routePath = via.geoLocationPath.split(';').map((coord) => {
        const [lng, lat] = coord.split(',').map(Number);
        return [lng, lat] as [number, number];
      });
    }

    if (routePath.length > 0) {
      busPositions.set(transporte.id, {
        transporteId: transporte.id,
        currentIndex: 0,
        routePath,
        direction: 'forward',
      });
    }
  }

  console.log(`✅ ${busPositions.size} autocarros inicializados`);
}

/**
 * Atualizar posição de um autocarro
 */
async function updateBusPosition(busPosition: BusPosition) {
  const { transporteId, currentIndex, routePath, direction } = busPosition;

  // Fetch transport codigo for geoLocation
  const transport = await prisma.transporte.findUnique({
    where: { id: transporteId },
    select: { codigo: true }
  });
  
  if (!transport) {
    console.error(`Transport ${transporteId} not found`);
    return;
  }

  // Calcular próximo índice
  let nextIndex = currentIndex;
  if (direction === 'forward') {
    nextIndex = currentIndex + 1;
    if (nextIndex >= routePath.length) {
      // Chegou ao fim, inverter direção
      busPosition.direction = 'backward';
      nextIndex = routePath.length - 2;
    }
  } else {
    nextIndex = currentIndex - 1;
    if (nextIndex < 0) {
      // Chegou ao início, inverter direção
      busPosition.direction = 'forward';
      nextIndex = 1;
    }
  }

  busPosition.currentIndex = nextIndex;

  // Obter nova posição
  const [lng, lat] = routePath[nextIndex];
  const newPosition = `${lat},${lng}`;

  // Obter posições anteriores para histórico
  const prevIndex1 = Math.max(0, nextIndex - 1);
  const prevIndex2 = Math.max(0, nextIndex - 2);
  const prevIndex3 = Math.max(0, nextIndex - 3);

  const [lng1, lat1] = routePath[prevIndex1];
  const [lng2, lat2] = routePath[prevIndex2];
  const [lng3, lat3] = routePath[prevIndex3];

  try {
    // Remove transaction to avoid timeout issues - use individual queries
    // Atualizar posição do transporte
    await prisma.transporte.update({
      where: { id: transporteId },
      data: { currGeoLocation: newPosition },
    });

    // Atualizar ou criar GeoLocation
    const existingGeoLocation = await prisma.geoLocation.findFirst({
      where: { transporteId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingGeoLocation) {
      await prisma.geoLocation.update({
        where: { id: existingGeoLocation.id },
        data: {
          geoLocationTransporte: newPosition,
          geoDirection: direction === 'forward' ? 'Indo' : 'Voltando',
          geoLocationHist1: `${lat1},${lng1}`,
          geoLocationHist2: `${lat2},${lng2}`,
          geoLocationHist3: `${lat3},${lng3}`,
          geoDateTime1: new Date(Date.now() - 5 * 60000),
          geoDateTime2: new Date(Date.now() - 10 * 60000),
          geoDateTime3: new Date(Date.now() - 15 * 60000),
        },
      });
    } else {
      await prisma.geoLocation.create({
        data: {
          transporteId,
          codigoTransporte: (await prisma.transporte.findUnique({ where: { id: transporteId }, select: { codigo: true } }))?.codigo || 0,
          geoLocationTransporte: newPosition,
          geoDirection: direction === 'forward' ? 'Indo' : 'Voltando',
          geoLocationHist1: `${lat1},${lng1}`,
          geoLocationHist2: `${lat2},${lng2}`,
          geoLocationHist3: `${lat3},${lng3}`,
          geoDateTime1: new Date(Date.now() - 5 * 60000),
          geoDateTime2: new Date(Date.now() - 10 * 60000),
          geoDateTime3: new Date(Date.now() - 15 * 60000),
        },
      });
    }
  } catch (error) {
    console.error(`Erro ao atualizar posição do autocarro ${transporteId}:`, error);
  }
}

/**
 * Verificar e notificar usuários sobre autocarros próximos
 */
async function checkAndNotifyUsers() {
  try {
    // Buscar todas as missions ativas (criadas nas últimas 24 horas)
    const missions = await prisma.mISSION.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      include: {
        utente: true,
        paragem: true,
      },
    });

    // Buscar todos os transportes
    const transportes = await prisma.transporte.findMany({
      include: {
        via: {
          include: {
            paragens: {
              include: {
                paragem: true,
              },
            },
          },
        },
      },
    });

    // Para cada mission
    for (const mission of missions) {
      const [paragemLat, paragemLng] = mission.geoLocationParagem
        .split(',')
        .map(Number);

      // Verificar cada transporte
      for (const transporte of transportes) {
        if (!transporte.via) continue;
        // Verificar se o transporte passa por esta paragem
        const passaPorParagem = transporte.via.paragens.some(
          (vp) => vp.paragemId === mission.paragemId
        );

        if (!passaPorParagem || !transporte.currGeoLocation) continue;

        const [busLat, busLng] = transporte.currGeoLocation
          .split(',')
          .map(Number);

        // Calcular distância
        const distance = calculateDistance(busLat, busLng, paragemLat, paragemLng);

        // Se autocarro está a menos de 1km (1000 metros)
        if (distance < 1000) {
          const tempoEstimado = Math.ceil(distance / 1000 / 45 * 60); // 45 km/h média

          console.log(`🔔 Notificação: Autocarro ${transporte.matricula} está a ${tempoEstimado} min da ${mission.paragem.nome} para usuário ${mission.utente.telefone}`);

          // Enviar SMS via Africa's Talking
          try {
            const { notifyBusArrival } = await import('./notifications');
            await notifyBusArrival(
              mission.utente.telefone,
              transporte.matricula,
              mission.paragem.nome,
              tempoEstimado
            );
          } catch (error) {
            console.error('Erro ao enviar notificação SMS:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Erro ao verificar notificações:', error);
  }
}

/**
 * Loop principal - atualiza posições a cada intervalo
 */
let simulationInterval: NodeJS.Timeout | null = null;

export function startBusSimulation(intervalMs: number = 30000) {
  if (simulationInterval) {
    console.log('⚠️ Simulação já está rodando');
    return;
  }

  console.log(`🚀 Iniciando simulação de autocarros (intervalo: ${intervalMs}ms)`);

  simulationInterval = setInterval(async () => {
    console.log(`🔄 Atualizando posições de ${busPositions.size} autocarros...`);

    // Atualizar posição de cada autocarro
    const updates = Array.from(busPositions.values()).map((busPosition) =>
      updateBusPosition(busPosition)
    );

    await Promise.all(updates);

    // Verificar e notificar usuários
    await checkAndNotifyUsers();

    console.log('✅ Posições atualizadas');
  }, intervalMs);
}

export function stopBusSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log('🛑 Simulação parada');
  }
}

/**
 * Obter status da simulação
 */
export function getSimulationStatus() {
  return {
    running: simulationInterval !== null,
    busCount: busPositions.size,
  };
}
