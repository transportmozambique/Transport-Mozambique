import { NextRequest, NextResponse } from 'next/server';
import { roundPoint, walkRoute } from '@/lib/walkRoute';
import type { Point } from '@/lib/places';

/**
 * A walk along the streets, to draw it on the map.
 *
 * GET /api/walk?de=LAT,LNG&para=LAT,LNG
 *   → {"percurso": [[lng, lat], …], "metros": 460}, or {"percurso": null} when the street path
 *     cannot be had now (the map then draws a straight line)
 *
 * The points are rounded to about 11 m, so the CDN can keep one answer for everyone asking for
 * the same walk.
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
