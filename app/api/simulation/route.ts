import { NextRequest, NextResponse } from 'next/server';
import {
  initializeBusPositions,
  startBusSimulation,
  stopBusSimulation,
  getSimulationStatus,
} from '@/lib/busSimulator';

// Inicializar posições ao carregar o módulo
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await initializeBusPositions();
    initialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureInitialized();
    const status = getSimulationStatus();

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, interval } = await request.json();

    await ensureInitialized();

    if (action === 'start') {
      const intervalMs = interval || 30000; // 30 segundos por padrão
      startBusSimulation(intervalMs);

      return NextResponse.json({
        success: true,
        message: 'Simulação iniciada',
        interval: intervalMs,
      });
    } else if (action === 'stop') {
      stopBusSimulation();

      return NextResponse.json({
        success: true,
        message: 'Simulação parada',
      });
    } else {
      return NextResponse.json(
        { error: 'Ação inválida. Use "start" ou "stop"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
