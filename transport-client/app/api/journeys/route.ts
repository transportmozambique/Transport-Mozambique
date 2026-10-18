import { NextRequest, NextResponse } from 'next/server';
import { loadNetwork, planJourneys } from '@/lib/journeys';
import { maybeCheckArrivals } from '@/lib/busSimulator';
import { waitUntil } from '@vercel/functions';

/**
 * Journeys to `to` with changes of bus when no single bus goes there. Starts at `from`, or,
 * with `lat` and `lng`, at the passenger's position (the journey starts with a walk).
 * `from` and `to` are stop ids; several, comma-separated (or an array in a POST body), stand
 * for one place.
 *
 * POST with a JSON body is what the app uses: a position in a GET query would be kept in the
 * request logs. GET with the same fields in the query still works.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return plan({ from: params.get('from'), to: params.get('to'), lat: params.get('lat'), lng: params.get('lng') });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return plan(body && typeof body === 'object' ? body : {});
}

type Input = { from?: unknown; to?: unknown; lat?: unknown; lng?: unknown };

const ids = (value: unknown) =>
  (Array.isArray(value) ? value.map(String) : String(value ?? '').split(',')).map((s) => s.trim()).filter(Boolean);

async function plan(input: Input) {
  const from = ids(input.from);
  const to = ids(input.to);
  const hasPoint = input.lat !== null && input.lat !== undefined && input.lat !== '' && input.lng !== null && input.lng !== undefined && input.lng !== '';
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  const position = hasPoint && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? ([lat, lng] as [number, number])
    : null;
  if ((!from.length && !position) || !to.length) {
    return NextResponse.json({ error: 'Indique a partida (from, ou lat e lng) e o destino (to)' }, { status: 400 });
  }

  try {
    const net = await loadNetwork();
    const origem = position ? null : net.stops.get(from[0]);
    const destino = net.stops.get(to[0]);
    if ((!position && !origem) || !destino) return NextResponse.json({ error: 'Paragem não encontrada' }, { status: 404 });

    const opcoes = await planJourneys(position ?? from, to);
    waitUntil(maybeCheckArrivals());
    return NextResponse.json({
      origem: origem
        ? { id: origem.id, nome: origem.nome, lat: origem.point[0], lng: origem.point[1] }
        : { id: '', nome: 'A sua localização', lat: position![0], lng: position![1] },
      destino: { id: destino.id, nome: destino.nome, lat: destino.point[0], lng: destino.point[1] },
      opcoes,
    });
  } catch (error) {
    console.error('Erro ao planear viagem:', error);
    return NextResponse.json({ error: 'Erro ao planear viagem' }, { status: 500 });
  }
}
