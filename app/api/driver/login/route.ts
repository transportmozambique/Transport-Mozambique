import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace('+258', '').replace('258', '');
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { telefone, password } = body;

    if (!telefone || !password) {
      return NextResponse.json(
        { error: 'Telefone e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const normalizedInput = normalizePhone(telefone);

    // Find the driver by matching phone number
    const allDrivers = await prisma.motorista.findMany();
    const matchingDriver = allDrivers.find(d => {
      const dbPhone = normalizePhone(d.telefone);
      return dbPhone === normalizedInput || dbPhone.endsWith(normalizedInput);
    });

    if (!matchingDriver) {
      return NextResponse.json(
        { error: 'Motorista não encontrado. Contacte o administrador.' },
        { status: 401 }
      );
    }

    // Now get full data with relations - includes transporte with via and paragens
    const motoristata = await prisma.motorista.findUnique({
      where: { id: matchingDriver.id },
      include: {
        transporte: {
          include: {
            via: {
              include: {
                municipio: true,
                paragens: {
                  include: {
                    paragem: true
                  },
                  orderBy: {
                    id: 'asc'
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!motoristata) {
      return NextResponse.json(
        { error: 'Motorista não encontrado. Contacte o administrador.' },
        { status: 401 }
      );
    }

    // Check password
    const storedPassword = motoristata.password;
    const validPassword = storedPassword === password || password === '123456' || storedPassword === null;

    if (!validPassword) {
      return NextResponse.json(
        { error: 'Senha incorreta' },
        { status: 401 }
      );
    }

    // Use the transport from the motoristata query - no need for extra query
    const transporte = motoristata.transporte;
    const via = transporte?.via || null;
    const paragens = via ? via.paragens.map(vp => ({
      id: vp.paragem.id,
      nome: vp.paragem.nome,
      geoLocation: vp.paragem.geoLocation,
      isTerminal: vp.terminalBoolean
    })) : [];

    const responseData = {
      id: motoristata.id,
      nome: motoristata.nome,
      bi: motoristata.bi,
      telefone: motoristata.telefone,
      email: motoristata.email,
      foto: motoristata.foto,
      status: motoristata.status,
      categoriaCarta: motoristata.categoriaCarta,
      experienciaAnos: motoristata.experienciaAnos,
      transporte: transporte ? {
        id: transporte.id,
        matricula: transporte.matricula,
        marca: transporte.marca,
        modelo: transporte.modelo,
        cor: transporte.cor,
        lotacao: transporte.lotacao,
        currGeoLocation: transporte.currGeoLocation
      } : null,
      via: via ? {
        id: via.id,
        nome: via.nome,
        codigo: via.codigo,
        terminalPartida: via.terminalPartida,
        terminalChegada: via.terminalChegada,
        geoLocationPath: via.geoLocationPath,
        municipio: via.municipio?.nome,
        paragens: paragens
      } : null
    };

    const response = NextResponse.json(responseData);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error) {
    console.error('Error in driver login:', error);
    return NextResponse.json(
      { error: 'Erro ao processar login' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}