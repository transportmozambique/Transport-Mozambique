import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Guardar as estatísticas 5 minutos para aliviar a base de dados (o painel abre muitas vezes, os números mudam devagar)
let cachedStats: any = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos em milissegundos

export async function GET() {
  // Devolver o que está guardado enquanto é válido
  const now = Date.now();
  if (cachedStats && (now - cacheTime) < CACHE_DURATION) {
    return NextResponse.json(cachedStats);
  }
  
  try {
    // Contagens de todas as entidades: simples e rápidas
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
      prisma.via.count({ where: { ativa: true } }), // as rotas que os passageiros vêem
      prisma.paragem.count(),
      prisma.motorista.count(),
      prisma.motorista.count({ where: { status: 'ativo', transporteId: { not: null } } }),
      prisma.transporte.count({ where: { motorista: null } }),
      prisma.provincia.count(),
      prisma.municipio.count()
    ]);

    // Municípios com o número de transportes
    const municipioStats = await prisma.$queryRaw<Array<{ nome: string; count: bigint }>>`
      SELECT m.nome, COUNT(DISTINCT t.id)::int as count
      FROM "Municipio" m
      LEFT JOIN "Via" v ON v."municipioId" = m.id
      LEFT JOIN "Transporte" t ON t."viaId" = v.id
      GROUP BY m.id, m.nome
      HAVING COUNT(DISTINCT t.id) > 0
      ORDER BY count DESC
    `;

    // Percentagens por município
    const totalTransports = municipioStats.reduce((sum, m) => sum + Number(m.count), 0);
    const municipioData = municipioStats.map(m => ({
      name: m.nome,
      count: Number(m.count),
      percentage: totalTransports > 0 ? Math.round((Number(m.count) / totalTransports) * 100) : 0
    }));

    // Distribuição das vias por município
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

    // Distribuição das paragens por município
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

    // As vias activas com o número de transportes e as coordenadas (também as vias sem transportes):
    // o mapa do início mostra a rede que os passageiros vêem
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
      WHERE v."ativa" = true
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

    // Guardar a resposta
    cachedStats = responseData;
    cacheTime = Date.now();

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Erro ao carregar as estatísticas do painel:', error);
    
    // Dar uma mensagem de erro mais detalhada
    let errorMessage = 'Falha ao carregar as estatísticas do painel';
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
