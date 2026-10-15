import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const countOnly = searchParams.get('countOnly') === 'true';

    // If only count is requested, return just the count
    if (countOnly) {
      const total = await prisma.municipio.count({
        where: search ? {
          OR: [
            { nome: { contains: search, mode: 'insensitive' as const } },
            { codigo: { contains: search, mode: 'insensitive' as const } },
          ],
        } : undefined,
      });
      return NextResponse.json({ total });
    }

    const skip = (page - 1) * limit;

    const whereClause = search ? {
      OR: [
        { nome: { contains: search, mode: 'insensitive' as const } },
        { codigo: { contains: search, mode: 'insensitive' as const } },
      ],
    } : undefined;

    const [municipios, total] = await Promise.all([
      prisma.municipio.findMany({
        where: whereClause,
        select: {
          id: true,
          nome: true,
          codigo: true,
          provinciaId: true,
          provincia: {
            select: {
              nome: true,
            },
          },
          _count: {
            select: {
              vias: true,
            },
          },
        },
        orderBy: {
          nome: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.municipio.count({ where: whereClause }),
    ]);

    // Get paragens count for each município (through vias)
    const transformedMunicipios = await Promise.all(
      municipios.map(async (m) => {
        // Count unique paragens associated with vias in this município
        const paragensCount = await prisma.viaParagem.count({
          where: {
            via: {
              municipioId: m.id,
            },
          },
        });

        return {
          id: m.id,
          nome: m.nome,
          codigo: m.codigo,
          provinciaId: m.provinciaId,
          provincia: m.provincia?.nome || 'N/A',
          vias: m._count.vias,
          paragens: paragensCount,
        };
      })
    );

    return NextResponse.json({
      data: transformedMunicipios,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Erro ao buscar municípios',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.nome || !body.codigo || !body.provinciaId) {
      return NextResponse.json(
        { error: 'Nome, código e província são obrigatórios' },
        { status: 400 }
      );
    }

    // Check if codigo already exists
    const existing = await prisma.municipio.findUnique({
      where: { codigo: body.codigo },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um município com este código' },
        { status: 400 }
      );
    }

    const municipio = await prisma.municipio.create({
      data: {
        nome: body.nome,
        codigo: body.codigo,
        provinciaId: body.provinciaId,
        geoLocation: body.geoLocation || null,
        endereco: body.endereco || null,
        contacto1: body.contacto1 || null,
      },
    });

    return NextResponse.json(municipio, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Erro ao criar município',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

