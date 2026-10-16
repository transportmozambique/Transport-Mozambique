import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { orderStopsAlongRoute } from '@/lib/fares';
import { driverIdFromRequest } from '@/lib/driverSession';

// Passengers waiting along the driver's route: alerts asked for (web or USSD) in the last
// 3 hours at a stop of the route, not yet answered by an arrival SMS. Driver portal only.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const WAITING_WINDOW_MS = 3 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const motoristaId = driverIdFromRequest(request);
  if (!motoristaId) return json({ error: 'Sessão inválida ou expirada. Entre de novo.' }, 401);

  try {
    const driver = await prisma.motorista.findUnique({
      where: { id: motoristaId },
      select: {
        transporte: {
          select: {
            via: {
              select: {
                geoLocationPath: true,
                paragens: { select: { paragem: { select: { id: true, nome: true, geoLocation: true } } } },
              },
            },
          },
        },
      },
    });
    const via = driver?.transporte?.via;
    if (!via) return json({ total: 0, paragens: [] });

    const stops = orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation).map((vp) => vp.paragem);
    const counts = await prisma.mISSION.groupBy({
      by: ['paragemId'],
      where: {
        paragemId: { in: stops.map((s) => s.id) },
        notificadoEm: null,
        createdAt: { gte: new Date(Date.now() - WAITING_WINDOW_MS) },
      },
      _count: { _all: true },
    });
    const byStop = new Map(counts.map((c) => [c.paragemId, c._count._all]));
    const paragens = stops.map((s) => ({ nome: s.nome, aEspera: byStop.get(s.id) ?? 0 }));
    return json({ total: paragens.reduce((sum, p) => sum + p.aEspera, 0), paragens });
  } catch (error) {
    console.error('Error reading waiting passengers:', error);
    return json({ error: 'Erro ao obter passageiros à espera' }, 500);
  }
}
