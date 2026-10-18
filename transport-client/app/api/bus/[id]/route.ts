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
      return NextResponse.json({ error: 'Autocarro não encontrado' }, { status: 404 });
    }
    if (!transporte.via) {
      return NextResponse.json({ error: 'Este transporte não tem via atribuída' }, { status: 400 });
    }

    const { via } = transporte;
    const rule = await getFareRule();

    // Paragens pela ordem de viagem (a ordem dos ids não é)
    const stops = orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation)
      .map((vp) => ({ vp, point: parseLatLng(vp.paragem.geoLocation) }))
      .filter((s): s is { vp: typeof s.vp; point: LatLng } => s.point !== null);

    // GPS real quando recente, senão a posição pelo horário na via
    const now = new Date();
    const position = vehiclePosition(transporte, via.geoLocationPath || transporte.routePath, now, rule);
    const bus: LatLng = position?.point ?? stops[0]?.point ?? [-25.9692, 32.5732];

    // Percurso desenhado no mapa: o da via, senão o do próprio autocarro (pares [lng, lat])
    const routeCoords = parseRoutePath(via.geoLocationPath || transporte.routePath).map(([lat, lng]) => [lng, lat]);

    // As viagens podem ir num sentido ou no outro da via (um destino antes da origem é a volta)
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
      // Sentido da viagem do passageiro (ou da via), pelas suas primeira e última paragens
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
      // Valores por omissão quando não foi dado um par origem -> destino válido
      tempoEstimado: trip?.tempoChegada ?? 5,
      distancia: Math.round(trip?.distanciaAteOrigem ?? 1000),
      jaPassou: trip?.jaPassou ?? false,
      tempoViagem: trip?.tempoViagem ?? 0,
      distanciaViagem: Math.round(trip?.distanciaViagem ?? 0),
      fare: trip?.fare ?? rule.tarifaMinima,
    });
  } catch (error: any) {
    console.error('Erro ao carregar autocarro:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
