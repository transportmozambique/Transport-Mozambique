import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { prisma } from '@/lib/prisma';
import { getTripState, startTrip, endTrip, TripError, type TripState } from '@/lib/driverTrips';
import { driverIdFromRequest } from '@/lib/driverSession';
import { followBus } from '@/lib/follow';
import { maybeCheckArrivals } from '@/lib/busSimulator';

// Estado da viagem, partilhado com o menu USSD do motorista (*6). Chamado pelo portal do motorista
// com o token de sessão recebido na entrada ("Authorization: Bearer"); um motorista só muda a sua própria viagem.
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

/**
 * O estado da viagem com o autocarro tal como os passageiros o vêem agora (lib/follow.ts): onde
 * está, "Em circulação" ou "Fora de serviço", e as próximas paragens com os minutos. Porquê aqui:
 * o mapa do portal mostra o autocarro no mesmo sítio que a web e o USSD, e não a posição do
 * telemóvel, que só conta quando é enviada como GPS do veículo.
 */
async function withBus(motoristaId: string, state: TripState) {
  const driver = await prisma.motorista.findUnique({ where: { id: motoristaId }, select: { transporteId: true } });
  if (!driver?.transporteId) return { ...state, autocarro: null };
  try {
    const bus = await followBus(driver.transporteId, null);
    return {
      ...state,
      autocarro: {
        lat: bus.autocarro.lat,
        lng: bus.autocarro.lng,
        direcao: bus.autocarro.heading,
        fonte: bus.autocarro.fonte,
        estado: bus.estado,
        velocidade: bus.velocidade,
        sentido: bus.sentido,
        proximas: bus.proximas.slice(0, 3).map((p) => ({ nome: p.paragem.nome, minutos: p.minutos })),
      },
    };
  } catch {
    // Rota desactivada ou sem paragens: os passageiros não vêem o autocarro
    return { ...state, autocarro: null };
  }
}

// GET /api/driver/trip
export async function GET(request: Request) {
  const motoristaId = driverIdFromRequest(request);
  if (!motoristaId) return json(UNAUTHORIZED, 401);

  try {
    const state = await getTripState(motoristaId);
    if (!state) return json({ error: 'Motorista não encontrado' }, 404);
    // O portal pergunta a cada poucos segundos durante a viagem: um bom momento para os SMS de chegada
    waitUntil(maybeCheckArrivals());
    return json(await withBus(motoristaId, state));
  } catch (error) {
    console.error('Erro ao ler a viagem do motorista:', error);
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
    return json(await withBus(motoristaId, state));
  } catch (error) {
    // Sem veículo, sem rota, ou rota desactivada: a viagem não começa
    if (error instanceof TripError) return json({ error: error.message }, 409);
    console.error('Erro ao actualizar a viagem do motorista:', error);
    return json({ error: 'Erro ao atualizar a viagem' }, 500);
  }
}
