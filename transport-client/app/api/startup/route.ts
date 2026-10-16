import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getSimulationStatus, maybeCheckArrivals } from '@/lib/busSimulator';

/**
 * Called by the home page when it opens. Positions need no start-up any more (they are
 * computed on read, see lib/vehiclePosition.ts); this only triggers the arrival SMS check and
 * reports how positions are produced.
 */
export async function GET() {
  try {
    waitUntil(maybeCheckArrivals());
    return NextResponse.json({ success: true, status: await getSimulationStatus() });
  } catch (error) {
    console.error('❌ Erro no startup:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
