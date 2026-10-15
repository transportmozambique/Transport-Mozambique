import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const [
      totalTransportes,
      totalVias,
      totalParagens,
      totalProprietarios,
      totalMotoristas,
      totalProvincias,
      totalMunicipios,
      totalUtentes,
      transportComMotorista,
      transportSemMotorista,
      motoristasAtivos,
      utentesSubscritos
    ] = await Promise.all([
      prisma.transporte.count(),
      prisma.via.count(),
      prisma.paragem.count(),
      prisma.proprietario.count(),
      prisma.motorista.count(),
      prisma.provincia.count(),
      prisma.municipio.count(),
      prisma.utente.count(),
      prisma.transporte.count({ where: {motorista: { isNot: null } } }),
      prisma.transporte.count({ where: {motorista: { is: null } } }),
      prisma.motorista.count({ where: { status: 'ativo' } }),
      prisma.utente.count({ where: { subscrito: true } })
    ]);

    const response = NextResponse.json({
      totalTransportes,
      totalVias,
      totalParagens,
      totalProprietarios,
      totalMotoristas,
      totalProvincias,
      totalMunicipios,
      totalUtentes,
      transportComMotorista,
      transportSemMotorista,
      motoristasAtivos,
      utentesSubscritos
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;
  } catch (error) {
    console.error('Error fetching stats:', error);
    const response = NextResponse.json({
      totalTransportes: 0,
      totalVias: 0,
      totalParagens: 0,
      totalProprietarios: 0,
      totalMotoristas: 0,
      totalProvincias: 0,
      totalMunicipios: 0,
      totalUtentes: 0,
      transportComMotorista: 0,
      transportSemMotorista: 0,
      motoristasAtivos: 0,
      utentesSubscritos: 0
    }, { status: 200 });

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } finally {
    await prisma.$disconnect();
  }
}