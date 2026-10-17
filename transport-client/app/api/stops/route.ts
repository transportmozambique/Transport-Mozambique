import { NextResponse } from 'next/server';
import { loadNetwork } from '@/lib/journeys';

/**
 * Every stop served by a bus, with the routes through it, for the map and the stop search.
 * Compact: each stop lists its routes as indexes into `vias`.
 */
export async function GET() {
  try {
    const net = await loadNetwork();
    const vias = [...net.routes.values()].map((r) => ({ id: r.id, codigo: r.codigo, nome: r.nome, cor: r.cor }));
    const index = new Map(vias.map((v, i) => [v.id, i]));
    const paragens = [...net.stops.values()].map((s) => ({
      id: s.id,
      nome: s.nome,
      lat: s.point[0],
      lng: s.point[1],
      v: s.routeIds.map((id) => index.get(id)).filter((i): i is number => i !== undefined),
    }));
    return NextResponse.json(
      { vias, paragens },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (error) {
    console.error('Erro ao listar paragens:', error);
    return NextResponse.json({ error: 'Erro ao listar paragens' }, { status: 500 });
  }
}
