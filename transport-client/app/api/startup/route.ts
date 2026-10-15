import { NextResponse } from 'next/server';
import {
  initializeBusPositions,
  startBusSimulation,
  getSimulationStatus,
} from '@/lib/busSimulator';

/**
 * Startup API - Auto-inicializa e inicia a simulação de autocarros
 * Chamado automaticamente quando o servidor inicia
 */

let startupComplete = false;

export async function GET() {
  try {
    // Evitar múltiplas inicializações
    if (startupComplete) {
      const status = getSimulationStatus();
      return NextResponse.json({
        success: true,
        message: 'Sistema já inicializado',
        status,
      });
    }

    console.log('🚀 Iniciando sistema de rastreamento...');

    // Inicializar posições dos autocarros
    await initializeBusPositions();

    // Iniciar simulação (atualiza a cada 30 segundos)
    startBusSimulation(30000);

    startupComplete = true;

    const status = getSimulationStatus();

    console.log('✅ Sistema de rastreamento iniciado com sucesso!');
    console.log(`   - ${status.busCount} autocarros em circulação`);
    console.log(`   - Atualização a cada 30 segundos`);

    return NextResponse.json({
      success: true,
      message: 'Sistema de rastreamento iniciado',
      status,
    });
  } catch (error: any) {
    console.error('❌ Erro ao iniciar sistema:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
