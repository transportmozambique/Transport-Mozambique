import { NextResponse } from 'next/server';
import { loadNetwork } from '@/lib/journeys';
import { parseLatLng } from '@/lib/fares';
import { prisma } from '@/lib/prisma';

/**
 * Todas as paragens servidas por um autocarro, com as vias que passam por elas, para o mapa e a
 * pesquisa de paragens. Compacto (é a maior resposta da aplicação): cada paragem lista as suas vias
 * como índices em `vias`. `semAutocarro` lista as outras paragens (nenhuma via com veículo passa lá),
 * para o mapa ainda as poder mostrar.
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
    const others = await prisma.paragem.findMany({ select: { id: true, nome: true, geoLocation: true } });
    const semAutocarro = others.flatMap((p) => {
      const point = net.stops.has(p.id) ? null : parseLatLng(p.geoLocation);
      return point ? [{ id: p.id, nome: p.nome, lat: point[0], lng: point[1] }] : [];
    });
    return NextResponse.json(
      { vias, paragens, semAutocarro },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (error) {
    console.error('Erro ao listar paragens:', error);
    return NextResponse.json({ error: 'Erro ao listar paragens' }, { status: 500 });
  }
}
