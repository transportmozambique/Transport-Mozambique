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
import { POSITION_FIELDS, currentSpeedKmh, estimateBusTrip, routePaths, statusLabel, vehiclePosition } from '@/lib/vehiclePosition';
import { maybeCheckArrivals } from '@/lib/busSimulator';
import { waitUntil } from '@vercel/functions';

/**
 * API para encontrar os autocarros que vão da origem ao destino do passageiro.
 *
 * Ideia principal: a viagem do passageiro (origem → destino) é uma PARTE da via do autocarro.
 *
 * Exemplo:
 * - Via do autocarro: Matola → Portagem → Museu → Baixa
 * - Viagem do passageiro: Portagem → Museu
 *
 * Cálculos:
 * - Tempo de Chegada: tempo até o autocarro chegar à origem do passageiro
 * - Distância Viagem: distância da origem ao destino do passageiro
 * - Tempo de Viagem: tempo que o passageiro passa no autocarro (origem → destino)
 * - Preço: pela distância da viagem do passageiro, com a regra de Tarifa activa (lib/fares.ts)
 *
 * Só os autocarros das rotas activas (Via.ativa). Um autocarro cujo motorista não iniciou a viagem
 * aparece parado, "Fora de serviço" (lib/vehiclePosition.ts).
 */

/** Os autocarros das rotas activas */
const ON_ACTIVE_ROUTE = { via: { ativa: true } } as const;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paragemId = searchParams.get('paragemId'); // A origem do passageiro
    const destinoId = searchParams.get('destinoId'); // O destino do passageiro
    const viaId = searchParams.get('viaId'); // Uma só via (formato antigo)
    const viaIds = searchParams.get('viaIds'); // várias vias
    const rule = await getFareRule();

    // Só posições (actualização do mapa ao vivo): uma consulta leve, percursos das vias guardados por instância
    if (searchParams.get('fields') === 'position') {
      const [rows, paths] = await Promise.all([
        prisma.transporte.findMany({
          where: ON_ACTIVE_ROUTE,
          select: { ...POSITION_FIELDS, viaId: true },
        }),
        routePaths(),
      ]);
      const now = new Date();
      const buses = rows.flatMap((t) => {
        const pos = vehiclePosition(t, paths.get(t.viaId!), now, rule);
        return pos
          ? [{ id: t.id, latitude: pos.point[0], longitude: pos.point[1], fonte: pos.source, direcao: pos.heading, status: statusLabel(pos) }]
          : [];
      });
      // O mapa ao vivo pede isto a cada poucos segundos: um bom momento para verificar os SMS de chegada
      waitUntil(maybeCheckArrivals());
      return NextResponse.json({ buses, total: buses.length });
    }

    // Os autocarros cuja via serve uma paragem (o botão "seguir" de um alerta de chegada)
    const servesStop = searchParams.get('servesStop');
    if (servesStop) {
      const rows = await prisma.transporte.findMany({
        where: { via: { ativa: true, paragens: { some: { paragemId: servesStop } } } },
        select: { id: true, matricula: true, via: { select: { nome: true } } },
        orderBy: { matricula: 'asc' },
      });
      const buses = rows.map((t) => ({ id: t.id, matricula: t.matricula, via: t.via?.nome ?? '' }));
      return NextResponse.json({ buses, total: buses.length });
    }

    // A primeira carga do mapa do passageiro: o que um marcador e o seu balão mostram, sem o percurso
    // e as paragens de todos os autocarros (cerca de 1 MB comprimido). O percurso de um autocarro tocado vem de /api/bus/[id].
    if (searchParams.get('fields') === 'map') {
      const [rows, paths] = await Promise.all([
        prisma.transporte.findMany({
          where: ON_ACTIVE_ROUTE,
          select: { ...POSITION_FIELDS, matricula: true, viaId: true, via: { select: { nome: true } } },
        }),
        routePaths(),
      ]);
      const now = new Date();
      const buses = rows.flatMap((t) => {
        const pos = vehiclePosition(t, paths.get(t.viaId!), now, rule);
        return pos
          ? [{
              id: t.id,
              matricula: t.matricula,
              via: t.via?.nome ?? '',
              latitude: pos.point[0],
              longitude: pos.point[1],
              fonte: pos.source,
              status: statusLabel(pos),
            }]
          : [];
      });
      return NextResponse.json({ buses, total: buses.length });
    }

    // Sem parâmetros, devolve todos os autocarros
    if (!paragemId && !viaId && !viaIds && !destinoId) {
      
      const allTransportes = await prisma.transporte.findMany({
        where: ON_ACTIVE_ROUTE,
        include: {
          motorista: { select: POSITION_FIELDS.motorista.select },
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
        // Paragens pela ordem de viagem (a ordem dos ids não é)
        via.paragens = orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation);
        // GPS real quando recente, senão a posição pela viagem do motorista (parado sem viagem)
        const position = vehiclePosition(transporte, via.geoLocationPath || transporte.routePath, now, rule);
        const [currentLat, currentLng] =
          position?.point ?? parseLatLng(via.paragens[0]?.paragem.geoLocation) ?? [-25.9655, 32.5892];

        // O percurso da via vem primeiro: o routePath do próprio autocarro está desactualizado na
        // maioria dos autocarros (foi copiado de outras vias), por isso é só um recurso.
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
          status: statusLabel(position),
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

    // É preciso a origem e o destino
    if (!paragemId || !destinoId) {
      return NextResponse.json(
        { error: 'Indique a origem (paragemId) e o destino (destinoId)' },
        { status: 400 }
      );
    }

    // Ler a origem e o destino
    const [origem, destino] = await Promise.all([
      prisma.paragem.findUnique({ where: { id: paragemId } }),
      prisma.paragem.findUnique({ where: { id: destinoId } })
    ]);

    if (!origem) {
      return NextResponse.json({ error: 'Origem não encontrada' }, { status: 404 });
    }

    if (!destino) {
      return NextResponse.json({ error: 'Destino não encontrado' }, { status: 404 });
    }

    // Ler os ids das vias (uma ou várias)
    let viaIdFilter: string[] | undefined;
    if (viaIds) {
      viaIdFilter = viaIds.split(',');
    } else if (viaId) {
      viaIdFilter = [viaId];
    }

    // Encontrar todos os transportes que passam pelas DUAS paragens
    const allTransportes = await prisma.transporte.findMany({
      where: viaIdFilter ? { ...ON_ACTIVE_ROUTE, viaId: { in: viaIdFilter } } : ON_ACTIVE_ROUTE,
      include: {
        motorista: { select: POSITION_FIELDS.motorista.select },
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

        // Paragens pela ordem de viagem (a ordem dos ids não é)
        const stops = orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation)
          .map((vp) => ({ vp, point: parseLatLng(vp.paragem.geoLocation) }))
          .filter((s): s is { vp: typeof s.vp; point: LatLng } => s.point !== null);

        // O autocarro tem de servir as duas paragens; as viagens podem ir num sentido ou no outro da via
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
          // Sentido desta viagem, com o nome das primeira e última paragens da via no seu percurso
          direcao: trip.sentido === 1
            ? `${stops[0].vp.paragem.nome} → ${stops[stops.length - 1].vp.paragem.nome}`
            : `${stops[stops.length - 1].vp.paragem.nome} → ${stops[0].vp.paragem.nome}`,
          distancia: Math.round(trip.distanciaViagem), // A distância da viagem do passageiro
          tempoEstimado: trip.tempoChegada, // tempo até o autocarro chegar à origem
          tempoViagem: trip.tempoViagem, // tempo que o passageiro passa no autocarro
          velocidade: currentSpeedKmh(transporte, position, rule),
          latitude: bus[0],
          longitude: bus[1],
          fonte: position?.source ?? 'horario',
          status: statusLabel(position),
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

    // Ordenar pela hora de chegada
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
    console.error('❌ Erro ao carregar autocarros:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
