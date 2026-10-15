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
      const total = await prisma.proprietario.count({
        where: search ? {
          OR: [
            { nome: { contains: search } },
            { bi: { contains: search } },
          ],
        } : {},
      });

      return NextResponse.json({ total });
    }

    const skip = (page - 1) * limit;

    const whereClause = search ? {
      OR: [
        { nome: { contains: search } },
        { bi: { contains: search } },
      ],
    } : {};

    const [proprietarios, total] = await Promise.all([
      prisma.proprietario.findMany({
        where: whereClause,
        include: {
          transportes: true,
        },
        orderBy: {
          nome: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.proprietario.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data: proprietarios,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar proprietários:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar proprietários' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      nome,
      bi,
      nacionalidade,
      birthDate,
      endereco,
      contacto1,
      contacto2,
      tipoProprietario,
    } = body;

    // Validação
    if (!nome || !bi || !nacionalidade || !birthDate || !endereco || !contacto1) {
      return NextResponse.json(
        { error: 'Campos obrigatórios em falta' },
        { status: 400 }
      );
    }

    // Verificar se o BI já existe
    const existingProprietario = await prisma.proprietario.findUnique({
      where: { bi },
    });

    if (existingProprietario) {
      return NextResponse.json(
        { error: `Já existe um proprietário com o BI "${bi}". Por favor, use um BI diferente.` },
        { status: 400 }
      );
    }

    // Criar proprietário
    const proprietario = await prisma.proprietario.create({
      data: {
        nome,
        bi,
        nacionalidade,
        birthDate: new Date(birthDate),
        endereco,
        contacto1: parseInt(contacto1),
        contacto2: contacto2 ? parseInt(contacto2) : null,
        tipoProprietario: tipoProprietario || 'Indivíduo',
      },
    });

    return NextResponse.json(proprietario, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar proprietário:', error);
    
    // Handle Prisma unique constraint errors
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'campo';
      return NextResponse.json(
        { error: `Já existe um proprietário com este ${field}. Por favor, use um valor diferente.` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erro ao criar proprietário', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
