import { NextRequest, NextResponse } from 'next/server';
import { loadNetwork, planJourneys } from '@/lib/journeys';
import { maybeCheckArrivals } from '@/lib/busSimulator';
import { waitUntil } from '@vercel/functions';

/**
 * Journeys to `to` with changes of bus when no single bus goes there. Starts at `from`, or,
 * with `lat` and `lng`, at the passenger's position (the journey starts with a walk).
 * `from` and `to` are stop ids; several, comma-separated, stand for one place.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ids = (name: string) => (params.get(name) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const from = ids('from');
  const to = ids('to');
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const position = params.has('lat') && params.has('lng') && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
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
