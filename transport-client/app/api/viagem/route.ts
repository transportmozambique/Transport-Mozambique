import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { FollowError, followBus, followJourney, type LegSpec } from '@/lib/follow';
import { maybeCheckArrivals } from '@/lib/busSimulator';

/**
 * Acompanhar uma viagem (ou um só autocarro), com as horas calculadas agora.
 *
 * GET /api/viagem?b=BUS~DE~PARA,BUS~DE~PARA[&lat=…&lng=…][&de=PARAGEM][&para=PARAGEM][&a=0][&bordo=0|1]
 *   b       os autocarros da viagem, cada um com as paragens onde o passageiro entra e sai
 *   lat,lng a posição do passageiro agora (as caminhadas medem-se a partir dela)
 *   de      a paragem de partida, quando a viagem começou numa paragem; para, a paragem de destino
 *   a       o troço em que o passageiro está (a partir de 0); bordo=1 quando está no autocarro dele
 *
 * GET /api/viagem?b=BUS[&paragem=PARAGEM]: um autocarro sozinho, com as paragens à frente
 *
 * A aplicação usa POST com os mesmos parâmetros e a posição num corpo JSON {"lat", "lng"}:
 * uma posição no URL ficaria nos registos dos pedidos. Porquê os autocarros no URL: o servidor
 * não guarda viagens, por isso qualquer instância responde. Ver docs/referencia-api.md.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return follow(params, point(params.get('lat'), params.get('lng')));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return follow(request.nextUrl.searchParams, point(body?.lat, body?.lng));
}

function point(latValue: unknown, lngValue: unknown): [number, number] | null {
  if (latValue === null || latValue === undefined || latValue === '' || lngValue === null || lngValue === undefined || lngValue === '') return null;
  const lat = Number(latValue);
  const lng = Number(lngValue);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}

async function follow(params: URLSearchParams, position: [number, number] | null) {
  const legs = (params.get('b') ?? '')
    .split(',')
    .map((s) => s.split('~').map((x) => x.trim()))
    .filter(([busId]) => busId);
  if (!legs.length) return NextResponse.json({ error: 'Indique os autocarros (b)' }, { status: 400 });
  waitUntil(maybeCheckArrivals());

  try {
    if (legs.length === 1 && !legs[0][2]) {
      return NextResponse.json({ autocarro: await followBus(legs[0][0], legs[0][1] || params.get('paragem')) });
    }
    if (legs.some((l) => l.length < 3 || !l[1] || !l[2])) {
      return NextResponse.json({ error: 'Cada autocarro precisa de BUS~DE~PARA' }, { status: 400 });
    }
    const viagem = await followJourney({
      legs: legs.map(([busId, from, to]): LegSpec => ({ busId, from, to })),
      position,
      startId: params.get('de'),
      endId: params.get('para'),
      active: Number(params.get('a') ?? 0) || 0,
      onBoard: params.get('bordo') === '1',
    });
    return NextResponse.json({ viagem });
  } catch (error) {
    if (error instanceof FollowError) return NextResponse.json({ error: error.message }, { status: 404 });
    console.error('Erro ao acompanhar viagem:', error);
    return NextResponse.json({ error: 'Erro ao acompanhar viagem' }, { status: 500 });
  }
}
