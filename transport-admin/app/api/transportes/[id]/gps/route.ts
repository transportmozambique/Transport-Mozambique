import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { GPS_FRESH_MS } from '@/lib/vehiclePosition';

/**
 * GPS device of a vehicle. The device (a phone with Traccar Client, or a tracker forwarded by
 * Traccar) sends positions to the passenger app's /api/gps with this code; only its SHA-256 is
 * stored, so the code is shown once, when it is created.
 */

// Where devices send positions (the passenger app, transport-client)
const GPS_SERVER_URL = process.env.GPS_SERVER_URL || 'https://transport-mz.vercel.app/api/gps';

type Params = { params: Promise<{ id: string }> };

// GET: is a device set up, and when did it last send a position
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

// POST: create a new device code (replaces the previous one, which stops working)
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const codigo = randomBytes(15).toString('base64url'); // 20 characters, 120 bits
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

// DELETE: revoke the device code; the vehicle goes back to timetable positions
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.transporte.update({
      where: { id },
      data: { gpsDispositivoHash: null, gpsAtualizadoEm: null, gpsVelocidade: null, gpsDirecao: null },
    });
  } catch {
    return NextResponse.json({ error: 'Transporte não encontrado' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
