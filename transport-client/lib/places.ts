/**
 * Finding stops by name, shared by the web app (in the browser) and USSD. No server imports.
 *
 * Stop names repeat: both sides of a street, or several stops along one avenue, have the same
 * name. A "place" is a group of stops with the same name within PLACE_RADIUS_M of each other,
 * which is what a passenger means by "Museu" or "Padaria".
 */

export type Point = [number, number]; // [lat, lng]

export interface NamedStop {
  id: string;
  nome: string;
  point: Point;
}

export interface Place<S extends NamedStop = NamedStop> {
  /** Id of the first stop: stable while the stops do not change */
  key: string;
  nome: string;
  stops: S[];
  point: Point;
}

const PLACE_RADIUS_M = 400;

/** Lower case, no accents, single spaces: "Praça dos Trabalhadores" → "praca dos trabalhadores". */
export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function distanceMeters([lat1, lng1]: Point, [lat2, lng2]: Point): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * How well `name` matches the typed `query` (0 = no match). Every typed word must start a word
 * of the name ("av ind" finds "Av. das Indústrias"); whole-name and first-word matches rank first.
 */
export function matchScore(name: string, query: string): number {
  const q = normalizeName(query);
  if (!q) return 0;
  const n = normalizeName(name);
  if (n === q) return 4;
  const words = n.split(' ');
  const typed = q.split(' ');
  if (!typed.every((t) => words.some((w) => w.startsWith(t)))) return n.includes(q) ? 1 : 0;
  return n.startsWith(q) ? 3 : 2;
}

/** Groups stops into places: same name, within PLACE_RADIUS_M of another stop of the group. */
export function groupPlaces<S extends NamedStop>(stops: S[]): Place<S>[] {
  const byName = new Map<string, S[]>();
  for (const s of stops) {
    const k = normalizeName(s.nome);
    const list = byName.get(k);
    if (list) list.push(s);
    else byName.set(k, [s]);
  }

  const places: Place<S>[] = [];
  for (const group of byName.values()) {
    const left = [...group];
    while (left.length) {
      const members = [left.shift()!];
      for (let i = 0; i < members.length; i++) {
        for (let j = left.length - 1; j >= 0; j--) {
          if (distanceMeters(members[i].point, left[j].point) <= PLACE_RADIUS_M) members.push(...left.splice(j, 1));
        }
      }
      const lat = members.reduce((sum, s) => sum + s.point[0], 0) / members.length;
      const lng = members.reduce((sum, s) => sum + s.point[1], 0) / members.length;
      places.push({ key: members[0].id, nome: members[0].nome, stops: members, point: [lat, lng] });
    }
  }
  return places;
}

/** Places whose name matches `query`, best first, then by name. */
export function searchPlaces<S extends NamedStop>(places: Place<S>[], query: string, limit = 30): Place<S>[] {
  return places
    .map((p) => ({ p, score: matchScore(p.nome, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.nome.localeCompare(b.p.nome, 'pt'))
    .slice(0, limit)
    .map((x) => x.p);
}

/** Walking time in minutes for a straight-line distance (streets add about a quarter). */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * 1.25) / 75)); // 4.5 km/h
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}
