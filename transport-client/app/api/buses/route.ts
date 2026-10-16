import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getFareRule,
  fareFor,
  orderStopsAlongRoute,
  parseLatLng,
  parseRoutePath,
  type LatLng,
} from '@/lib/fares';
import { POSITION_FIELDS, estimateBusTrip, routePaths, vehiclePosition } from '@/lib/vehiclePosition';
import { maybeCheckArrivals } from '@/lib/busSimulator';
import { waitUntil } from '@vercel/functions';

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

    // Positions only (live map refresh): one light query, route paths cached per instance
    if (searchParams.get('fields') === 'position') {
      const [rows, paths] = await Promise.all([
        prisma.transporte.findMany({
          where: { viaId: { not: null } },
          select: { ...POSITION_FIELDS, viaId: true },
        }),
        routePaths(),
      ]);
      const now = new Date();
      const buses = rows.flatMap((t) => {
        const pos = vehiclePosition(t, paths.get(t.viaId!), now, rule);
        return pos
          ? [{ id: t.id, latitude: pos.point[0], longitude: pos.point[1], fonte: pos.source, direcao: pos.heading }]
          : [];
      });
      // The live map polls this every few seconds: a good moment to check arrival SMS
      waitUntil(maybeCheckArrivals());
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
        },
      });

      const now = new Date();
      const allBuses = allTransportes
        .filter((t): t is typeof t & { via: NonNullable<typeof t.via> } => t.via != null)
        .map((transporte) => {
        const { via } = transporte;
        // Stops in travel order (their id order is not)
        via.paragens = orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation);
        // Real GPS when fresh, otherwise the timetable position on the route
        const position = vehiclePosition(transporte, via.geoLocationPath || transporte.routePath, now, rule);
        const [currentLat, currentLng] =
          position?.point ?? parseLatLng(via.paragens[0]?.paragem.geoLocation) ?? [-25.9655, 32.5892];

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
          fonte: position?.source ?? 'horario',
          status: position && !position.moving && position.source === 'horario' ? 'No terminal' : 'Em Circulação',
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
      },
    });

    const now = new Date();
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

        // Bus must serve both stops; trips can go either way along the route
        const trip = estimateBusTrip({
          vehicle: transporte,
          path: via.geoLocationPath,
          stops: stops.map((s) => ({ id: s.vp.paragem.id, point: s.point })),
          origemId: paragemId,
          destinoId: destinoId,
          rule,
          now,
        });
        if (!trip) return null;
        const position = trip.position;
        const bus = position?.point ?? stops[0].point;

        return {
          id: transporte.id,
          matricula: transporte.matricula,
          via: via.nome,
          viaId: via.id,
          // Direction of this trip, named by the route's first and last stops along its path
          direcao: trip.sentido === 1
            ? `${stops[0].vp.paragem.nome} → ${stops[stops.length - 1].vp.paragem.nome}`
            : `${stops[stops.length - 1].vp.paragem.nome} → ${stops[0].vp.paragem.nome}`,
          distancia: Math.round(trip.distanciaViagem), // User's journey distance
          tempoEstimado: trip.tempoChegada, // Time for bus to reach origem
          tempoViagem: trip.tempoViagem, // Time user spends in bus
          velocidade: rule.velocidadeChegadaKmh,
          latitude: bus[0],
          longitude: bus[1],
          fonte: position?.source ?? 'horario',
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
