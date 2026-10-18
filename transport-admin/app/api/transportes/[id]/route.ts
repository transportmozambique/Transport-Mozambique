import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { positionSummary } from '@/lib/vehiclePosition';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const transporte = await prisma.transporte.findUnique({
      where: { id },
      include: {
        via: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            terminalPartida: true,
            terminalChegada: true,
            geoLocationPath: true,
            paragens: { select: { paragem: { select: { nome: true, geoLocation: true } } } },
          },
        },
        motorista: {
          select: {
            id: true,
            nome: true,
            bi: true,
            telefone: true,
            email: true,
            foto: true,
          },
        },
        proprietarios: {
          include: {
            proprietario: {
              select: {
                id: true,
                nome: true,
                bi: true,
                nacionalidade: true,
                endereco: true,
                contacto1: true,
                contacto2: true,
              },
            },
          },
        },
      },
    });

    if (!transporte) {
      return NextResponse.json(
        { error: 'Transporte não encontrado' },
        { status: 404 }
      );
    }

    // Onde está agora: GPS real quando recente, senão a posição pelo horário na via
    const posicao = await positionSummary(transporte, transporte.via);
    const latitude = posicao?.latitude ?? -25.9655;
    const longitude = posicao?.longitude ?? 32.5892;

    // Ler o geoLocationPath da via para routeCoords
    let routeCoords: [number, number][] | undefined;
    if (transporte.via?.geoLocationPath && transporte.via.geoLocationPath.trim()) {
      try {
        routeCoords = transporte.via.geoLocationPath
          .split(';')
          .map(coord => {
            const [lng, lat] = coord.trim().split(',').map(Number);
            return [lng, lat] as [number, number];
          })
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
        
        // Sem coordenadas válidas, fica undefined
        if (routeCoords.length === 0) {
          routeCoords = undefined;
        }
      } catch (e) {
        routeCoords = undefined;
      }
    }

    // Ler o routePath do transporte quando existe e a via não tem percurso
    if (!routeCoords && transporte.routePath && transporte.routePath.trim()) {
      try {
        routeCoords = transporte.routePath
          .split(';')
          .map(coord => {
            const [lng, lat] = coord.trim().split(',').map(Number);
            return [lng, lat] as [number, number];
          })
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
        
        // Sem coordenadas válidas, fica undefined
        if (routeCoords.length === 0) {
          routeCoords = undefined;
        }
      } catch (e) {
        routeCoords = undefined;
      }
    }

    // O hash do código do dispositivo fica no servidor
    const { gpsDispositivoHash, ...publico } = transporte;
    return NextResponse.json({
      ...publico,
      gpsConfigurado: Boolean(gpsDispositivoHash),
      latitude,
      longitude,
      posicao,
      routeCoords,
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'Erro ao buscar transporte',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // O transporte existe?
    const existingTransporte = await prisma.transporte.findUnique({
      where: { id },
    });

    if (!existingTransporte) {
      return NextResponse.json(
        { error: 'Transporte não encontrado' },
        { status: 404 }
      );
    }

    // A matrícula já é usada por outro transporte?
    if (body.matricula && body.matricula !== existingTransporte.matricula) {
      const matriculaExists = await prisma.transporte.findUnique({
        where: { matricula: body.matricula },
      });

      if (matriculaExists) {
        return NextResponse.json(
          { error: 'Já existe um transporte com esta matrícula' },
          { status: 400 }
        );
      }
    }

    // Montar currGeoLocation a partir de latitude/longitude, quando dadas
    let currGeoLocation = existingTransporte.currGeoLocation;
    if (body.latitude !== undefined && body.longitude !== undefined) {
      currGeoLocation = `${body.latitude},${body.longitude}`;
    }

    // O código da via, quando viaId muda
    let codigoVia = existingTransporte.codigoVia;
    if (body.viaId && body.viaId !== existingTransporte.viaId) {
      const via = await prisma.via.findUnique({
        where: { id: body.viaId },
        select: { codigo: true },
      });
      if (via) {
        codigoVia = via.codigo;
      }
    }

    const transporte = await prisma.transporte.update({
      where: { id },
      data: {
        matricula: body.matricula || existingTransporte.matricula,
        modelo: body.modelo || existingTransporte.modelo,
        marca: body.marca || existingTransporte.marca,
        cor: body.cor || existingTransporte.cor,
        lotacao: body.lotacao !== undefined ? body.lotacao : existingTransporte.lotacao,
        viaId: body.viaId || existingTransporte.viaId,
        codigoVia: codigoVia,
        currGeoLocation: currGeoLocation,
      },
      include: {
        via: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            geoLocationPath: true,
          },
        },
        motorista: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    // Ler currGeoLocation para latitude/longitude
    let latitude = -25.9655;
    let longitude = 32.5892;
    if (transporte.currGeoLocation) {
      const [lat, lng] = transporte.currGeoLocation.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        latitude = lat;
        longitude = lng;
      }
    }

    // Ler o geoLocationPath da via para routeCoords
    let routeCoords: [number, number][] | undefined;
    if (transporte.via?.geoLocationPath) {
      try {
        routeCoords = transporte.via.geoLocationPath
          .split(';')
          .map(coord => {
            const [lng, lat] = coord.split(',').map(Number);
            return [lng, lat] as [number, number];
          })
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
      } catch (e) {
        // Se a leitura falhar, routeCoords fica undefined
      }
    }

    return NextResponse.json({
      ...transporte,
      latitude,
      longitude,
      routeCoords,
    });
  } catch (error: any) {
    
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'campo';
      return NextResponse.json(
        { error: `Já existe um transporte com este ${field}` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erro ao atualizar transporte', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH: muda o veículo para outra via, ou tira-o da sua via ({ viaId: null }).
// Usado pelo "Atribuir Transportes" e pelos botões de remover das páginas das vias.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !('viaId' in body) || (body.viaId !== null && typeof body.viaId !== 'string')) {
    return NextResponse.json({ error: 'viaId (id de uma via, ou null) é obrigatório' }, { status: 400 });
  }

  let codigoVia = '';
  if (body.viaId) {
    const via = await prisma.via.findUnique({ where: { id: body.viaId }, select: { codigo: true } });
    if (!via) return NextResponse.json({ error: 'Via não encontrada' }, { status: 404 });
    codigoVia = via.codigo;
  }

  try {
    const transporte = await prisma.transporte.update({
      where: { id },
      data: { viaId: body.viaId, codigoVia },
      select: { id: true, matricula: true, viaId: true, codigoVia: true },
    });
    return NextResponse.json(transporte);
  } catch {
    return NextResponse.json({ error: 'Transporte não encontrado' }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // O transporte existe e tem motorista ou proprietários?
    const transporte = await prisma.transporte.findUnique({
      where: { id },
      include: {
        motorista: true,
        proprietarios: true,
      },
    });

    if (!transporte) {
      return NextResponse.json(
        { error: 'Transporte não encontrado' },
        { status: 404 }
      );
    }

    if (transporte.motorista) {
      return NextResponse.json(
        { 
          error: 'Não é possível eliminar transporte com motorista atribuído',
          details: `Este transporte tem o motorista ${transporte.motorista.nome} atribuído. Por favor, remova a atribuição primeiro.`
        },
        { status: 400 }
      );
    }

    if (transporte.proprietarios.length > 0) {
      return NextResponse.json(
        { 
          error: 'Não é possível eliminar transporte com proprietários atribuídos',
          details: 'Por favor, remova todos os proprietários primeiro.'
        },
        { status: 400 }
      );
    }

    // As linhas GeoLocation vêm da importação inicial e bloqueiam o apagar (chave estrangeira
    // sem cascata); as posições vivem agora no próprio Transporte, por isso vão com ele
    await prisma.$transaction([
      prisma.geoLocation.deleteMany({ where: { transporteId: id } }),
      prisma.transporte.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'Erro ao eliminar transporte',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
