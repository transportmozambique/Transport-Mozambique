import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Totals for the "Estatísticas Gerais" report
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
      motoristasAtivos,
      utentesSubscritos,
    ] = await Promise.all([
      prisma.transporte.count(),
      prisma.via.count(),
      prisma.paragem.count(),
      prisma.proprietario.count(),
      prisma.motorista.count(),
      prisma.provincia.count(),
      prisma.municipio.count(),
      prisma.utente.count(),
      prisma.transporte.count({ where: { motorista: { isNot: null } } }),
      prisma.motorista.count({ where: { status: 'ativo' } }),
      prisma.utente.count({ where: { subscrito: true } }),
    ]);

    return NextResponse.json({
      totalTransportes,
      totalVias,
      totalParagens,
      totalProprietarios,
      totalMotoristas,
      totalProvincias,
      totalMunicipios,
      totalUtentes,
      transportComMotorista,
      transportSemMotorista: totalTransportes - transportComMotorista,
      motoristasAtivos,
      utentesSubscritos,
    });
  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error);
    return NextResponse.json({ error: 'Erro ao calcular estatísticas' }, { status: 500 });
  }
}
