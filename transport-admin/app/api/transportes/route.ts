import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const availableOnly = searchParams.get('availableOnly') === 'true';
    const includeTransportId = searchParams.get('includeTransportId') || null;
    const limit = parseInt(searchParams.get('limit') || '1000');

    let whereClause: any = {};

    // Filter only transportes without motorista if requested
    if (availableOnly) {
      if (includeTransportId) {
        // Show available transportes OR the specific transport (even if it has a motorista)
        whereClause.OR = [
          { motoristaId: null },
          { id: includeTransportId }
        ];
      } else {
        whereClause.motoristaId = null;
      }
    }

    const transportes = await prisma.transporte.findMany({
      where: whereClause,
      include: {
        via: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
        motorista: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: {
        matricula: 'asc',
      },
      take: limit,
    });

    return NextResponse.json({
      data: transportes,
      total: transportes.length,
    });
  } catch (error) {
    console.error('Erro ao buscar transportes:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar transportes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validação de campos obrigatórios
    if (!body.matricula || !body.modelo || !body.marca || !body.viaId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios em falta: matricula, modelo, marca, viaId' },
        { status: 400 }
      );
    }

    // Verificar se matrícula já existe
    const existingMatricula = await prisma.transporte.findUnique({
      where: { matricula: body.matricula },
    });

    if (existingMatricula) {
      return NextResponse.json(
        { error: 'Já existe um transporte com esta matrícula' },
        { status: 400 }
      );
    }

    // Verificar se a via existe
    const via = await prisma.via.findUnique({
      where: { id: body.viaId },
    });

    if (!via) {
      return NextResponse.json(
        { error: 'Via não encontrada' },
        { status: 404 }
      );
    }

    // Criar localização inicial
    const currGeoLocation = `${body.latitude || -25.9655},${body.longitude || 32.5892}`;

    // Gerar código único para o transporte (número inteiro baseado em timestamp)
    const codigo = parseInt(Date.now().toString().slice(-9)); // Últimos 9 dígitos do timestamp

    const transporte = await prisma.transporte.create({
      data: {
        codigo,
        matricula: body.matricula,
        modelo: body.modelo,
        marca: body.marca,
        cor: body.cor || 'Branco',
        lotacao: body.lotacao || 50,
        viaId: body.viaId,
        codigoVia: via.codigo,
        currGeoLocation,
        routePath: null,
      },
      include: {
        via: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
      },
    });

    return NextResponse.json(transporte, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar transporte:', error);
    
    // Handle Prisma unique constraint errors
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'campo';
      return NextResponse.json(
        { error: `Já existe um transporte com este ${field}` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erro ao criar transporte', details: error.message },
      { status: 500 }
    );
  }
}
