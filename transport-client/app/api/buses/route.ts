import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getFareRule,
  fareFor,
  estimateTrip,
  orderStopsAlongRoute,
  parseLatLng,
  parseRoutePath,
  type LatLng,
} from '@/lib/fares';

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
 * - Preço: Based on user's journey distance, using the active Tarifa rule (lib/fares.ts)
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paragemId = searchParams.get('paragemId'); // User's origin
    const destinoId = searchParams.get('destinoId'); // User's destination
    const viaId = searchParams.get('viaId'); // Single via (legacy)
    const viaIds = searchParams.get('viaIds'); // Multiple vias (new)
    const rule = await getFareRule();

    // Positions only (live map refresh): one light query
    if (searchParams.get('fields') === 'position') {
      const rows = await prisma.transporte.findMany({
        where: { viaId: { not: null } },
        select: { id: true, currGeoLocation: true },
      });
      const buses = rows.flatMap((t) => {
        const pos = parseLatLng(t.currGeoLocation);
        return pos ? [{ id: t.id, latitude: pos[0], longitude: pos[1] }] : [];
      });
      return NextResponse.json({ buses, total: buses.length });
    }

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
        // Stops in travel order (their id order is not)
        via.paragens = orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation);
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

        // The route's path comes first: the bus's own routePath is stale on most buses
        // (it was copied from other routes), so it is only a fallback.
        const routePath = parseRoutePath(via.geoLocationPath || transporte.routePath).map(
          ([lat, lng]) => [lng, lat] as [number, number]
        );

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
        const fare = fareFor(defaultDistanceKm * 1000, rule);

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

        // Stops in travel order (their id order is not)
        const stops = orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation)
          .map((vp) => ({ vp, point: parseLatLng(vp.paragem.geoLocation) }))
          .filter((s): s is { vp: typeof s.vp; point: LatLng } => s.point !== null);

        const bus =
          parseLatLng(transporte.currGeoLocation) ??
          parseLatLng(transporte.geoLocations[0]?.geoLocationTransporte) ??
          stops[0]?.point;
        if (!bus) return null;

        // Bus must pass through origem and then destino
        const trip = estimateTrip(stops.map((s) => ({ id: s.vp.paragem.id, point: s.point })), bus, paragemId, destinoId, rule);
        if (!trip) return null;

        return {
          id: transporte.id,
          matricula: transporte.matricula,
          via: via.nome,
          viaId: via.id,
          direcao: `${via.terminalPartida} → ${via.terminalChegada}`,
          distancia: Math.round(trip.distanciaViagem), // User's journey distance
          tempoEstimado: trip.tempoChegada, // Time for bus to reach origem
          tempoViagem: trip.tempoViagem, // Time user spends in bus
          velocidade: rule.velocidadeChegadaKmh,
          latitude: bus[0],
          longitude: bus[1],
          status: 'Em Circulação',
          fare: trip.fare,
          routeCoords: parseRoutePath(via.geoLocationPath).map(([lat, lng]) => [lng, lat]),
          stops: stops.map(({ vp, point }) => ({
            id: vp.paragem.id,
            nome: vp.paragem.nome,
            latitude: point[0],
            longitude: point[1],
            isTerminal: vp.terminalBoolean,
          })),
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
