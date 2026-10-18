import { NextResponse } from 'next/server';
import { findDriverByPhone, verifyDriverPin } from '@/lib/driverTrips';
import { createDriverToken } from '@/lib/driverSession';
import { driverProfile } from '@/lib/driverProfile';

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

    return json({ token, ...(await driverProfile(driver)) });
  } catch (error) {
    console.error('Error in driver login:', error);
    return json({ error: 'Erro ao processar login' }, 500);
  }
}
