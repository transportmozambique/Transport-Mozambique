import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { positionSummary } from '@/lib/vehiclePosition';

// GET: where the vehicle is now (real GPS or timetable), for the detail page's live map
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
      via: { select: { geoLocationPath: true, paragens: { select: { paragem: { select: { nome: true, geoLocation: true } } } } } },
    },
  });
  if (!t) return NextResponse.json({ error: 'Transporte não encontrado' }, { status: 404 });
  return NextResponse.json(await positionSummary(t, t.via));
}
