import { NextRequest, NextResponse } from 'next/server';
import { checkAndNotifyUsers, getSimulationStatus } from '@/lib/busSimulator';

// GET: how positions are produced (real GPS or timetable) and the last arrival check.
export async function GET() {
  try {
    return NextResponse.json({ success: true, status: await getSimulationStatus() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// POST {"action": "check"}: run the arrival SMS check now. Positions need no start or stop:
// they come from real GPS or from the timetable on every read.
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json().catch(() => ({ action: null }));
    if (action !== 'check') {
      return NextResponse.json(
        { error: 'Ação inválida. Use "check". As posições são calculadas em cada pedido (GPS real ou horário).' },
        { status: 400 }
      );
    }
    const notified = await checkAndNotifyUsers();
    return NextResponse.json({ success: true, notified, status: await getSimulationStatus() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
