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
      const total = await prisma.paragem.count({
        where: search ? {
          OR: [
            { nome: { contains: search, mode: 'insensitive' as const } },
            { codigo: { contains: search, mode: 'insensitive' as const } },
          ],
        } : undefined,
      });

      // Also get terminal counts
      const terminais = await prisma.paragem.count({
        where: {
          vias: {
            some: {
              terminalBoolean: true,
            },
          },
        },
      });

      return NextResponse.json({
        total,
        terminais,
        paragensRegulares: total - terminais,
      });
    }

    const skip = (page - 1) * limit;

    const whereClause = search ? {
      OR: [
        { nome: { contains: search, mode: 'insensitive' as const } },
        { codigo: { contains: search, mode: 'insensitive' as const } },
      ],
    } : undefined;

    const [paragens, total] = await Promise.all([
      prisma.paragem.findMany({
        where: whereClause,
        include: {
          vias: {
            include: {
              via: {
                select: {
                  id: true,
                  nome: true,
                  codigo: true,
                },
              },
            },
          },
        },
        orderBy: {
          nome: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.paragem.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data: paragens,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching paragens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch paragens' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, codigo, geoLocation, viaIds, isTerminal } = body;

    // Validation
    if (!nome || !codigo || !geoLocation || !viaIds || viaIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if codigo already exists
    const existingParagem = await prisma.paragem.findUnique({
      where: { codigo },
    });

    if (existingParagem) {
      return NextResponse.json(
        { error: `Já existe uma paragem com o código "${codigo}". Por favor, use um código diferente.` },
        { status: 400 }
      );
    }

    // Fetch via codes for the selected vias
    const vias = await prisma.via.findMany({
      where: {
        id: {
          in: viaIds
        }
      },
      select: {
        id: true,
        codigo: true,
      }
    });

    // Create paragem with via associations
    const paragem = await prisma.paragem.create({
      data: {
        nome,
        codigo,
        geoLocation,
        vias: {
          create: vias.map((via) => ({
            codigoParagem: codigo,
            codigoVia: via.codigo,
            terminalBoolean: isTerminal || false,
            via: {
              connect: { id: via.id }
            },
          })),
        },
      },
      include: {
        vias: {
          include: {
            via: {
              select: {
                id: true,
                nome: true,
                codigo: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(paragem, { status: 201 });
  } catch (error: any) {
    console.error('Error creating paragem:', error);
    
    // Handle Prisma unique constraint errors
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'campo';
      return NextResponse.json(
        { error: `Já existe uma paragem com este ${field}. Por favor, use um valor diferente.` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erro ao criar paragem', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
