import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const municipio = await prisma.municipio.findUnique({
      where: { id },
      include: {
        provincia: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
        vias: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            geoLocationPath: true,
            cor: true,
          },
        },
      },
    });

    if (!municipio) {
      return NextResponse.json(
        { error: 'Município não encontrado' },
        { status: 404 }
      );
    }

    // As paragens, através de ViaParagem
    const paragens = await prisma.paragem.findMany({
      where: {
        vias: {
          some: {
            via: {
              municipioId: id,
            },
          },
        },
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
      distinct: ['id'],
    });

    return NextResponse.json({
      ...municipio,
      paragens,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar município' },
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

    // Converter contacto1 com cuidado
    let contacto1Value = null;
    if (body.contacto1 !== undefined && body.contacto1 !== null && body.contacto1 !== '') {
      if (typeof body.contacto1 === 'number') {
        contacto1Value = body.contacto1;
      } else if (typeof body.contacto1 === 'string') {
        const cleaned = body.contacto1.replace(/\D/g, '');
        contacto1Value = cleaned ? parseInt(cleaned) : null;
      }
    }

    const updateData: any = {
      nome: body.nome,
      codigo: body.codigo,
    };

    // Add optional fields
    if (body.provinciaId !== undefined) {
      updateData.provincia = body.provinciaId ? {
        connect: { id: body.provinciaId }
      } : {
        disconnect: true
      };
    }

    if (body.geoLocation !== undefined) {
      updateData.geoLocation = body.geoLocation || null;
    }

    if (body.endereco !== undefined) {
      updateData.endereco = body.endereco || null;
    }

    if (body.contacto1 !== undefined) {
      updateData.contacto1 = contacto1Value;
    }

    const municipio = await prisma.municipio.update({
      where: { id },
      data: updateData,
      include: {
        provincia: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
      },
    });

    return NextResponse.json(municipio);
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao atualizar município' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // O município tem vias?
    const municipio = await prisma.municipio.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            vias: true,
          },
        },
      },
    });

    if (!municipio) {
      return NextResponse.json(
        { error: 'Município não encontrado' },
        { status: 404 }
      );
    }

    // Count paragens through vias
    const paragensCount = await prisma.viaParagem.count({
      where: {
        via: {
          municipioId: id,
        },
      },
    });

    // Cada via tem de pertencer a um município (Via.municipioId é obrigatório), por isso `force`
    // não as pode desligar: as vias têm de ser movidas ou apagadas primeiro
    if (municipio._count.vias > 0 || paragensCount > 0) {
      return NextResponse.json(
        {
          error: 'Não é possível eliminar município com vias ou paragens associadas',
          details: `Este município tem ${municipio._count.vias} ${municipio._count.vias === 1 ? 'via' : 'vias'} e ${paragensCount} ${paragensCount === 1 ? 'paragem' : 'paragens'} associadas. Mova as vias para outro município ou elimine-as primeiro.`
        },
        { status: 400 }
      );
    }

    await prisma.municipio.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting município:', error);
    return NextResponse.json(
      { error: 'Erro ao eliminar município' },
      { status: 500 }
    );
  }
}
