import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toStoredPath } from '@/lib/routeOrder';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const countOnly = searchParams.get('countOnly') === 'true';

    // Nome, código ou município, sem distinguir maiúsculas (o que a caixa de pesquisa da lista promete)
    const whereClause = search ? {
      OR: [
        { nome: { contains: search, mode: 'insensitive' as const } },
        { codigo: { contains: search, mode: 'insensitive' as const } },
        { municipio: { is: { nome: { contains: search, mode: 'insensitive' as const } } } },
      ],
    } : {};

    // Quando só se pede a contagem, devolver só a contagem
    if (countOnly) {
      const total = await prisma.via.count({ where: whereClause });
      return NextResponse.json({ total });
    }

    const skip = (page - 1) * limit;

    // Totais de todas as vias que coincidem, não só desta página (os contadores da lista)
    const [vias, total, totalTransportes, totalParagens] = await Promise.all([
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
      prisma.transporte.count({ where: search ? { via: { is: whereClause } } : { viaId: { not: null } } }),
      prisma.viaParagem.count({ where: search ? { via: whereClause } : {} }),
    ]);

    return NextResponse.json({
      data: vias,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      totals: {
        transportes: totalTransportes,
        paragens: totalParagens,
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
    console.log('POST /api/vias: a criar uma via nova');
    
    const body = await request.json();
    console.log('Corpo do pedido:', JSON.stringify(body, null, 2));
    
    const { nome, codigo, cor, terminalPartida, terminalChegada, municipioId, geoLocationPath, paragensIds } = body;

    // Validation
    if (!nome || !codigo || !municipioId || !geoLocationPath) {
      console.error('Validação falhou: campos em falta:', { nome: !!nome, codigo: !!codigo, municipioId: !!municipioId, geoLocationPath: !!geoLocationPath });
      return NextResponse.json(
        { error: 'Campos obrigatórios em falta: nome, codigo, municipioId, geoLocationPath' },
        { status: 400 }
      );
    }

    // Guardado como "lng,lat;lng,lat;..." seja o que for que o formulário enviou: as aplicações, o
    // horário dos autocarros e as tarifas só lêem esse formato.
    const storedPath = toStoredPath(geoLocationPath);
    if (!storedPath) {
      return NextResponse.json(
        { error: 'O percurso da via precisa de pelo menos dois pontos válidos' },
        { status: 400 }
      );
    }

    if (await prisma.via.findUnique({ where: { codigo }, select: { id: true } })) {
      return NextResponse.json(
        { error: `Já existe uma via com o código "${codigo}"` },
        { status: 400 }
      );
    }

    console.log('A ligar à base de dados...');
    
    // Test database connection
    try {
      await prisma.$connect();
      console.log('Ligado à base de dados');
    } catch (connError) {
      console.error('A ligação à base de dados falhou:', connError);
      return NextResponse.json(
        { 
          error: 'Falha ao ligar à base de dados',
          details: connError instanceof Error ? connError.message : 'Erro de ligação desconhecido'
        },
        { status: 503 }
      );
    }

    console.log('A ler o município para o código...');
    
    // O código do município
    const municipio = await prisma.municipio.findUnique({
      where: { id: municipioId },
      select: { codigo: true },
    });

    if (!municipio) {
      console.error('Município não encontrado:', municipioId);
      return NextResponse.json(
        { error: 'Município não encontrado' },
        { status: 404 }
      );
    }

    console.log('A criar a via na base de dados...');
    
    // Criar a via com as ligações às paragens
    const via = await prisma.via.create({
      data: {
        nome,
        codigo,
        cor: cor || '#3B82F6',
        terminalPartida: terminalPartida || '',
        terminalChegada: terminalChegada || '',
        geoLocationPath: storedPath,
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

    console.log('Via criada:', via.id);

    // Criar as ligações ViaParagem, quando há paragensIds
    if (paragensIds && paragensIds.length > 0) {
      console.log('A criar', paragensIds.length, 'ViaParagem associations...');
      
      // Os códigos das paragens escolhidas
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

      // Criar as linhas ViaParagem
      const viaParagens = await prisma.viaParagem.createMany({
        data: paragens.map((paragem) => ({
          viaId: via.id,
          paragemId: paragem.id,
          codigoVia: via.codigo,
          codigoParagem: paragem.codigo,
          terminalBoolean: false,
        })),
      });

      console.log('Criadas', viaParagens.count, 'ViaParagem associations');
    }

    // Ler a via outra vez com as paragens
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

    console.log('Via criada com', viaWithParagens?.paragens.length || 0, 'paragens');
    return NextResponse.json(viaWithParagens, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar via:', error);
    console.error('Pilha do erro:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        error: 'Falha ao criar a via',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      },
      { status: 500 }
    );
  } finally {
    // Não desligar em desenvolvimento (dá problemas com o recarregamento)
    if (process.env.NODE_ENV === 'production') {
      await prisma.$disconnect();
    }
  }
}
