#!/usr/bin/env node
/**
 * Põe nas estradas os percursos das rotas onde eles cortam pelo mapa.
 *
 *   node scripts/snap-paths.mjs                        # ensaio: o que mudaria, nada é escrito
 *   node scripts/snap-paths.mjs --apply                # escreve em DATABASE_URL (só bases de dados locais)
 *   node scripts/snap-paths.mjs --apply --production   # permite também uma base de dados remota
 *   opções: --min 300 (troço mais curto verificado, m), --verbose (todas as rotas listadas)
 *
 * Alguns percursos guardados (Via.geoLocationPath) saltam em linha recta entre dois pontos
 * afastados: onde uma relação de rota do OpenStreetMap tem um buraco ou lista as suas vias fora
 * de ordem (a importação do OSM juntou as vias por ordem), e nas rotas desenhadas de paragem em
 * paragem pelos primeiros scripts de dados, cujas linhas rectas estão cortadas em pontos a poucas
 * dezenas de metros uns dos outros. O percurso é lido como troços rectos (os pontos numa linha, a
 * menos de 3 m). Para cada troço de pelo menos --min metros, o script pede a um router OSRM
 * público de carro a estrada entre as suas duas pontas:
 * - a estrada fica a menos de 50 m da linha recta: a estrada é recta, o troço fica;
 * - a estrada fica a menos de um quarto do comprimento do troço (pelo menos 300 m) da linha, e é
 *   no máximo 3 vezes mais longa (+500 m): o troço é substituído pela estrada;
 * - senão a estrada de carro vai por outro lado (uma circular, o centro da cidade). Pergunta-se
 *   também ao router a pé, que ignora os sentidos únicos e usa caminhos de terra: quando o seu
 *   caminho segue a linha (uma estrada com separador, uma rua de sentido único, um caminho), o
 *   troço é uma estrada e fica. Senão o troço fica e é listado: scripts/redraw-from-osm.mjs
 *   reconstrói essas rotas a partir das suas paragens do OpenStreetMap, e as outras redesenham-se
 *   no painel (Vias → a rota → Redesenhar percurso).
 * O novo percurso é simplificado (4 m) e só é escrito quando mudou.
 *
 * As respostas dos routers ficam em osm-data/road-cache.json (scripts/roads.mjs), por isso uma
 * segunda corrida com os mesmos dados (a produção depois de uma corrida local) não pergunta nada outra vez.
 *
 * --apply guarda primeiro o id, o código e o percurso de cada rota em
 * osm-data/backup-paths-<hora>.json (para desfazer: escrever esses percursos de volta), e só
 * actualiza uma rota cujo percurso ainda é o que foi lido.
 * Dados das estradas © contribuidores do OpenStreetMap (ODbL), caminhos por OSRM / FOSSGIS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, fetchRoutes, formatPath, lengthM, meters, openCache, parsePath, simplify, stretches } from './roads.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DATA = path.resolve(option('--data', path.join(__dirname, '..', 'osm-data')));
const MIN_SEGMENT_M = Number(option('--min', '300'));
/** Uma rota que fica com um salto em linha recta deste comprimento é listada */
const LIST_JUMP_M = 1000;

function longStretches(points) {
  return stretches(points)
    .map(([i, j]) => [points[i], points[j]])
    .filter(([a, b]) => meters(a, b) >= MIN_SEGMENT_M);
}

/** O novo percurso da rota, e o que foi feito aos seus troços longos */
function snapRoute(points) {
  const out = [points[0]];
  const stats = { road: 0, straight: 0, stray: 0, unknown: 0 };
  /** Comprimentos (m) dos troços mantidos rectos por falta de uma estrada ao longo deles */
  const kept = [];
  for (const [i, j] of stretches(points)) {
    const a = points[i];
    const b = points[j];
    const c = meters(a, b) >= MIN_SEGMENT_M ? classify(a, b) : null;
    if (c) {
      const kind = c.kind === 'ask-foot' ? 'unknown' : c.kind;
      stats[kind]++;
      if (kind === 'stray') kept.push(c.m);
    }
    if (c?.kind === 'road') out.push(...c.road.points, b);
    else out.push(...points.slice(i + 1, j + 1));
  }
  return { points: stats.road ? simplify(out) : points, stats, kept };
}

(async () => {
  const url = process.env.DATABASE_URL ?? '';
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  if (flag('--apply') && !local && !flag('--production')) {
    console.error('DATABASE_URL não é uma base de dados local: juntar --production para escrever nela.');
    process.exit(1);
  }
  openCache(DATA);
  const { PrismaClient } = (await import('@prisma/client')).default;
  const prisma = new PrismaClient();
  try {
    const vias = await prisma.via.findMany({ select: { id: true, codigo: true, nome: true, geoLocationPath: true }, orderBy: { codigo: 'asc' } });
    const parsed = vias.map((v) => ({ ...v, points: parsePath(v.geoLocationPath) })).filter((v) => v.points.length >= 2);
    const long = parsed.flatMap((v) => longStretches(v.points));
    await fetchRoutes(long.map((points) => ({ profile: 'car', points })), 'car roads');
    // O router a pé, só onde a estrada de carro se afasta
    await fetchRoutes(long.filter(([a, b]) => classify(a, b).kind === 'ask-foot').map((points) => ({ profile: 'foot', points })), 'foot roads');

    const changes = [];
    const toRedraw = [];
    const total = { road: 0, straight: 0, stray: 0, unknown: 0 };
    for (const v of parsed) {
      const { points, stats, kept } = snapRoute(v.points);
      const longest = Math.max(0, ...kept);
      if (longest >= LIST_JUMP_M) toRedraw.push({ v, longest });
      for (const k of Object.keys(total)) total[k] += stats[k];
      if (stats.road) changes.push({ v, points, stats, before: lengthM(v.points) / 1000, after: lengthM(points) / 1000 });
    }
    console.log(`Rotas: ${vias.length}; troços rectos longos (≥ ${MIN_SEGMENT_M} m): ${total.road + total.straight + total.stray + total.unknown}`);
    console.log(`  postos na estrada: ${total.road}; numa estrada recta, mantidos: ${total.straight}; sem estrada ao longo, mantidos: ${total.stray}; ainda por perguntar: ${total.unknown}`);
    console.log(`Rotas alteradas: ${changes.length}`);
    for (const c of flag('--verbose') ? changes : changes.slice(0, 15)) {
      console.log(`  ${c.v.codigo.padEnd(10)} ${String(c.stats.road).padStart(3)} troços, ${c.before.toFixed(1)} → ${c.after.toFixed(1)} km  ${c.v.nome}`);
    }
    if (!flag('--verbose') && changes.length > 15) console.log(`  … (--verbose lista as ${changes.length})`);
    toRedraw.sort((x, y) => y.longest - x.longest);
    console.log(`\nRotas ainda com um salto recto de ${LIST_JUMP_M / 1000} km ou mais (redraw-from-osm.mjs, ou Vias → Redesenhar percurso no painel): ${toRedraw.length}`);
    for (const r of flag('--verbose') ? toRedraw : toRedraw.slice(0, 15)) {
      console.log(`  ${r.v.codigo.padEnd(10)} ${(r.longest / 1000).toFixed(1).padStart(5)} km  ${r.v.nome}`);
    }
    if (!flag('--verbose') && toRedraw.length > 15) console.log(`  … (--verbose lista as ${toRedraw.length})`);
    if (!flag('--apply')) {
      console.log('\nEnsaio: nada foi escrito. Juntar --apply para escrever.');
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(DATA, `backup-paths-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify({ at: stamp, vias: vias.map(({ id, codigo, geoLocationPath }) => ({ id, codigo, geoLocationPath })) }));
    console.log(`\nCópia de segurança: percursos de ${vias.length} rotas → ${file}`);
    let written = 0;
    for (const c of changes) {
      const res = await prisma.via.updateMany({
        where: { id: c.v.id, geoLocationPath: c.v.geoLocationPath },
        data: { geoLocationPath: formatPath(c.points) },
      });
      written += res.count;
    }
    console.log(`Escrito: ${written} rotas.`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
