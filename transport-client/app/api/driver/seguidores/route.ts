import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { orderStopsAlongRoute } from '@/lib/fares';
import { driverIdFromRequest } from '@/lib/driverSession';

// Passageiros à espera ao longo da via do motorista: alertas pedidos (web ou USSD) nas últimas
// 3 horas numa paragem da via. Os alertas já respondidos por um SMS de chegada contam na mesma: esse
// SMS sai quando um autocarro está a 1 km, que é quando o motorista mais precisa do número. Só para o portal do motorista.
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
        createdAt: { gte: new Date(Date.now() - WAITING_WINDOW_MS) },
      },
      _count: { _all: true },
    });
    const byStop = new Map(counts.map((c) => [c.paragemId, c._count._all]));
    const paragens = stops.map((s) => ({ nome: s.nome, aEspera: byStop.get(s.id) ?? 0 }));
    return json({ total: paragens.reduce((sum, p) => sum + p.aEspera, 0), paragens });
  } catch (error) {
    console.error('Erro ao ler os passageiros à espera:', error);
    return json({ error: 'Erro ao obter passageiros à espera' }, 500);
  }
}
