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
      const total = await prisma.provincia.count({
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

    const [provincias, total] = await Promise.all([
      prisma.provincia.findMany({
        where: whereClause,
        select: {
          id: true,
          nome: true,
          codigo: true,
          _count: {
            select: {
              municipios: true,
            },
          },
        },
        orderBy: {
          nome: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.provincia.count({ where: whereClause }),
    ]);

    // Get counts for vias and transportes for each provincia
    const provinciasWithCounts = await Promise.all(
      provincias.map(async (provincia) => {
        const [viasCount, transportesCount] = await Promise.all([
          prisma.via.count({
            where: {
              municipio: {
                provinciaId: provincia.id,
              },
            },
          }),
          prisma.transporte.count({
            where: {
              via: {
                municipio: {
                  provinciaId: provincia.id,
                },
              },
            },
          }),
        ]);

        return {
          id: provincia.id,
          nome: provincia.nome,
          codigo: provincia.codigo,
          municipios: provincia._count.municipios,
          vias: viasCount,
          transportes: transportesCount,
        };
      })
    );

    return NextResponse.json({
      data: provinciasWithCounts,
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
        error: 'Erro ao buscar províncias',
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
    if (!body.nome || !body.codigo) {
      return NextResponse.json(
        { error: 'Nome e código são obrigatórios' },
        { status: 400 }
      );
    }

    // Check if codigo already exists
    const existing = await prisma.provincia.findUnique({
      where: { codigo: body.codigo },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe uma província com este código' },
        { status: 400 }
      );
    }

    const provincia = await prisma.provincia.create({
      data: {
        nome: body.nome,
        codigo: body.codigo,
        geoLocation: body.geoLocation || '-25.9655,32.5892',
      },
    });

    return NextResponse.json(provincia, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Erro ao criar província',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
