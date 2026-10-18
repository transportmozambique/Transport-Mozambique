import { NextResponse } from 'next/server';
import { orderStopsAlongRoute, toStoredPath } from '@/lib/routeOrder';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (Next.js 15+ compatibility)
    const params = await Promise.resolve(context.params);
    console.log('Fetching via with id:', params.id);
    
    // Fetch via with all related data
    const via = await prisma.via.findUnique({
      where: {
        id: params.id,
      },
      include: {
        municipio: {
          select: {
            id: true,
            nome: true,
          },
        },
        paragens: {
          include: {
            paragem: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                geoLocation: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
        transportes: {
          select: {
            id: true,
            matricula: true,
            modelo: true,
            marca: true,
            codigo: true,
            motorista: {
              select: {
                nome: true,
              },
            },
          },
          orderBy: {
            codigo: 'asc',
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

    if (!via) {
      console.log('Via not found:', params.id);
      return NextResponse.json(
        { error: 'Via não encontrada' },
        { status: 404 }
      );
    }

    // Stops in travel order (their id order is not)
    via.paragens = orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation);

    // Travel speed of the active fare rule: the timetable and every time estimate use it
    const tarifa = await prisma.tarifa.findFirst({ where: { ativa: true }, orderBy: { updatedAt: 'desc' } });

    return NextResponse.json({ ...via, velocidadeViagemKmh: tarifa?.velocidadeViagemKmh ?? 30 }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    console.error('Error fetching via:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
        code: error.code || 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const body = await request.json();
    const { nome, terminalPartida, terminalChegada, cor, municipioId, paragensIds, geoLocationPath } = body;

    // Update via basic info
    const updateData: any = {};
    // A new path (Vias → Percurso), stored as "lng,lat;lng,lat;..." like on creation
    if (geoLocationPath !== undefined) {
      const storedPath = toStoredPath(geoLocationPath);
      if (!storedPath) {
        return NextResponse.json(
          { error: 'O percurso da via precisa de pelo menos dois pontos válidos' },
          { status: 400 }
        );
      }
      updateData.geoLocationPath = storedPath;
    }
    if (nome) updateData.nome = nome;
    if (terminalPartida) updateData.terminalPartida = terminalPartida;
    if (terminalChegada) updateData.terminalChegada = terminalChegada;
    if (cor) updateData.cor = cor;
    
    // Update município if provided
    if (municipioId) {
      updateData.municipio = {
        connect: { id: municipioId }
      };
    }

    const via = await prisma.via.update({
      where: {
        id: params.id,
      },
      data: updateData,
    });

    // The route's stops become exactly paragensIds. Links that stay are kept as they are (their
    // terminal flag too); only the removed ones are deleted and the new ones created.
    if (paragensIds !== undefined && Array.isArray(paragensIds)) {
      const ids = paragensIds.filter((id: unknown): id is string => typeof id === 'string');
      await prisma.viaParagem.deleteMany({
        where: { viaId: params.id, paragemId: { notIn: ids } },
      });
      const linked = new Set(
        (await prisma.viaParagem.findMany({ where: { viaId: params.id }, select: { paragemId: true } })).map((vp) => vp.paragemId)
      );
      const missing = ids.filter((id) => !linked.has(id));
      if (missing.length > 0) {
        const paragens = await prisma.paragem.findMany({
          where: { id: { in: missing } },
          select: { id: true, codigo: true },
        });
        await prisma.viaParagem.createMany({
          data: paragens.map((paragem) => ({
            viaId: params.id,
            paragemId: paragem.id,
            codigoVia: via.codigo,
            codigoParagem: paragem.codigo,
            terminalBoolean: false,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Fetch updated via with paragens
    const updatedVia = await prisma.via.findUnique({
      where: { id: params.id },
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

    return NextResponse.json(updatedVia);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Via não encontrada' }, { status: 404 });
    }
    console.error('Error updating via:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    
    // Check if via exists
    const via = await prisma.via.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            transportes: true,
            paragens: true,
          },
        },
      },
    });

    if (!via) {
      return NextResponse.json(
        { error: 'Via não encontrada' },
        { status: 404 }
      );
    }

    // Desassociar todos os transportes desta via (set viaId to null)
    if (via._count.transportes > 0) {
      await prisma.transporte.updateMany({
        where: { viaId: params.id },
        data: { viaId: null as any },
      });
    }

    // Delete via (paragens will be deleted automatically due to onDelete: Cascade)
    await prisma.via.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting via:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao eliminar via',
        details: error.message,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
