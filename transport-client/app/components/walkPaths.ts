"use client";

import { useEffect, useMemo, useState } from "react";
import type { Point } from "@/lib/places";

/** Caminhadas desenhadas pelas ruas (de /api/walk), partilhadas pelo planeador e pelo acompanhamento da viagem. */

type Line = [number, number][]; // [lng, lat]

export interface Walk {
  from: Point;
  to: Point;
}

/**
 * As caminhadas são pedidas entre pontos de uma grelha de cerca de 45 m, para que um passageiro a
 * andar só peça outra vez a cada poucas dezenas de metros (o router público aceita poucos pedidos);
 * o caminho é depois cortado nas pontas exactas (fitWalk).
 */
const GRID = 0.0004;
const snap = (x: number) => (Math.round(x / GRID) * GRID).toFixed(4);
const keyOf = (w: Walk) => `${snap(w.from[0])},${snap(w.from[1])};${snap(w.to[0])},${snap(w.to[1])}`;

/** Caminhos pelas ruas já pedidos nesta página, pela chave da grelha */
const known = new Map<string, Line>();
const asked = new Set<string>();

/** O ponto de `line` mais perto de `p` ([lng, lat]), como o segmento em que está e o ponto. */
function nearestOn(line: Line, [lng, lat]: [number, number]) {
  const k = Math.cos((lat * Math.PI) / 180);
  let best = { segment: 0, point: line[0] };
  let bestDist = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    const dx = (bx - ax) * k;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, (((lng - ax) * k) * dx + (lat - ay) * dy) / len)) : 0;
    const d = ((lng - ax) * k - t * dx) ** 2 + (lat - ay - t * dy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = { segment: i, point: [ax + t * (bx - ax), ay + t * (by - ay)] };
    }
  }
  return best;
}

/** A parte de um caminho pelas ruas entre as pontas da própria caminhada, ligada a elas. */
function fitWalk(line: Line, w: Walk): Line {
  const from: [number, number] = [w.from[1], w.from[0]];
  const to: [number, number] = [w.to[1], w.to[0]];
  const a = nearestOn(line, from);
  const b = nearestOn(line, to);
  if (b.segment < a.segment) return [from, to];
  return [from, a.point, ...line.slice(a.segment + 1, b.segment + 1), b.point, to];
}

/**
 * Os caminhos das caminhadas pelas ruas: uma linha recta enquanto o caminho não é conhecido, ou
 * quando não há nenhum (o router ocupado ou em baixo).
 */
export function useWalkPaths(walks: Walk[]): Line[] {
  const [version, setVersion] = useState(0);
  // As caminhadas como texto, para os caminhos só mudarem quando as caminhadas (ou o que se sabe) mudam
  const exact = walks.map((w) => [...w.from, ...w.to].join(",")).join("|");

  useEffect(() => {
    for (const w of parseWalks(exact)) {
      const key = keyOf(w);
      if (known.has(key) || asked.has(key)) continue;
      asked.add(key);
      const [de, para] = key.split(";");
      fetch(`/api/walk?de=${de}&para=${para}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { percurso?: Line | null } | null) => {
          if (d?.percurso?.length) known.set(key, d.percurso);
        })
        .catch(() => {})
        .finally(() => {
          // Uma caminhada sem caminho pode ser pedida outra vez um minuto depois
          setTimeout(() => asked.delete(key), known.has(key) ? 0 : 60_000);
          setVersion((v) => v + 1);
        });
    }
  }, [exact]);

  return useMemo(() => {
    void version; // chegou um caminho (os caminhos ficam fora do React)
    return parseWalks(exact).map((w): Line => {
      const line = known.get(keyOf(w));
      return line ? fitWalk(line, w) : [[w.from[1], w.from[0]], [w.to[1], w.to[0]]];
    });
  }, [exact, version]);
}

function parseWalks(exact: string): Walk[] {
  if (!exact) return [];
  return exact.split("|").map((s) => {
    const [a, b, c, d] = s.split(",").map(Number);
    return { from: [a, b], to: [c, d] };
  });
}
