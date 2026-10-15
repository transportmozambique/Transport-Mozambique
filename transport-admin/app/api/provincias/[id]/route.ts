import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const provincia = await prisma.provincia.findUnique({
      where: { id },
      include: {
        municipios: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            _count: {
              select: {
                vias: true,
              },
            },
          },
        },
      },
    });

    if (!provincia) {
      return NextResponse.json(
        { error: 'Província não encontrada' },
        { status: 404 }
      );
    }

    // Get all vias from all municípios in this província
    const vias = await prisma.via.findMany({
      where: {
        municipio: {
          provinciaId: id,
        },
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
        geoLocationPath: true,
        cor: true,
      },
    });

    // Get paragens count for each município (through vias)
    const municipiosWithCounts = await Promise.all(
      provincia.municipios.map(async (m) => {
        const paragensCount = await prisma.viaParagem.count({
          where: {
            via: {
              municipioId: m.id,
            },
          },
        });

        return {
          ...m,
          _count: {
            vias: m._count.vias,
            paragens: paragensCount,
          },
        };
      })
    );

    return NextResponse.json({
      ...provincia,
      municipios: municipiosWithCounts,
      vias: vias,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar província' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const provincia = await prisma.provincia.update({
      where: { id },
      data: {
        nome: body.nome,
        codigo: body.codigo,
        ...(body.geoLocation && { geoLocation: body.geoLocation }),
      },
    });

    return NextResponse.json(provincia);
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao atualizar província' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    
    // Check if província has associated municípios
    const provincia = await prisma.provincia.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            municipios: true,
          },
        },
      },
    });

    if (!provincia) {
      return NextResponse.json(
        { error: 'Província não encontrada' },
        { status: 404 }
      );
    }

    if (!force && provincia._count.municipios > 0) {
      return NextResponse.json(
        { 
          error: 'Não é possível eliminar província com municípios associados',
          details: `Esta província tem ${provincia._count.municipios} ${provincia._count.municipios === 1 ? 'município' : 'municípios'} ${provincia._count.municipios === 1 ? 'associado' : 'associados'}.`
        },
        { status: 400 }
      );
    }

    // If force=true, remove associations first
    if (force) {
      // Set provinciaId to null for all municípios
      await prisma.municipio.updateMany({
        where: { provinciaId: id },
        data: { provinciaId: null as any },
      });
    }

    await prisma.provincia.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting província:', error);
    return NextResponse.json(
      { error: 'Erro ao eliminar província' },
      { status: 500 }
    );
  }
}
