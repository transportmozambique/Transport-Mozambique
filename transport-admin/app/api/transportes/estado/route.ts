import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { routeGeometry, travelSpeedMps, vehiclePosition } from '@/lib/vehiclePosition';

export type EstadoAgora = 'circulacao' | 'terminal' | 'fora-de-servico' | 'sem-posicao';

// GET: what every vehicle is doing now (real GPS when fresh, otherwise the timetable), for the list
export async function GET() {
  const [speed, transportes] = await Promise.all([
    travelSpeedMps(),
    prisma.transporte.findMany({
      select: {
        id: true,
        currGeoLocation: true,
        gpsAtualizadoEm: true,
        gpsVelocidade: true,
        gpsDirecao: true,
        via: { select: { geoLocationPath: true } },
      },
    }),
  ]);
  const now = new Date();
  const estados: Record<string, { estado: EstadoAgora; gps: boolean }> = {};
  for (const t of transportes) {
    const p = vehiclePosition(t, routeGeometry(t.via?.geoLocationPath), speed, now);
    estados[t.id] = {
      estado: !p ? 'sem-posicao' : p.moving ? 'circulacao' : p.outOfService ? 'fora-de-servico' : 'terminal',
      gps: p?.source === 'gps',
    };
  }
  return NextResponse.json(estados);
}
