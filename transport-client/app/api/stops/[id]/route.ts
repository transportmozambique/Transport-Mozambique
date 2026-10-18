import { NextRequest, NextResponse } from 'next/server';
import { reachFrom, stopDestinations } from '@/lib/journeys';
import { maybeCheckArrivals } from '@/lib/busSimulator';
import { waitUntil } from '@vercel/functions';

/**
 * As vias de uma paragem, o próximo autocarro de cada sentido e as paragens a que se chega sem
 * mudar de autocarro, e (`destinos`) todos os locais a que se chega a partir dela, com
 * transbordos, a chegada mais cedo primeiro.
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
