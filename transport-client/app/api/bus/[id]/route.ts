import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getFareRule,
  orderStopsAlongRoute,
  parseLatLng,
  parseRoutePath,
  type LatLng,
} from '@/lib/fares';
import { currentSpeedKmh, estimateBusTrip, vehiclePosition } from '@/lib/vehiclePosition';

// GET /api/bus/[id]?paragem=<origem>&destino=<destino>
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: busId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const paragemId = searchParams.get('paragem'); // User's origin (EMBARQUE)
    const destinoId = searchParams.get('destino'); // User's destination (DESTINO)

    const transporte = await prisma.transporte.findUnique({
      where: { id: busId },
      include: {
        via: { include: { paragens: { include: { paragem: true } } } },
      },
    });

    if (!transporte) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 });
    }
    if (!transporte.via) {
      return NextResponse.json({ error: 'Route (via) not assigned to this transport' }, { status: 400 });
    }

    const { via } = transporte;
    const rule = await getFareRule();

    // Stops in travel order (their id order is not)
    const stops = orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation)
      .map((vp) => ({ vp, point: parseLatLng(vp.paragem.geoLocation) }))
      .filter((s): s is { vp: typeof s.vp; point: LatLng } => s.point !== null);

    // Real GPS when fresh, otherwise the timetable position on the route
    const now = new Date();
    const position = vehiclePosition(transporte, via.geoLocationPath || transporte.routePath, now, rule);
    const bus: LatLng = position?.point ?? stops[0]?.point ?? [-25.9692, 32.5732];

    // Path drawn on the map: the via's, else the bus's own ([lng, lat] pairs)
    const routeCoords = parseRoutePath(via.geoLocationPath || transporte.routePath).map(([lat, lng]) => [lng, lat]);

    // Trips can go either way along the route (a destination before the origin is the return leg)
    const trip = paragemId && destinoId
      ? estimateBusTrip({
          vehicle: transporte,
          path: via.geoLocationPath || transporte.routePath,
          stops: stops.map((s) => ({ id: s.vp.paragem.id, point: s.point })),
          origemId: paragemId,
          destinoId,
          rule,
          now,
        })
      : null;

    return NextResponse.json({
      id: transporte.id,
      matricula: transporte.matricula,
      via: via.nome,
      viaId: via.id,
      // Direction of the passenger's trip (or of the route), by its first and last stops
      direcao: stops.length
        ? trip?.sentido === -1
          ? `${stops[stops.length - 1].vp.paragem.nome} → ${stops[0].vp.paragem.nome}`
          : `${stops[0].vp.paragem.nome} → ${stops[stops.length - 1].vp.paragem.nome}`
        : `${via.terminalPartida} → ${via.terminalChegada}`,
      velocidade: currentSpeedKmh(transporte, position, rule),
      latitude: bus[0],
      longitude: bus[1],
      fonte: position?.source ?? 'horario',
      direcaoGraus: position?.heading ?? null,
      posicaoEm: (position?.at ?? new Date()).toISOString(),
      status: position && !position.moving && position.source === 'horario' ? 'No terminal' : 'Em Circulação',
      routeCoords,
      stops: stops.map(({ vp, point }) => ({
        id: vp.paragem.id,
        nome: vp.paragem.nome,
        latitude: point[0],
        longitude: point[1],
        isTerminal: vp.terminalBoolean,
        isPickup: vp.paragem.id === paragemId,
        isDestination: vp.paragem.id === destinoId,
      })),
      // Defaults when no valid origin -> destination pair was given
      tempoEstimado: trip?.tempoChegada ?? 5,
      distancia: Math.round(trip?.distanciaAteOrigem ?? 1000),
      jaPassou: trip?.jaPassou ?? false,
      tempoViagem: trip?.tempoViagem ?? 0,
      distanciaViagem: Math.round(trip?.distanciaViagem ?? 0),
      fare: trip?.fare ?? rule.tarifaMinima,
    });
  } catch (error: any) {
    console.error('Error fetching bus:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
