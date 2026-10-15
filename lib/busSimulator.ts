import { prisma } from './prisma';

/**
 * Simulador de Movimento de Autocarros
 * Atualiza a posição dos autocarros seguindo suas rotas nas estradas reais
 */

interface BusPosition {
  transporteId: string;
  currentIndex: number;
  routePath: [number, number][]; // Rota completa seguindo estradas (OSRM)
  originalWaypoints: [number, number][]; // Waypoints originais
  direction: 'forward' | 'backward';
  progress: number; // Progresso entre waypoints (0-1)
  speed: number; // Velocidade em km/h
}

// Armazenar posição atual de cada autocarro
const busPositions = new Map<string, BusPosition>();

// Cache de rotas OSRM
const routeCache = new Map<string, [number, number][]>();

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
 * Obter rota seguindo estradas usando OSRM
 */
async function getRouteFromOSRM(waypoints: [number, number][]): Promise<[number, number][]> {
  if (waypoints.length < 2) return waypoints;

  // Criar chave de cache
  const cacheKey = waypoints.map(w => `${w[0]},${w[1]}`).join('|');
  
  // Verificar cache
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  try {
    const waypointsString = waypoints.map(w => `${w[0]},${w[1]}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson`;

    const response = await fetch(osrmUrl);
    
    if (!response.ok) {
      console.warn(`OSRM returned status ${response.status}, using waypoints`);
      return waypoints;
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('OSRM failed, using waypoints');
      return waypoints;
    }

    // Obter coordenadas da rota que segue estradas
    const routeCoordinates = data.routes[0].geometry.coordinates as [number, number][];
    
    // Armazenar no cache
    routeCache.set(cacheKey, routeCoordinates);
    
    console.log(`✓ OSRM route: ${waypoints.length} waypoints → ${routeCoordinates.length} points`);
    
    return routeCoordinates;
  } catch (error) {
    console.error('Error fetching OSRM route:', error);
    return waypoints;
  }
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
    // Parsear waypoints originais
    let originalWaypoints: [number, number][] = [];
    
    if (transporte.routePath) {
      originalWaypoints = transporte.routePath.split(';').map((coord) => {
        const [lng, lat] = coord.split(',').map(Number);
        return [lng, lat] as [number, number];
      });
    } else if (transporte.via.geoLocationPath) {
      originalWaypoints = transporte.via.geoLocationPath.split(';').map((coord) => {
        const [lng, lat] = coord.split(',').map(Number);
        return [lng, lat] as [number, number];
      });
    }

    if (originalWaypoints.length > 0) {
      // Obter rota seguindo estradas
      const routePath = await getRouteFromOSRM(originalWaypoints);
      
      // Velocidade aleatória entre 25-45 km/h (realista para transporte urbano)
      const speed = 25 + Math.random() * 20;
      
      // Posição inicial aleatória na rota
      const startIndex = Math.floor(Math.random() * routePath.length);
      
      busPositions.set(transporte.id, {
        transporteId: transporte.id,
        currentIndex: startIndex,
        routePath,
        originalWaypoints,
        direction: Math.random() > 0.5 ? 'forward' : 'backward',
        progress: 0,
        speed,
      });
    }
  }

  console.log(`✅ ${busPositions.size} autocarros inicializados com rotas OSRM`);
}

/**
 * Atualizar posição de um autocarro
 */
async function updateBusPosition(busPosition: BusPosition, deltaTimeSeconds: number) {
  const { transporteId, currentIndex, routePath, direction, progress, speed } = busPosition;

  if (routePath.length < 2) return;

  // Calcular distância percorrida neste intervalo
  // speed em km/h, deltaTime em segundos
  const distanceKm = (speed * deltaTimeSeconds) / 3600; // km
  const distanceMeters = distanceKm * 1000; // metros

  // Obter pontos atual e próximo
  const currentPoint = routePath[currentIndex];
  let nextIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;

  // Verificar limites
  if (nextIndex >= routePath.length) {
    busPosition.direction = 'backward';
    nextIndex = routePath.length - 2;
  } else if (nextIndex < 0) {
    busPosition.direction = 'forward';
    nextIndex = 1;
  }

  const nextPoint = routePath[nextIndex];

  // Calcular distância entre pontos
  const segmentDistance = calculateDistance(
    currentPoint[1], currentPoint[0],
    nextPoint[1], nextPoint[0]
  );

  // Calcular novo progresso
  let newProgress = progress + (distanceMeters / segmentDistance);

  // Se completou o segmento, avançar para próximo
  if (newProgress >= 1.0) {
    busPosition.currentIndex = nextIndex;
    busPosition.progress = 0;
    newProgress = 0;
  } else {
    busPosition.progress = newProgress;
  }

  // Interpolar posição atual
  const [lng, lat] = interpolatePosition(currentPoint, nextPoint, newProgress);
  const newPosition = `${lat},${lng}`;

  // Obter posições anteriores para histórico
  const hist1Index = Math.max(0, currentIndex - 1);
  const hist2Index = Math.max(0, currentIndex - 2);
  const hist3Index = Math.max(0, currentIndex - 3);

  const [lng1, lat1] = routePath[hist1Index];
  const [lng2, lat2] = routePath[hist2Index];
  const [lng3, lat3] = routePath[hist3Index];

  try {
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

    const geoDirection = direction === 'forward' ? 'Indo' : 'Voltando';

    if (existingGeoLocation) {
      await prisma.geoLocation.update({
        where: { id: existingGeoLocation.id },
        data: {
          geoLocationTransporte: newPosition,
          geoDirection,
          geoLocationHist1: `${lat1},${lng1}`,
          geoLocationHist2: `${lat2},${lng2}`,
          geoLocationHist3: `${lat3},${lng3}`,
          geoDateTime1: new Date(Date.now() - 5 * 60000),
          geoDateTime2: new Date(Date.now() - 10 * 60000),
          geoDateTime3: new Date(Date.now() - 15 * 60000),
        },
      });
    } else {
      // Criar novo registro
      const transporte = await prisma.transporte.findUnique({
        where: { id: transporteId },
      });

      if (transporte) {
        await prisma.geoLocation.create({
          data: {
            geoLocationTransporte: newPosition,
            geoDirection,
            codigoTransporte: transporte.codigo,
            transporteId: transporte.id,
            geoLocationHist1: `${lat1},${lng1}`,
            geoLocationHist2: `${lat2},${lng2}`,
            geoLocationHist3: `${lat3},${lng3}`,
            geoDateTime1: new Date(Date.now() - 5 * 60000),
            geoDateTime2: new Date(Date.now() - 10 * 60000),
            geoDateTime3: new Date(Date.now() - 15 * 60000),
          },
        });
      }
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
let lastUpdateTime: number = Date.now();

export function startBusSimulation(intervalMs: number = 10000) {
  if (simulationInterval) {
    console.log('⚠️ Simulação já está rodando');
    return;
  }

  console.log(`🚀 Iniciando simulação de autocarros (intervalo: ${intervalMs}ms = ${intervalMs/1000}s)`);
  lastUpdateTime = Date.now();

  simulationInterval = setInterval(async () => {
    const currentTime = Date.now();
    const deltaTimeMs = currentTime - lastUpdateTime;
    const deltaTimeSeconds = deltaTimeMs / 1000;
    
    lastUpdateTime = currentTime;

    console.log(`🔄 Atualizando posições de ${busPositions.size} autocarros (Δt=${deltaTimeSeconds.toFixed(1)}s)...`);

    // Atualizar posição de cada autocarro
    const updates = Array.from(busPositions.values()).map((busPosition) =>
      updateBusPosition(busPosition, deltaTimeSeconds)
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
