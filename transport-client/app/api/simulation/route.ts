import { NextRequest, NextResponse } from 'next/server';
import { checkAndNotifyUsers, getSimulationStatus } from '@/lib/busSimulator';

// GET: como são produzidas as posições (GPS real, ou a viagem do motorista) e a última verificação de chegadas.
export async function GET() {
  try {
    return NextResponse.json({ success: true, status: await getSimulationStatus() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// POST {"action": "check"}: corre agora a verificação dos SMS de chegada (o cronjob do cron-job.org a cada minuto e o GitHub Actions chamam-no; ver docs/guia-cron-job.md).
// As posições não precisam de arranque nem paragem: vêm do GPS real ou da viagem do motorista a cada leitura.
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json().catch(() => ({ action: null }));
    if (action !== 'check') {
      return NextResponse.json(
        { error: 'Ação inválida. Use "check". As posições são calculadas em cada pedido (GPS real, ou a viagem do motorista).' },
        { status: 400 }
      );
    }
    const notified = await checkAndNotifyUsers();
    return NextResponse.json({ success: true, notified, status: await getSimulationStatus() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
