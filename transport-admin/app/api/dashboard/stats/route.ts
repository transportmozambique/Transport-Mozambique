import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Cache the stats for 5 minutes to reduce database load
let cachedStats: any = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export async function GET() {
  // Return cached data if still valid
  const now = Date.now();
  if (cachedStats && (now - cacheTime) < CACHE_DURATION) {
    return NextResponse.json(cachedStats);
  }
  
  try {
    // Get counts for all entities - these are simple and fast
    const [
      transportesCount,
      proprietariosCount,
      viasCount,
      paragensCount,
      motoristasCount,
      motoristasActivosCount,
      transportesSemMotoristaCount,
      provinciasCount,
      municipiosCount
    ] = await Promise.all([
      prisma.transporte.count(),
      prisma.proprietario.count(),
      prisma.via.count(),
      prisma.paragem.count(),
      prisma.motorista.count(),
      prisma.motorista.count({ where: { status: 'ativo', transporteId: { not: null } } }),
      prisma.transporte.count({ where: { motorista: null } }),
      prisma.provincia.count(),
      prisma.municipio.count()
    ]);

    // Get municipios data with transport counts
    const municipioStats = await prisma.$queryRaw<Array<{ nome: string; count: bigint }>>`
      SELECT m.nome, COUNT(DISTINCT t.id)::int as count
      FROM "Municipio" m
      LEFT JOIN "Via" v ON v."municipioId" = m.id
      LEFT JOIN "Transporte" t ON t."viaId" = v.id
      GROUP BY m.id, m.nome
      HAVING COUNT(DISTINCT t.id) > 0
      ORDER BY count DESC
    `;

    // Calculate percentages for municipios
    const totalTransports = municipioStats.reduce((sum, m) => sum + Number(m.count), 0);
    const municipioData = municipioStats.map(m => ({
      name: m.nome,
      count: Number(m.count),
      percentage: totalTransports > 0 ? Math.round((Number(m.count) / totalTransports) * 100) : 0
    }));

    // Get vias distribution by municipio
    const viasPorMunicipio = await prisma.$queryRaw<Array<{ nome: string; vias: bigint }>>`
      SELECT m.nome, COUNT(v.id)::int as vias
      FROM "Municipio" m
      LEFT JOIN "Via" v ON v."municipioId" = m.id
      GROUP BY m.id, m.nome
      HAVING COUNT(v.id) > 0
      ORDER BY vias DESC
    `;

    const viasMunicipioData = viasPorMunicipio.map(m => ({
      name: m.nome,
      count: Number(m.vias)
    }));

    // Get paragens distribution by municipio
    const paragensPorMunicipio = await prisma.$queryRaw<Array<{ nome: string; paragens: bigint }>>`
      SELECT m.nome, COUNT(DISTINCT p.id)::int as paragens
      FROM "Municipio" m
      LEFT JOIN "Via" v ON v."municipioId" = m.id
      LEFT JOIN "ViaParagem" vp ON vp."viaId" = v.id
      LEFT JOIN "Paragem" p ON p.id = vp."paragemId"
      GROUP BY m.id, m.nome
      HAVING COUNT(DISTINCT p.id) > 0
      ORDER BY paragens DESC
    `;

    const paragensMunicipioData = paragensPorMunicipio.map(m => ({
      name: m.nome,
      count: Number(m.paragens)
    }));

    // Get ALL vias with transport counts and coordinates (including vias with 0 transportes)
    const viasComTransportes = await prisma.$queryRaw<Array<{ 
      id: string;
      nome: string; 
      count: bigint; 
      cor: string;
      geoLocationPath: string;
      terminalPartida: string;
      terminalChegada: string;
    }>>`
      SELECT v.id, v.nome, v.cor, v."geoLocationPath", v."terminalPartida", v."terminalChegada", COUNT(DISTINCT t.id)::int as count
      FROM "Via" v
      LEFT JOIN "Transporte" t ON t."viaId" = v.id
      GROUP BY v.id, v.nome, v.cor, v."geoLocationPath", v."terminalPartida", v."terminalChegada"
      ORDER BY count DESC, v.nome ASC
    `;

    const viasData = viasComTransportes.map(v => ({
      id: v.id,
      name: v.nome,
      count: Number(v.count),
      color: v.cor,
      path: v.geoLocationPath,
      start: v.terminalPartida,
      end: v.terminalChegada
    }));

    const responseData = {
      stats: {
        transportes: transportesCount,
        proprietarios: proprietariosCount,
        vias: viasCount,
        paragens: paragensCount,
        motoristas: motoristasCount,
        motoristasActivos: motoristasActivosCount,
        transportesSemMotorista: transportesSemMotoristaCount,
        provincias: provinciasCount,
        municipios: municipiosCount
      },
      municipioData,
      viasData,
      viasMunicipioData,
      paragensMunicipioData
    };

    // Cache the response
    cachedStats = responseData;
    cacheTime = Date.now();

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    
    // Provide more detailed error message
    let errorMessage = 'Failed to fetch dashboard statistics';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        stats: null,
        municipioData: [],
        viasData: [],
        viasMunicipioData: [],
        paragensMunicipioData: []
      },
      { status: 500 }
    );
  }
}
