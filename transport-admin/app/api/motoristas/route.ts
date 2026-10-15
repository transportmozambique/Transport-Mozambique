import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const countOnly = searchParams.get('countOnly') === 'true';
    const filter = searchParams.get('filter') || null;

    // If only count is requested, return just the counts
    if (countOnly) {
      const total = await prisma.motorista.count();
      
      const ativos = await prisma.motorista.count({
        where: { status: 'ativo' },
      });
      
      const inativos = await prisma.motorista.count({
        where: { status: 'inativo' },
      });
      
      const comTransporte = await prisma.motorista.count({
        where: { transporteId: { not: null } },
      });

      return NextResponse.json({
        total,
        ativos,
        inativos,
        comTransporte,
      });
    }

    const skip = (page - 1) * limit;

    // Build where clause based on search and filter
    let whereClause: any = {};
    
    if (search) {
      whereClause.OR = [
        { nome: { contains: search, mode: 'insensitive' as const } },
        { bi: { contains: search, mode: 'insensitive' as const } },
        { cartaConducao: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    // Apply filter
    if (filter === 'ativos') {
      whereClause.status = 'ativo';
    } else if (filter === 'inativos') {
      whereClause.status = 'inativo';
    } else if (filter === 'comTransporte') {
      whereClause.transporteId = { not: null };
    }

    const [motoristas, total] = await Promise.all([
      prisma.motorista.findMany({
        where: whereClause,
        include: {
          transporte: {
            select: {
              id: true,
              matricula: true,
              modelo: true,
              marca: true,
              proprietarios: {
                include: {
                  proprietario: {
                    select: {
                      id: true,
                      nome: true,
                      bi: true,
                      contacto1: true,
                    },
                  },
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
      prisma.motorista.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data: motoristas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar motoristas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar motoristas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validação de campos obrigatórios
    if (!body.nome || !body.bi || !body.cartaConducao || !body.telefone || 
        !body.email || !body.dataNascimento || !body.endereco || 
        !body.numeroEmergencia || !body.contatoEmergencia ||
        !body.dataEmissaoBI || !body.dataValidadeBI ||
        !body.dataEmissaoCarta || !body.dataValidadeCarta) {
      return NextResponse.json(
        { error: 'Campos obrigatórios em falta' },
        { status: 400 }
      );
    }

    // Verificar se BI já existe
    const existingBI = await prisma.motorista.findUnique({
      where: { bi: body.bi },
    });

    if (existingBI) {
      return NextResponse.json(
        { error: 'Já existe um motorista com este BI' },
        { status: 400 }
      );
    }

    // Verificar se carta de condução já existe
    const existingCarta = await prisma.motorista.findUnique({
      where: { cartaConducao: body.cartaConducao },
    });

    if (existingCarta) {
      return NextResponse.json(
        { error: 'Já existe um motorista com este número de carta de condução' },
        { status: 400 }
      );
    }

    // Verificar se email já existe
    const existingEmail = await prisma.motorista.findUnique({
      where: { email: body.email },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Já existe um motorista com este email' },
        { status: 400 }
      );
    }

    // Verificar se o transporte já está atribuído a outro motorista
    if (body.transporteId) {
      const existingTransporte = await prisma.motorista.findFirst({
        where: { transporteId: body.transporteId },
      });

      if (existingTransporte) {
        return NextResponse.json(
          { error: 'Este transporte já está atribuído a outro motorista' },
          { status: 400 }
        );
      }
    }

    const motorista = await prisma.motorista.create({
      data: {
        nome: body.nome,
        bi: body.bi,
        cartaConducao: body.cartaConducao,
        telefone: body.telefone,
        email: body.email,
        dataNascimento: new Date(body.dataNascimento),
        endereco: body.endereco,
        foto: body.foto || null,
        nacionalidade: body.nacionalidade || 'Moçambicana',
        genero: body.genero || 'Masculino',
        estadoCivil: body.estadoCivil || 'Solteiro',
        numeroEmergencia: body.numeroEmergencia,
        contatoEmergencia: body.contatoEmergencia,
        deficiencia: body.deficiencia || null,
        dataEmissaoBI: new Date(body.dataEmissaoBI),
        dataValidadeBI: new Date(body.dataValidadeBI),
        dataEmissaoCarta: new Date(body.dataEmissaoCarta),
        dataValidadeCarta: new Date(body.dataValidadeCarta),
        categoriaCarta: body.categoriaCarta || 'D',
        experienciaAnos: body.experienciaAnos || 0,
        observacoes: body.observacoes || null,
        status: body.status || 'ativo',
        transporteId: body.transporteId || null,
      },
      include: {
        transporte: {
          select: {
            id: true,
            matricula: true,
            modelo: true,
            marca: true,
          },
        },
      },
    });

    return NextResponse.json(motorista, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar motorista:', error);
    
    // Handle Prisma unique constraint errors
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'campo';
      return NextResponse.json(
        { error: `Já existe um motorista com este ${field}` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erro ao criar motorista', details: error.message },
      { status: 500 }
    );
  }
}
