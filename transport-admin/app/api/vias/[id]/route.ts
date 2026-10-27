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
    // Aceitar params como Promise ou directo (compatibilidade com o Next.js 15+)
    const params = await Promise.resolve(context.params);
    console.log('A ler a via com o id:', params.id);
    
    // Ler a via com todos os dados relacionados
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
      console.log('Via não encontrada:', params.id);
      return NextResponse.json(
        { error: 'Via não encontrada' },
        { status: 404 }
      );
    }

    // Paragens pela ordem de viagem (a ordem dos ids não é)
    via.paragens = orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation);

    // Velocidade de viagem da regra de tarifa activa: as posições em viagem e todas as estimativas de tempo usam-na
    const tarifa = await prisma.tarifa.findFirst({ where: { ativa: true }, orderBy: { updatedAt: 'desc' } });

    return NextResponse.json({ ...via, velocidadeViagemKmh: tarifa?.velocidadeViagemKmh ?? 30 }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    console.error('Erro ao carregar via:', error);
    console.error('Mensagem do erro:', error.message);
    console.error('Código do erro:', error.code);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
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
    const { nome, terminalPartida, terminalChegada, cor, municipioId, paragensIds, geoLocationPath, ativa } = body;

    // Dados básicos da via
    const updateData: any = {};
    // Um percurso novo (Vias → Percurso), guardado como "lng,lat;lng,lat;..." como na criação
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
    // Activar ou desactivar: só as rotas activas aparecem na web, no USSD e nos SMS
    if (typeof ativa === 'boolean') updateData.ativa = ativa;
    
    // O município, quando dado
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

    // As paragens da via passam a ser exactamente paragensIds. As ligações que ficam mantêm-se como
    // estão (também a marca de terminal); só as removidas são apagadas e as novas criadas.
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

    // Ler a via actualizada com as paragens
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
    console.error('Erro ao actualizar via:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
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
    
    // A via existe?
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

    // Desassociar todos os transportes desta via (viaId a null)
    if (via._count.transportes > 0) {
      await prisma.transporte.updateMany({
        where: { viaId: params.id },
        data: { viaId: null as any },
      });
    }

    // Apagar a via (as ligações às paragens apagam-se sozinhas, onDelete: Cascade)
    await prisma.via.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao apagar via:', error);
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
