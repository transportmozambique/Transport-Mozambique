/**
 * Converte um percurso para o formato guardado "lng,lat;lng,lat;...", que todas as aplicações lêem.
 * Aceita esse formato e um array JSON de pares [lng, lat] (como texto ou já lido), e devolve null
 * quando há menos de dois pontos válidos.
 */
export function toStoredPath(input: unknown): string | null {
  let points: unknown = input;
  if (typeof input === "string") {
    const text = input.trim();
    if (text.startsWith("[")) {
      try {
        points = JSON.parse(text);
      } catch {
        return null;
      }
    } else {
      points = text.split(";").map((pair) => pair.split(",").map(Number));
    }
  }
  if (!Array.isArray(points)) return null;
  const valid = points.filter(
    (p): p is [number, number] =>
      Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])),
  );
  if (valid.length < 2) return null;
  return valid.map(([lng, lat]) => `${Number(lng).toFixed(6)},${Number(lat).toFixed(6)}`).join(";");
}

/**
 * Ordena as paragens de uma via pelo sítio onde ficam no percurso desenhado (Via.geoLocationPath,
 * "lng,lat;lng,lat;..."). As linhas ViaParagem não têm coluna de ordem e a ordem dos ids não é a
 * ordem de viagem na maioria das vias. Mantém a ordem dada quando não há percurso.
 * A mesma lógica de transport-client/lib/fares.ts (orderStopsAlongRoute).
 */
export function orderStopsAlongRoute<T>(
  stops: T[],
  geoLocationPath: string | null | undefined,
  geoOf: (stop: T) => string | null | undefined,
): T[] {
  const path = (geoLocationPath || "")
    .split(";")
    .map((coord) => {
      const [lng, lat] = coord.split(",").map(Number);
      return [lat, lng] as [number, number];
    })
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  if (path.length < 2) return stops;

  const positionOnPath = (geo: string | null | undefined) => {
    const [lat, lng] = (geo || "").split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return path.length;
    const k = Math.cos((lat * Math.PI) / 180);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < path.length; i++) {
      const dLat = path[i][0] - lat;
      const dLng = (path[i][1] - lng) * k;
      const dist = dLat * dLat + dLng * dLng;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };

  return stops
    .map((stop, i) => ({ stop, i, at: positionOnPath(geoOf(stop)) }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map((s) => s.stop);
}

/** Uma paragem de uma via, como os mapas do painel a desenham */
export interface RouteStop {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  isTerminal: boolean;
}

/**
 * As paragens de uma via (as linhas ViaParagem com a sua Paragem) pela ordem do percurso, com as
 * coordenadas de Paragem.geoLocation ("lat,lng"). As paragens sem coordenadas válidas ficam de fora.
 */
export function routeStops(
  paragens: { terminalBoolean: boolean; paragem: { id: string; nome: string; geoLocation: string | null } }[],
  geoLocationPath: string | null | undefined,
): RouteStop[] {
  return orderStopsAlongRoute(paragens, geoLocationPath, (p) => p.paragem.geoLocation).flatMap((p) => {
    const [lat, lng] = (p.paragem.geoLocation || "").split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? [{ id: p.paragem.id, nome: p.paragem.nome, latitude: lat, longitude: lng, isTerminal: p.terminalBoolean }]
      : [];
  });
}
