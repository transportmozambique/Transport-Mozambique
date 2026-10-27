import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { GPS_FRESH_MS } from '@/lib/vehiclePosition';

/**
 * Dispositivo GPS de um veículo. O dispositivo (um telemóvel com o Traccar Client, ou um
 * rastreador reencaminhado pelo Traccar) envia posições para /api/gps da aplicação dos passageiros
 * com este código; só o seu SHA-256 fica guardado, por isso o código é mostrado uma vez, ao ser criado.
 */

// Para onde os dispositivos enviam posições (a aplicação dos passageiros, transport-client)
const GPS_SERVER_URL = process.env.GPS_SERVER_URL || 'https://transport-mz.vercel.app/api/gps';

type Params = { params: Promise<{ id: string }> };

// GET: há um dispositivo configurado, e quando enviou a última posição
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const t = await prisma.transporte.findUnique({
    where: { id },
    select: { gpsDispositivoHash: true, gpsAtualizadoEm: true, gpsVelocidade: true },
  });
  if (!t) return NextResponse.json({ error: 'Transporte não encontrado' }, { status: 404 });
  return NextResponse.json({
    configurado: Boolean(t.gpsDispositivoHash),
    ultimaPosicaoEm: t.gpsAtualizadoEm,
    ativo: Boolean(t.gpsAtualizadoEm && Date.now() - t.gpsAtualizadoEm.getTime() < GPS_FRESH_MS),
    velocidadeKmh: t.gpsVelocidade,
    servidor: GPS_SERVER_URL,
  });
}

// POST: cria um código novo (substitui o anterior, que deixa de funcionar)
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const codigo = randomBytes(15).toString('base64url'); // 20 caracteres, 120 bits
  try {
    await prisma.transporte.update({
      where: { id },
      data: { gpsDispositivoHash: createHash('sha256').update(codigo).digest('hex') },
    });
  } catch {
    return NextResponse.json({ error: 'Transporte não encontrado' }, { status: 404 });
  }
  return NextResponse.json({ codigo, servidor: GPS_SERVER_URL });
}

// DELETE: revoga o código; o veículo volta à posição pela viagem do motorista (ou parado)
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.transporte.update({
      where: { id },
      data: { gpsDispositivoHash: null, gpsAtualizadoEm: null, gpsVelocidade: null, gpsDirecao: null, gpsVelocidadeMedia: null },
    });
  } catch {
    return NextResponse.json({ error: 'Transporte não encontrado' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
