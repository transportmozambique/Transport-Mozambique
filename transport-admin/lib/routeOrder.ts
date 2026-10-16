/**
 * Orders a route's stops by where they fall on its drawn path (Via.geoLocationPath,
 * "lng,lat;lng,lat;..."). ViaParagem rows have no sequence column and their id order
 * is not the travel order on most routes. Keeps the given order when there is no path.
 * Same logic as transport-client/lib/fares.ts (orderStopsAlongRoute).
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
