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
    console.error('Erro ao carregar paragem:', error);
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

    // Com viaIds, substituir as ligações às vias, mantendo os códigos e as marcas de terminal
    let vias;
    if (Array.isArray(viaIds)) {
      const [current, rows] = await Promise.all([
        prisma.paragem.findUnique({
          where: { id },
          select: { codigo: true, vias: { select: { viaId: true, terminalBoolean: true } } },
        }),
        prisma.via.findMany({ where: { id: { in: viaIds } }, select: { id: true, codigo: true } }),
      ]);
      if (!current) {
        return NextResponse.json({ error: 'Paragem não encontrada' }, { status: 404 });
      }
      const terminal = new Map(current.vias.map((v) => [v.viaId, v.terminalBoolean]));
      vias = {
        deleteMany: {},
        create: rows.map((via) => ({
          via: { connect: { id: via.id } },
          codigoParagem: codigo || current.codigo,
          codigoVia: via.codigo,
          terminalBoolean: terminal.get(via.id) ?? false,
        })),
      };
    }

    // Guardar a paragem
    const paragem = await prisma.paragem.update({
      where: { id },
      data: { nome, codigo, geoLocation, ...(vias && { vias }) },
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
    console.error('Erro ao actualizar paragem:', error);
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
    console.log('[DELETE /api/paragens/[id]] Pedido para apagar o id:', id);

    // A paragem existe?
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
      console.log('[DELETE /api/paragens/[id]] Paragem não encontrada:', id);
      return NextResponse.json(
        { error: 'Paragem não encontrada' },
        { status: 404 }
      );
    }

    console.log('[DELETE /api/paragens/[id]] Paragem encontrada:', paragem.nome);
    console.log('[DELETE /api/paragens/[id]] Número de vias:', paragem._count.vias);
    console.log('[DELETE /api/paragens/[id]] Número de alertas:', paragem._count.missoes);

    // As ligações ViaParagem apagam-se em cascata. Os alertas de chegada (MISSION) nesta paragem
    // nunca mais disparariam e bloqueariam o apagar (chave estrangeira), por isso vão com ela.
    await prisma.$transaction([
      prisma.mISSION.deleteMany({ where: { paragemId: id } }),
      prisma.paragem.delete({ where: { id } }),
    ]);

    console.log('[DELETE /api/paragens/[id]] Paragem apagada');
    return NextResponse.json({ success: true, alertasRemovidos: paragem._count.missoes });
  } catch (error: any) {
    console.error('[DELETE /api/paragens/[id]] Erro ao apagar paragem:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao eliminar paragem',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
