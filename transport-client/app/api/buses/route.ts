import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API to find buses that go from user's origin to user's destination
 * 
 * Key concept: User's journey (origem → destino) is a SUBSET of bus route
 * 
 * Example:
 * - Bus route: Matola → Portagem → Museu → Baixa
 * - User journey: Portagem → Museu
 * 
 * Calculations:
 * - Tempo de Chegada: Time for bus to reach user's origem
 * - Distância Viagem: Distance from user's origem to user's destino
 * - Tempo de Viagem: Time user spends in bus (origem → destino)
 * - Preço: Based on user's journey distance (10 MT/km)
 */

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth radius in meters
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paragemId = searchParams.get('paragemId'); // User's origin
    const destinoId = searchParams.get('destinoId'); // User's destination
    const viaId = searchParams.get('viaId'); // Single via (legacy)
    const viaIds = searchParams.get('viaIds'); // Multiple vias (new)

    // If no parameters, return all buses
    if (!paragemId && !viaId && !viaIds && !destinoId) {
      
      const allTransportes = await prisma.transporte.findMany({
        include: {
          via: {
            include: {
              paragens: {
                include: {
                  paragem: true,
                },
                orderBy: {
                  id: 'asc',
                },
              },
            },
          },
          geoLocations: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      const allBuses = allTransportes
        .filter((t): t is typeof t & { via: NonNullable<typeof t.via> } => t.via != null)
        .map((transporte) => {
        const { via } = transporte;
        let currentLat, currentLng;
        
        if (transporte.currGeoLocation) {
          [currentLat, currentLng] = transporte.currGeoLocation.split(',').map(Number);
        } else if (transporte.geoLocations.length > 0) {
          [currentLat, currentLng] = transporte.geoLocations[0].geoLocationTransporte.split(',').map(Number);
        } else {
          const firstStop = via.paragens[0];
          if (firstStop) {
            [currentLat, currentLng] = firstStop.paragem.geoLocation.split(',').map(Number);
          } else {
            currentLat = -25.9655;
            currentLng = 32.5892;
          }
        }

        let routePath: [number, number][] = [];
        if (transporte.routePath) {
          routePath = transporte.routePath.split(';').map((coord) => {
            const [lng, lat] = coord.split(',').map(Number);
            return [lng, lat];
          });
        } else if (via.geoLocationPath) {
          routePath = via.geoLocationPath.split(';').map((coord) => {
            const [lng, lat] = coord.split(',').map(Number);
            return [lng, lat];
          });
        }

        const stops = via.paragens.map((vp) => {
          const [lat, lng] = vp.paragem.geoLocation.split(',').map(Number);
          return {
            id: vp.paragem.id,
            nome: vp.paragem.nome,
            latitude: lat,
            longitude: lng,
            isTerminal: vp.terminalBoolean,
          };
        });

        const defaultDistanceKm = 5;
        const fare = Math.max(10, Math.ceil(defaultDistanceKm * 10));

        return {
          id: transporte.id,
          matricula: transporte.matricula,
          via: via.nome,
          latitude: currentLat,
          longitude: currentLng,
          status: 'Em Circulação',
          fare,
          routePath: routePath,
          stops: stops,
        };
      });

      return NextResponse.json({
        buses: allBuses,
        total: allBuses.length,
      });
    }

    // Require both origem and destino
    if (!paragemId || !destinoId) {
      return NextResponse.json(
        { error: 'paragemId (origem) and destinoId are required' },
        { status: 400 }
      );
    }

    // Get origem and destino details
    const [origem, destino] = await Promise.all([
      prisma.paragem.findUnique({ where: { id: paragemId } }),
      prisma.paragem.findUnique({ where: { id: destinoId } })
    ]);

    if (!origem) {
      return NextResponse.json({ error: 'Origem not found' }, { status: 404 });
    }

    if (!destino) {
      return NextResponse.json({ error: 'Destino not found' }, { status: 404 });
    }

    // Parse via IDs (support both single and multiple)
    let viaIdFilter: string[] | undefined;
    if (viaIds) {
      viaIdFilter = viaIds.split(',');
    } else if (viaId) {
      viaIdFilter = [viaId];
    }

    // Find all transportes that pass through BOTH stops in correct order
    const allTransportes = await prisma.transporte.findMany({
      where: viaIdFilter ? { viaId: { in: viaIdFilter } } : {},
      include: {
        via: {
          include: {
            paragens: {
              include: {
                paragem: true,
              },
              orderBy: {
                id: 'asc',
              },
            },
          },
        },
        geoLocations: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    const [origemLat, origemLng] = origem.geoLocation.split(',').map(Number);
    const [destinoLat, destinoLng] = destino.geoLocation.split(',').map(Number);

    const validBuses = allTransportes
      .map((transporte) => {
        if (!transporte.via) return null;
        const { via } = transporte;

        // Find origem and destino indices in bus route
        const origemIndex = via.paragens.findIndex((vp) => vp.paragem.id === paragemId);
        const destinoIndex = via.paragens.findIndex((vp) => vp.paragem.id === destinoId);

        // Bus must pass through both stops
        if (origemIndex === -1 || destinoIndex === -1) {
          return null;
        }

        // Origem must come BEFORE destino
        if (origemIndex >= destinoIndex) {
          return null;
        }

        // Get current bus position
        let currentLat, currentLng;
        
        if (transporte.currGeoLocation) {
          [currentLat, currentLng] = transporte.currGeoLocation.split(',').map(Number);
        } else if (transporte.geoLocations.length > 0) {
          [currentLat, currentLng] = transporte.geoLocations[0].geoLocationTransporte.split(',').map(Number);
        } else {
          const firstStop = via.paragens[0];
          if (firstStop) {
            [currentLat, currentLng] = firstStop.paragem.geoLocation.split(',').map(Number);
          } else {
            return null;
          }
        }

        // Find closest stop to current bus position
        let closestStopIndex = 0;
        let minDistance = Infinity;

        via.paragens.forEach((vp, index) => {
          const [stopLat, stopLng] = vp.paragem.geoLocation.split(',').map(Number);
          const dist = calculateDistance(currentLat, currentLng, stopLat, stopLng);
          
          if (dist < minDistance) {
            minDistance = dist;
            closestStopIndex = index;
          }
        });

        // Check if bus already passed origem
        const alreadyPassedOrigem = closestStopIndex > origemIndex;

        // Calculate: 1. Time for bus to reach origem (Tempo de Chegada)
        let distanciaAteOrigem = 0;
        let isNextCycle = false;
        
        if (alreadyPassedOrigem) {
          // Bus already passed - calculate time for full route + distance to origem
          isNextCycle = true;
          
          // Distance from current position to end of route
          distanciaAteOrigem = minDistance;
          for (let i = closestStopIndex; i < via.paragens.length - 1; i++) {
            const [lat1, lng1] = via.paragens[i].paragem.geoLocation.split(',').map(Number);
            const [lat2, lng2] = via.paragens[i + 1].paragem.geoLocation.split(',').map(Number);
            distanciaAteOrigem += calculateDistance(lat1, lng1, lat2, lng2);
          }
          
          // Add distance from start to origem (next cycle)
          for (let i = 0; i < origemIndex; i++) {
            const [lat1, lng1] = via.paragens[i].paragem.geoLocation.split(',').map(Number);
            const [lat2, lng2] = via.paragens[i + 1].paragem.geoLocation.split(',').map(Number);
            distanciaAteOrigem += calculateDistance(lat1, lng1, lat2, lng2);
          }
          
          // Add 10 minutes for turnaround time
          distanciaAteOrigem += 10000; // 10 km equivalent for 10 min wait
          
        } else if (closestStopIndex === origemIndex) {
          // Bus is at origem
          distanciaAteOrigem = calculateDistance(currentLat, currentLng, origemLat, origemLng);
        } else {
          // Bus hasn't reached origem yet - sum distances along route
          distanciaAteOrigem = minDistance; // Distance to closest stop
          
          for (let i = closestStopIndex; i < origemIndex; i++) {
            const [lat1, lng1] = via.paragens[i].paragem.geoLocation.split(',').map(Number);
            const [lat2, lng2] = via.paragens[i + 1].paragem.geoLocation.split(',').map(Number);
            distanciaAteOrigem += calculateDistance(lat1, lng1, lat2, lng2);
          }
        }

        const tempoChegada = Math.max(1, Math.ceil(distanciaAteOrigem / 1000 / 45 * 60)); // 45 km/h

        // Calculate: 2. User's journey distance (origem → destino)
        let distanciaViagem = 0;
        
        for (let i = origemIndex; i < destinoIndex; i++) {
          const [lat1, lng1] = via.paragens[i].paragem.geoLocation.split(',').map(Number);
          const [lat2, lng2] = via.paragens[i + 1].paragem.geoLocation.split(',').map(Number);
          distanciaViagem += calculateDistance(lat1, lng1, lat2, lng2);
        }

        const tempoViagem = Math.ceil(distanciaViagem / 1000 / 30 * 60); // 30 km/h city speed

        // Calculate fare based on user's journey distance
        const distanciaViagemKm = distanciaViagem / 1000;
        const fare = Math.max(10, Math.ceil(distanciaViagemKm * 10)); // 10 MT per km

        // Get route path
        let routeCoords: [number, number][] = [];
        if (via.geoLocationPath) {
          routeCoords = via.geoLocationPath.split(';').map((coord) => {
            const [lng, lat] = coord.split(',').map(Number);
            return [lng, lat];
          });
        }

        return {
          id: transporte.id,
          matricula: transporte.matricula,
          via: via.nome,
          viaId: via.id,
          direcao: `${via.terminalPartida} → ${via.terminalChegada}`,
          distancia: Math.round(distanciaViagem), // User's journey distance
          tempoEstimado: tempoChegada, // Time for bus to reach origem
          tempoViagem: tempoViagem, // Time user spends in bus
          velocidade: 45,
          latitude: currentLat,
          longitude: currentLng,
          status: 'Em Circulação',
          fare,
          routeCoords,
          stops: via.paragens.map((vp) => {
            const [lat, lng] = vp.paragem.geoLocation.split(',').map(Number);
            return {
              id: vp.paragem.id,
              nome: vp.paragem.nome,
              latitude: lat,
              longitude: lng,
              isTerminal: vp.terminalBoolean,
            };
          }),
        };
      })
      .filter((bus) => bus !== null);

    // Sort by arrival time
    validBuses.sort((a, b) => a.tempoEstimado - b.tempoEstimado);

    return NextResponse.json({
      buses: validBuses,
      origem: {
        id: origem.id,
        nome: origem.nome,
        latitude: origemLat,
        longitude: origemLng,
      },
      destino: {
        id: destino.id,
        nome: destino.nome,
        latitude: destinoLat,
        longitude: destinoLng,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching buses:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
