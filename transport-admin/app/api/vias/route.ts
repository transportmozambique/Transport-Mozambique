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
      const total = await prisma.via.count({
        where: search ? {
          OR: [
            { nome: { contains: search } },
            { codigo: { contains: search } },
          ],
        } : {},
      });

      return NextResponse.json({ total });
    }

    const skip = (page - 1) * limit;

    const whereClause = search ? {
      OR: [
        { nome: { contains: search } },
        { codigo: { contains: search } },
      ],
    } : {};

    const [vias, total] = await Promise.all([
      prisma.via.findMany({
        where: whereClause,
        include: {
          municipio: {
            select: {
              nome: true,
            },
          },
          _count: {
            select: {
              paragens: true,
              transportes: true,
            },
          },
        },
        orderBy: {
          nome: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.via.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data: vias,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar vias:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar vias' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log('POST /api/vias - Creating new via');
    
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    const { nome, codigo, cor, terminalPartida, terminalChegada, municipioId, geoLocationPath, paragensIds } = body;

    // Validation
    if (!nome || !codigo || !municipioId || !geoLocationPath) {
      console.error('Validation failed - missing fields:', { nome: !!nome, codigo: !!codigo, municipioId: !!municipioId, geoLocationPath: !!geoLocationPath });
      return NextResponse.json(
        { error: 'Missing required fields: nome, codigo, municipioId, geoLocationPath' },
        { status: 400 }
      );
    }

    console.log('Attempting to connect to database...');
    
    // Test database connection
    try {
      await prisma.$connect();
      console.log('Database connected successfully');
    } catch (connError) {
      console.error('Database connection failed:', connError);
      return NextResponse.json(
        { 
          error: 'Failed to connect to database',
          details: connError instanceof Error ? connError.message : 'Unknown connection error'
        },
        { status: 503 }
      );
    }

    console.log('Fetching municipio to get codigo...');
    
    // Get municipio codigo
    const municipio = await prisma.municipio.findUnique({
      where: { id: municipioId },
      select: { codigo: true },
    });

    if (!municipio) {
      console.error('Municipio not found:', municipioId);
      return NextResponse.json(
        { error: 'Município não encontrado' },
        { status: 404 }
      );
    }

    console.log('Creating via in database...');
    
    // Create via with paragens associations
    const via = await prisma.via.create({
      data: {
        nome,
        codigo,
        cor: cor || '#3B82F6',
        terminalPartida: terminalPartida || '',
        terminalChegada: terminalChegada || '',
        geoLocationPath,
        municipioId,
        codigoMunicipio: municipio.codigo,
      },
      include: {
        municipio: true,
        paragens: {
          include: {
            paragem: true,
          },
        },
        _count: {
          select: {
            paragens: true,
            transportes: true,
          },
        },
      },
    });

    console.log('Via created successfully:', via.id);

    // Create ViaParagem associations if paragensIds provided
    if (paragensIds && paragensIds.length > 0) {
      console.log('Creating', paragensIds.length, 'ViaParagem associations...');
      
      // Get paragem codes for the selected paragens
      const paragens = await prisma.paragem.findMany({
        where: {
          id: {
            in: paragensIds,
          },
        },
        select: {
          id: true,
          codigo: true,
        },
      });

      // Create ViaParagem records
      const viaParagens = await prisma.viaParagem.createMany({
        data: paragens.map((paragem) => ({
          viaId: via.id,
          paragemId: paragem.id,
          codigoVia: via.codigo,
          codigoParagem: paragem.codigo,
          terminalBoolean: false,
        })),
      });

      console.log('Created', viaParagens.count, 'ViaParagem associations');
    }

    // Fetch the via again with paragens included
    const viaWithParagens = await prisma.via.findUnique({
      where: { id: via.id },
      include: {
        municipio: true,
        paragens: {
          include: {
            paragem: true,
          },
        },
        _count: {
          select: {
            paragens: true,
            transportes: true,
          },
        },
      },
    });

    console.log('Via created with', viaWithParagens?.paragens.length || 0, 'paragens');
    return NextResponse.json(viaWithParagens, { status: 201 });
  } catch (error) {
    console.error('Error creating via:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        error: 'Failed to create via',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      },
      { status: 500 }
    );
  } finally {
    // Don't disconnect in development (causes issues with hot reload)
    if (process.env.NODE_ENV === 'production') {
      await prisma.$disconnect();
    }
  }
}
