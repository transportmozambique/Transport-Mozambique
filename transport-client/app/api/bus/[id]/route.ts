import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getFareRule,
  estimateTrip,
  orderStopsAlongRoute,
  parseLatLng,
  parseRoutePath,
  type LatLng,
} from '@/lib/fares';

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
        geoLocations: { orderBy: { createdAt: 'desc' }, take: 1 },
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

    const bus: LatLng =
      parseLatLng(transporte.currGeoLocation) ??
      parseLatLng(transporte.geoLocations[0]?.geoLocationTransporte) ??
      stops[0]?.point ??
      [-25.9692, 32.5732];

    // Path drawn on the map: the bus's own route if it has one, else the via's ([lng, lat] pairs)
    const routeCoords = parseRoutePath(via.geoLocationPath || transporte.routePath).map(([lat, lng]) => [lng, lat]);

    const trip = paragemId && destinoId
      ? estimateTrip(stops.map((s) => ({ id: s.vp.paragem.id, point: s.point })), bus, paragemId, destinoId, rule)
      : null;

    return NextResponse.json({
      id: transporte.id,
      matricula: transporte.matricula,
      via: via.nome,
      viaId: via.id,
      direcao: `${via.terminalPartida} → ${via.terminalChegada}`,
      velocidade: rule.velocidadeChegadaKmh,
      latitude: bus[0],
      longitude: bus[1],
      status: 'Em Circulação',
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
