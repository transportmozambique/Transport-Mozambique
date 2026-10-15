import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test database connection
    await prisma.$connect();
    
    // Get counts of all tables
    const [
      adminCount,
      proprietarioCount,
      transporteCount,
      viaCount,
      paragemCount,
    ] = await Promise.all([
      prisma.administrador.count().catch(() => 0),
      prisma.proprietario.count().catch(() => 0),
      prisma.transporte.count().catch(() => 0),
      prisma.via.count().catch(() => 0),
      prisma.paragem.count().catch(() => 0),
    ]);
    
    // Get schema info
    const sampleProprietario = await prisma.proprietario.findFirst();
    
    return NextResponse.json({
      status: 'connected',
      database: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown',
      counts: {
        administrador: adminCount,
        proprietario: proprietarioCount,
        transporte: transporteCount,
        via: viaCount,
        paragem: paragemCount,
      },
      sampleProprietarioFields: sampleProprietario ? Object.keys(sampleProprietario) : [],
      prismaClientLocation: 'root prisma/schema.prisma',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
