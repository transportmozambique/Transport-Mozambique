import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Fetch municipios
    const municipios = await prisma.municipio.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
    });

    // Fetch vias with their municipio relationship
    const vias = await prisma.via.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
        municipioId: true,
        municipio: {
          select: {
            nome: true,
          },
        },
      },
    });

    // Group vias by municipio
    const viasByMunicipio: Record<string, any[]> = {};
    vias.forEach(via => {
      if (!viasByMunicipio[via.municipioId]) {
        viasByMunicipio[via.municipioId] = [];
      }
      viasByMunicipio[via.municipioId].push({
        id: via.id,
        nome: via.nome,
        codigo: via.codigo,
      });
    });

    return NextResponse.json({
      success: true,
      municipios: municipios.map(m => ({
        id: m.id,
        nome: m.nome,
        codigo: m.codigo,
        viasCount: viasByMunicipio[m.id]?.length || 0,
        vias: viasByMunicipio[m.id] || [],
      })),
      totalVias: vias.length,
      totalMunicipios: municipios.length,
    });
  } catch (error: any) {
    console.error('Error in test-data:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
