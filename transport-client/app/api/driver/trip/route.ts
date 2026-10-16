import { NextResponse } from 'next/server';
import { getTripState, startTrip, endTrip } from '@/lib/driverTrips';
import { driverIdFromRequest } from '@/lib/driverSession';

// Trip state shared with the USSD driver menu (*6). Called from the driver portal with the
// session token it got at login ("Authorization: Bearer"); a driver only changes their own trip.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const UNAUTHORIZED = { error: 'Sessão inválida ou expirada. Entre de novo.' };

// GET /api/driver/trip
export async function GET(request: Request) {
  const motoristaId = driverIdFromRequest(request);
  if (!motoristaId) return json(UNAUTHORIZED, 401);

  try {
    const state = await getTripState(motoristaId);
    if (!state) return json({ error: 'Motorista não encontrado' }, 404);
    return json(state);
  } catch (error) {
    console.error('Error reading driver trip:', error);
    return json({ error: 'Erro ao obter estado da viagem' }, 500);
  }
}

// POST { action: 'iniciar' | 'encerrar' }
export async function POST(request: Request) {
  const motoristaId = driverIdFromRequest(request);
  if (!motoristaId) return json(UNAUTHORIZED, 401);

  try {
    const { action } = await request.json();
    if (action !== 'iniciar' && action !== 'encerrar') {
      return json({ error: "action ('iniciar' ou 'encerrar') é obrigatória" }, 400);
    }

    const state = action === 'iniciar' ? await startTrip(motoristaId) : await endTrip(motoristaId);
    if (!state) return json({ error: 'Motorista não encontrado' }, 404);
    return json(state);
  } catch (error) {
    console.error('Error updating driver trip:', error);
    return json({ error: 'Erro ao atualizar a viagem' }, 500);
  }
}
