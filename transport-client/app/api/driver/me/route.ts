import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { driverIdFromRequest } from '@/lib/driverSession';
import { DRIVER_PROFILE_FIELDS, driverProfile } from '@/lib/driverProfile';

// The signed-in driver's current vehicle and route, as at sign-in. The driver portal asks again
// when it opens and every few minutes, so a change made in the admin shows without signing out.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// GET /api/driver/me  (Authorization: Bearer <token from the login>)
export async function GET(request: Request) {
  const motoristaId = driverIdFromRequest(request);
  if (!motoristaId) return json({ error: 'Sessão inválida ou expirada. Entre de novo.' }, 401);

  try {
    const driver = await prisma.motorista.findUnique({ where: { id: motoristaId }, select: DRIVER_PROFILE_FIELDS });
    if (!driver) return json({ error: 'Motorista não encontrado' }, 404);
    return json(await driverProfile(driver));
  } catch (error) {
    console.error('Error reading driver profile:', error);
    return json({ error: 'Erro ao obter os dados do motorista' }, 500);
  }
}
