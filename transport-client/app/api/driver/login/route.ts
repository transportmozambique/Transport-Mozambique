import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { findDriverByPhone, verifyDriverPin } from '@/lib/driverTrips';
import { createDriverToken } from '@/lib/driverSession';
import { getFareRule, orderStopsAlongRoute } from '@/lib/fares';
import { vehicleGeo } from '@/lib/vehiclePosition';

// Called from the driver portal, which runs on another domain
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  try {
    const { telefone, password } = await request.json();

    if (!telefone || !password) {
      return json({ error: 'Telefone e senha são obrigatórios' }, 400);
    }

    const driver = await findDriverByPhone(String(telefone));
    if (!driver) {
      return json({ error: 'Motorista não encontrado. Contacte o administrador.' }, 401);
    }

    if (!driver.password) {
      return json({ error: 'Ainda não tem PIN. Peça ao administrador para gerar o seu PIN.' }, 401);
    }
    if (!(await verifyDriverPin(driver.password, String(password)))) {
      return json({ error: 'PIN incorreto' }, 401);
    }

    const token = createDriverToken(driver.id);
    if (!token) {
      console.error('DRIVER_SESSION_SECRET is not set');
      return json({ error: 'Sessão indisponível. Contacte o administrador.' }, 500);
    }

    const transporte = driver.transporteId
      ? await prisma.transporte.findUnique({
          where: { id: driver.transporteId },
          include: {
            via: {
              include: {
                municipio: { select: { nome: true } },
                paragens: { include: { paragem: true }, orderBy: { id: 'asc' } },
              },
            },
          },
        })
      : null;
    const via = transporte?.via ?? null;

    return json({
      token,
      id: driver.id,
      nome: driver.nome,
      bi: driver.bi,
      telefone: driver.telefone,
      email: driver.email,
      foto: driver.foto,
      status: driver.status,
      emViagem: driver.emViagem,
      viagemIniciadaEm: driver.viagemIniciadaEm,
      categoriaCarta: driver.categoriaCarta,
      experienciaAnos: driver.experienciaAnos,
      transporte: transporte
        ? {
            id: transporte.id,
            matricula: transporte.matricula,
            marca: transporte.marca,
            modelo: transporte.modelo,
            cor: transporte.cor,
            lotacao: transporte.lotacao,
            // Real GPS when fresh, otherwise the timetable position on the route
            currGeoLocation: vehicleGeo(transporte, via?.geoLocationPath, new Date(), await getFareRule()) ?? transporte.currGeoLocation,
          }
        : null,
      via: via
        ? {
            id: via.id,
            nome: via.nome,
            codigo: via.codigo,
            terminalPartida: via.terminalPartida,
            terminalChegada: via.terminalChegada,
            geoLocationPath: via.geoLocationPath,
            municipio: via.municipio?.nome,
            paragens: orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation).map((vp) => ({
              id: vp.paragem.id,
              nome: vp.paragem.nome,
              geoLocation: vp.paragem.geoLocation,
              isTerminal: vp.terminalBoolean,
            })),
          }
        : null,
    });
  } catch (error) {
    console.error('Error in driver login:', error);
    return json({ error: 'Erro ao processar login' }, 500);
  }
}
