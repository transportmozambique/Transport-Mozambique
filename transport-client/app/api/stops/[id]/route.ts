import { NextRequest, NextResponse } from 'next/server';
import { reachFrom, stopDestinations } from '@/lib/journeys';
import { maybeCheckArrivals } from '@/lib/busSimulator';
import { waitUntil } from '@vercel/functions';

/**
 * A stop's routes, each direction's next bus and the stops reachable without changing bus, and
 * (`destinos`) every place reachable from it, with changes of bus, earliest arrival first.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [destinations, destinos] = await Promise.all([stopDestinations(id), reachFrom([id])]);
    if (!destinations) return NextResponse.json({ error: 'Paragem não encontrada' }, { status: 404 });
    waitUntil(maybeCheckArrivals());
    return NextResponse.json({ ...destinations, destinos: destinos ?? [] });
  } catch (error) {
    console.error('Erro ao ler destinos da paragem:', error);
    return NextResponse.json({ error: 'Erro ao ler destinos' }, { status: 500 });
  }
}
