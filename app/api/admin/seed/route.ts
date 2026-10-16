import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST (wipe and reseed the database) was removed: it ran with no authentication.
// Seed a local database with `npm run db:seed` instead.

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
      message: transportCount === 0 ? 'Database is empty. Run npm run db:seed to populate.' : 'Database is populated.',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
