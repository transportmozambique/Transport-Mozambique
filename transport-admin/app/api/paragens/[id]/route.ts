import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const paragem = await prisma.paragem.findUnique({
      where: { id },
      include: {
        vias: {
          include: {
            via: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                cor: true,
              },
            },
          },
        },
      },
    });

    if (!paragem) {
      return NextResponse.json(
        { error: 'Paragem não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(paragem);
  } catch (error) {
    console.error('Error fetching paragem:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar paragem' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nome, codigo, geoLocation, viaIds } = body;

    // Update paragem
    const paragem = await prisma.paragem.update({
      where: { id },
      data: {
        nome,
        codigo,
        geoLocation,
        // If viaIds provided, update via associations
        ...(viaIds && {
          vias: {
            deleteMany: {}, // Remove all existing associations
            create: viaIds.map((viaId: string) => ({
              via: { connect: { id: viaId } },
              codigoParagem: codigo,
              codigoVia: '', // Will be filled by trigger or needs to be fetched
              terminalBoolean: false,
            })),
          },
        }),
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

    return NextResponse.json(paragem);
  } catch (error) {
    console.error('Error updating paragem:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar paragem' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('[DELETE /api/paragens/[id]] Received delete request for id:', id);

    // Check if paragem exists
    const paragem = await prisma.paragem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            vias: true,
            missoes: true,
          },
        },
      },
    });

    if (!paragem) {
      console.log('[DELETE /api/paragens/[id]] Paragem not found:', id);
      return NextResponse.json(
        { error: 'Paragem não encontrada' },
        { status: 404 }
      );
    }

    console.log('[DELETE /api/paragens/[id]] Paragem found:', paragem.nome);
    console.log('[DELETE /api/paragens/[id]] Vias count:', paragem._count.vias);
    console.log('[DELETE /api/paragens/[id]] Missoes count:', paragem._count.missoes);

    // Note: ViaParagem has onDelete: Cascade, so they will be deleted automatically
    // Missoes might need to be handled depending on business logic

    // Delete paragem (cascades to ViaParagem)
    console.log('[DELETE /api/paragens/[id]] Attempting to delete paragem...');
    await prisma.paragem.delete({
      where: { id },
    });

    console.log('[DELETE /api/paragens/[id]] Paragem deleted successfully');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/paragens/[id]] Error deleting paragem:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao eliminar paragem',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
