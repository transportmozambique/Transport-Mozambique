import { NextRequest, NextResponse } from 'next/server';
import { roundPoint, walkRoute } from '@/lib/walkRoute';
import type { Point } from '@/lib/places';

/**
 * Uma caminhada pelas ruas, para a desenhar no mapa.
 *
 * GET /api/walk?de=LAT,LNG&para=LAT,LNG
 *   → {"percurso": [[lng, lat], …], "metros": 460}, ou {"percurso": null} quando agora não há
 *     caminho pelas ruas (o mapa desenha então uma linha recta)
 *
 * Os pontos arredondam-se a cerca de 11 m, para a CDN guardar uma só resposta para quem pedir a
 * mesma caminhada. Porquê pelo servidor: o router da FOSSGIS vê o servidor e não o passageiro.
 */
function parsePoint(value: string | null): Point | null {
  const [lat, lng] = (value ?? '').split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return roundPoint([lat, lng]);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = parsePoint(params.get('de'));
  const to = parsePoint(params.get('para'));
  if (!from || !to) return NextResponse.json({ error: 'Indique de=LAT,LNG e para=LAT,LNG' }, { status: 400 });

  const route = await walkRoute(from, to);
  if (!route) return NextResponse.json({ percurso: null }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(route, { headers: { 'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400' } });
}
