"use client";

import { useEffect, useMemo, useState } from "react";
import type { Point } from "@/lib/places";

/** Walks drawn along the streets (from /api/walk), shared by the planner and journey tracking. */

type Line = [number, number][]; // [lng, lat]

export interface Walk {
  from: Point;
  to: Point;
}

/**
 * Walks are asked for between points on a grid of about 45 m, so a passenger walking along asks
 * again only every few dozen metres; the path is then cut to the exact ends (fitWalk).
 */
const GRID = 0.0004;
const snap = (x: number) => (Math.round(x / GRID) * GRID).toFixed(4);
const keyOf = (w: Walk) => `${snap(w.from[0])},${snap(w.from[1])};${snap(w.to[0])},${snap(w.to[1])}`;

/** Street paths already fetched in this page, by grid key */
const known = new Map<string, Line>();
const asked = new Set<string>();

/** The point of `line` nearest to `p` ([lng, lat]), as the segment it is on and the point. */
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

/** The part of a street path between the walk's own ends, joined to them. */
function fitWalk(line: Line, w: Walk): Line {
  const from: [number, number] = [w.from[1], w.from[0]];
  const to: [number, number] = [w.to[1], w.to[0]];
  const a = nearestOn(line, from);
  const b = nearestOn(line, to);
  if (b.segment < a.segment) return [from, to];
  return [from, a.point, ...line.slice(a.segment + 1, b.segment + 1), b.point, to];
}

/**
 * The walks' paths along the streets: a straight line until the street path is known, or when
 * there is none (the router busy or down).
 */
export function useWalkPaths(walks: Walk[]): Line[] {
  const [version, setVersion] = useState(0);
  // The walks as text, so the paths only change when the walks (or what is known) do
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
          // A walk without a path may be asked again a minute later
          setTimeout(() => asked.delete(key), known.has(key) ? 0 : 60_000);
          setVersion((v) => v + 1);
        });
    }
  }, [exact]);

  return useMemo(() => {
    void version; // a path arrived (the paths are kept outside React)
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
