import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TRIP_FIELDS, operationSummary } from '@/lib/vehiclePosition';

// GET: a viagem em curso do veículo, desde que o motorista a iniciou (km, viagens, próxima passagem em cada paragem)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await prisma.transporte.findUnique({
    where: { id },
    select: {
      id: true,
      currGeoLocation: true,
      gpsAtualizadoEm: true,
      gpsDirecao: true,
      gpsVelocidade: true,
      motorista: { select: TRIP_FIELDS },
      via: {
        select: {
          geoLocationPath: true,
          terminalPartida: true,
          terminalChegada: true,
          paragens: { select: { paragem: { select: { nome: true, geoLocation: true } } } },
        },
      },
    },
  });
  if (!t) return NextResponse.json({ error: 'Transporte não encontrado' }, { status: 404 });
  return NextResponse.json(await operationSummary(t, t.via));
}
