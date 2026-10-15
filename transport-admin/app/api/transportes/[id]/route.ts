import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    // Parse currGeoLocation to latitude/longitude
    let latitude = -25.9655;
    let longitude = 32.5892;
    if (transporte.currGeoLocation) {
      try {
        const [lat, lng] = transporte.currGeoLocation.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          latitude = lat;
          longitude = lng;
        }
      } catch (e) {
        // Use default values if parsing fails
      }
    }

    // Parse via's geoLocationPath to routeCoords
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
        
        // If no valid coords, set to undefined
        if (routeCoords.length === 0) {
          routeCoords = undefined;
        }
      } catch (e) {
        routeCoords = undefined;
      }
    }

    // Parse transporte's routePath if it exists and via route doesn't
    if (!routeCoords && transporte.routePath && transporte.routePath.trim()) {
      try {
        routeCoords = transporte.routePath
          .split(';')
          .map(coord => {
            const [lng, lat] = coord.trim().split(',').map(Number);
            return [lng, lat] as [number, number];
          })
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
        
        // If no valid coords, set to undefined
        if (routeCoords.length === 0) {
          routeCoords = undefined;
        }
      } catch (e) {
        routeCoords = undefined;
      }
    }

    return NextResponse.json({
      ...transporte,
      latitude,
      longitude,
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

    // Check if transporte exists
    const existingTransporte = await prisma.transporte.findUnique({
      where: { id },
    });

    if (!existingTransporte) {
      return NextResponse.json(
        { error: 'Transporte não encontrado' },
        { status: 404 }
      );
    }

    // Check if matricula is already used by another transporte
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

    // Build currGeoLocation from latitude/longitude if provided
    let currGeoLocation = existingTransporte.currGeoLocation;
    if (body.latitude !== undefined && body.longitude !== undefined) {
      currGeoLocation = `${body.latitude},${body.longitude}`;
    }

    // Get via's codigo if viaId is being updated
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

    // Parse currGeoLocation to latitude/longitude
    let latitude = -25.9655;
    let longitude = 32.5892;
    if (transporte.currGeoLocation) {
      const [lat, lng] = transporte.currGeoLocation.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        latitude = lat;
        longitude = lng;
      }
    }

    // Parse via's geoLocationPath to routeCoords
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
        // If parsing fails, routeCoords remains undefined
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if transporte exists and has motorista or proprietarios
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

    await prisma.transporte.delete({
      where: { id },
    });

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
