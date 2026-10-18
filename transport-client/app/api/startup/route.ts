import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getSimulationStatus, maybeCheckArrivals } from '@/lib/busSimulator';

/**
 * Chamado pela página inicial quando abre. As posições já não precisam de arranque (são
 * calculadas na leitura, ver lib/vehiclePosition.ts); isto só dispara a verificação dos SMS de
 * chegada e diz como são produzidas as posições.
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
