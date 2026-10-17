import { NextRequest, NextResponse } from 'next/server';
import { reachFrom } from '@/lib/journeys';
import { maybeCheckArrivals } from '@/lib/busSimulator';
import { waitUntil } from '@vercel/functions';

/**
 * Every place reachable from a start, earliest arrival first, with the stop where the first bus
 * is taken: A (the start) → B (that stop) → C (each destination). The start is `lat` and `lng`
 * (the passenger's position or a point they picked) or `from`: stop ids, several for one place.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = (params.get('from') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const position = params.has('lat') && params.has('lng') && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? ([lat, lng] as [number, number])
    : null;
  if (!position && !from.length) {
    return NextResponse.json({ error: 'Indique a partida (from, ou lat e lng)' }, { status: 400 });
  }

  try {
    const destinos = await reachFrom(position ?? from);
    if (!destinos) return NextResponse.json({ error: 'Paragem não encontrada' }, { status: 404 });
    waitUntil(maybeCheckArrivals());
    return NextResponse.json({ destinos });
  } catch (error) {
    console.error('Erro ao listar destinos:', error);
    return NextResponse.json({ error: 'Erro ao listar destinos' }, { status: 500 });
  }
}
