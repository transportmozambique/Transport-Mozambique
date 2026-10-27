import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TRIP_FIELDS, positionSummary } from '@/lib/vehiclePosition';

// GET: onde está o veículo agora (GPS real, a viagem do motorista, ou parado), para o mapa ao vivo da página de detalhe
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
      gpsVelocidadeMedia: true,
      motorista: { select: TRIP_FIELDS },
      via: { select: { geoLocationPath: true, paragens: { select: { paragem: { select: { nome: true, geoLocation: true } } } } } },
    },
  });
  if (!t) return NextResponse.json({ error: 'Transporte não encontrado' }, { status: 404 });
  return NextResponse.json(await positionSummary(t, t.via));
}
