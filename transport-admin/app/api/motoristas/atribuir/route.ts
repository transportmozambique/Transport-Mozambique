import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Buscar transportes sem motorista e motoristas disponíveis
export async function GET() {
  try {
    // Buscar transportes sem motorista
    const transportesSemMotorista = await prisma.transporte.findMany({
      where: {
        motorista: null
      },
      include: {
        via: {
          select: {
            nome: true,
            cor: true
          }
        }
      },
      orderBy: {
        codigo: 'asc'
      }
    });

    // Buscar motoristas disponíveis (ativos e sem transporte)
    const motoristasDisponiveis = await prisma.motorista.findMany({
      where: {
        status: 'ativo',
        transporteId: null
      },
      orderBy: {
        nome: 'asc'
      }
    });

    // Buscar todos os motoristas para estatísticas
    const totalMotoristas = await prisma.motorista.count();
    const motoristasAtivos = await prisma.motorista.count({
      where: { status: 'ativo' }
    });
    const motoristasComTransporte = await prisma.motorista.count({
      where: { transporteId: { not: null } }
    });

    return NextResponse.json({
      transportesSemMotorista,
      motoristasDisponiveis,
      stats: {
        totalMotoristas,
        motoristasAtivos,
        motoristasComTransporte,
        motoristasDisponiveis: motoristasDisponiveis.length,
        transportesSemMotorista: transportesSemMotorista.length
      }
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

// POST - Atribuir motorista a transporte
export async function POST(request: Request) {
  try {
    const { motoristaId, transporteId } = await request.json();

    if (!motoristaId || !transporteId) {
      return NextResponse.json(
        { error: 'motoristaId e transporteId são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o motorista está disponível
    const motorista = await prisma.motorista.findUnique({
      where: { id: motoristaId }
    });

    if (!motorista) {
      return NextResponse.json(
        { error: 'Motorista não encontrado' },
        { status: 404 }
      );
    }

    if (motorista.transporteId) {
      return NextResponse.json(
        { error: 'Motorista já está atribuído a outro transporte' },
        { status: 400 }
      );
    }

    if (motorista.status !== 'ativo') {
      return NextResponse.json(
        { error: 'Motorista não está ativo' },
        { status: 400 }
      );
    }

    // Verificar se o transporte existe e está sem motorista
    const transporte = await prisma.transporte.findUnique({
      where: { id: transporteId },
      include: { motorista: true }
    });

    if (!transporte) {
      return NextResponse.json(
        { error: 'Transporte não encontrado' },
        { status: 404 }
      );
    }

    if (transporte.motorista) {
      return NextResponse.json(
        { error: 'Transporte já tem um motorista atribuído' },
        { status: 400 }
      );
    }

    // Atribuir motorista ao transporte
    const motoristaAtualizado = await prisma.motorista.update({
      where: { id: motoristaId },
      data: { transporteId: transporteId }
    });

    return NextResponse.json({
      success: true,
      motorista: motoristaAtualizado,
      message: 'Motorista atribuído com sucesso'
    });
  } catch (error) {
    console.error('Error assigning driver:', error);
    return NextResponse.json(
      { error: 'Failed to assign driver' },
      { status: 500 }
    );
  }
}

// DELETE - Remover atribuição de motorista
export async function DELETE(request: Request) {
  try {
    const { motoristaId } = await request.json();

    if (!motoristaId) {
      return NextResponse.json(
        { error: 'motoristaId é obrigatório' },
        { status: 400 }
      );
    }

    // Remover atribuição
    const motoristaAtualizado = await prisma.motorista.update({
      where: { id: motoristaId },
      data: { transporteId: null as any }
    });

    return NextResponse.json({
      success: true,
      motorista: motoristaAtualizado,
      message: 'Atribuição removida com sucesso'
    });
  } catch (error) {
    console.error('Error removing assignment:', error);
    return NextResponse.json(
      { error: 'Failed to remove assignment' },
      { status: 500 }
    );
  }
}
