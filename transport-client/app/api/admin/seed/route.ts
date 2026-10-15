import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Proteção básica - só permite se tiver o secret correto
    const { authorization } = await request.json();
    
    if (authorization !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid admin secret' },
        { status: 401 }
      );
    }

    console.log('🌱 Starting database seed...');

    // Importar e executar o seed
    const { main } = await import('../../../../prisma/seed');
    await main();

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully! 25 buses created.',
    });
  } catch (error: any) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed database',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// GET endpoint para verificar status
export async function GET() {
  try {
    const transportCount = await prisma.transporte.count();
    const viaCount = await prisma.via.count();
    const paragemCount = await prisma.paragem.count();

    return NextResponse.json({
      status: 'ok',
      database: {
        transportes: transportCount,
        vias: viaCount,
        paragens: paragemCount,
      },
      message: transportCount === 0 ? 'Database is empty. Run POST /api/admin/seed to populate.' : 'Database is populated.',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
