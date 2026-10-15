import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get counts of all tables
    const [
      proprietarioCount,
      transporteCount,
      viaCount,
      paragemCount,
      motoristaCount,
      municipioCount,
    ] = await Promise.all([
      prisma.proprietario.count().catch((e) => ({ error: e.message })),
      prisma.transporte.count().catch((e) => ({ error: e.message })),
      prisma.via.count().catch((e) => ({ error: e.message })),
      prisma.paragem.count().catch((e) => ({ error: e.message })),
      prisma.motorista.count().catch((e) => ({ error: e.message })),
      prisma.municipio.count().catch((e) => ({ error: e.message })),
    ]);
    
    // Get sample proprietario with error details
    let sampleProprietario = null;
    let proprietarioError = null;
    try {
      sampleProprietario = await prisma.proprietario.findFirst();
    } catch (e: any) {
      proprietarioError = {
        message: e.message,
        code: e.code,
        meta: e.meta,
      };
    }
    
    // Get sample transporte
    const sampleTransporte = await prisma.transporte.findFirst().catch(() => null);
    
    return NextResponse.json({
      status: 'connected',
      environment: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL ? 
        `${process.env.DATABASE_URL.split('@')[0].split('//')[1].split(':')[0]}@${process.env.DATABASE_URL.split('@')[1]?.split('/')[0]}` : 
        'not set',
      counts: {
        proprietario: proprietarioCount,
        transporte: transporteCount,
        via: viaCount,
        paragem: paragemCount,
        motorista: motoristaCount,
        municipio: municipioCount,
      },
      samples: {
        proprietario: sampleProprietario ? {
          id: sampleProprietario.id,
          nome: sampleProprietario.nome,
          bi: sampleProprietario.bi,
          fields: Object.keys(sampleProprietario),
        } : null,
        proprietarioError,
        transporte: sampleTransporte ? {
          id: sampleTransporte.id,
          matricula: sampleTransporte.matricula,
        } : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5),
      },
      { status: 500 }
    );
  }
}
