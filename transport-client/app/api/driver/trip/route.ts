import { NextResponse } from 'next/server';
import { getTripState, startTrip, endTrip } from '@/lib/driverTrips';

// Trip state shared with the USSD driver menu (*6). Called from the driver portal.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// GET /api/driver/trip?motoristaId=...
export async function GET(request: Request) {
  const motoristaId = new URL(request.url).searchParams.get('motoristaId');
  if (!motoristaId) return json({ error: 'motoristaId é obrigatório' }, 400);

  try {
    const state = await getTripState(motoristaId);
    if (!state) return json({ error: 'Motorista não encontrado' }, 404);
    return json(state);
  } catch (error) {
    console.error('Error reading driver trip:', error);
    return json({ error: 'Erro ao obter estado da viagem' }, 500);
  }
}

// POST { motoristaId, action: 'iniciar' | 'encerrar' }
export async function POST(request: Request) {
  try {
    const { motoristaId, action } = await request.json();
    if (!motoristaId || (action !== 'iniciar' && action !== 'encerrar')) {
      return json({ error: "motoristaId e action ('iniciar' ou 'encerrar') são obrigatórios" }, 400);
    }

    const state = action === 'iniciar' ? await startTrip(motoristaId) : await endTrip(motoristaId);
    if (!state) return json({ error: 'Motorista não encontrado' }, 404);
    return json(state);
  } catch (error) {
    console.error('Error updating driver trip:', error);
    return json({ error: 'Erro ao atualizar a viagem' }, 500);
  }
}
