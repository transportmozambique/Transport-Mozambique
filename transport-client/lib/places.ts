/**
 * Encontrar paragens pelo nome, partilhado pela aplicação web (no navegador) e pelo USSD. Sem
 * importações de servidor, para poder correr no navegador.
 *
 * Os nomes das paragens repetem-se: os dois lados de uma rua, ou várias paragens ao longo de uma
 * avenida, têm o mesmo nome. Um "local" é um grupo de paragens com o mesmo nome a menos de
 * PLACE_RADIUS_M umas das outras, que é o que um passageiro quer dizer com "Museu" ou "Padaria".
 * Um número de via entre parênteses no fim ("Museu (X39)", uma baia do terminal do Museu por via)
 * não conta: todas as baias são "Museu".
 */

export type Point = [number, number]; // [lat, lng]

export interface NamedStop {
  id: string;
  nome: string;
  point: Point;
}

export interface Place<S extends NamedStop = NamedStop> {
  /** Id da primeira paragem: estável enquanto as paragens não mudam */
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

/** Um número de via entre parênteses no fim do nome de uma paragem: "(X39)", "(109)", "(C1)", "(34-1)" */
const ROUTE_SUFFIX = /\s*\([A-Za-z]?\d[\d-]{0,4}[A-Za-z]?\)\s*$/;

/**
 * O nome que uma paragem partilha com as outras paragens do seu local: sem o número de via entre
 * parênteses no fim ("Museu (X39)" → "Museu"). Os outros parênteses ficam: "Rua do Cajueiro (Fedel Castro)".
 */
export function placeName(nome: string): string {
  const base = nome.replace(ROUTE_SUFFIX, '').trim();
  return base || nome;
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

// ─── Pesquisa tolerante ───────────────────────────────────────────────────────
// As pessoas escrevem os nomes no teclado do telemóvel, de memória: abreviaturas ("av"), palavras
// de ligação ("paragem do museu"), grafias que soam igual ("Chipamanine" por "Xipamanine") e erros
// ("makalala"). Cada palavra escrita é comparada com as palavras do nome, o melhor tipo de
// coincidência primeiro. Porquê: no USSD não há sugestões enquanto se escreve, e uma pesquisa que
// falha obriga a recomeçar uma sessão paga e com tempo limitado.

/** Abreviaturas que as pessoas escrevem, e a palavra que representam (os dois lados são reescritos) */
const SHORT_FORMS: Record<string, string> = {
  av: 'avenida', avd: 'avenida', avda: 'avenida', aven: 'avenida',
  r: 'rua',
  pc: 'praca', pca: 'praca',
  est: 'estrada', estr: 'estrada',
  b: 'bairro', bo: 'bairro', bro: 'bairro',
  dr: 'doutor', eng: 'engenheiro', sta: 'santa', sto: 'santo',
  hosp: 'hospital', merc: 'mercado', esc: 'escola',
  primeiro: '1', primeira: '1', segundo: '2', segunda: '2', terceiro: '3', terceira: '3',
};

/** Palavras que só ligam outras: uma pesquisa pode tê-las ou não ("paragem do museu" = "museu") */
const FILLER = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'na', 'no', 'nas', 'nos', 'em', 'ao', 'para',
  'perto', 'junto', 'paragem', 'paragens', 'terminal', 'estacao',
]);

/** Uma palavra numa forma comparável: abreviaturas por extenso, "1o"/"2a" como o número */
function canonical(word: string): string {
  const ordinal = /^(\d+)[oa]$/.exec(word);
  return ordinal ? ordinal[1] : SHORT_FORMS[word] ?? word;
}

/**
 * Como uma palavra soa, aproximadamente, em português e nos nomes de locais moçambicanos: "x", "sh"
 * e "ch" iguais, "z" e "ss" como "s", "c"/"qu" como "k", sem "h" mudo, sem letras dobradas.
 */
export function soundKey(word: string): string {
  return word
    .replace(/ph/g, 'f')
    .replace(/sh|ch|x/g, '§')
    .replace(/qu(?=[ei])/g, 'k')
    .replace(/c(?=[ei])/g, 's')
    .replace(/[cq]/g, 'k')
    .replace(/z/g, 's')
    .replace(/y/g, 'i')
    .replace(/w/g, 'u')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1');
}

/** Edições (inserir, apagar, trocar, inverter duas letras) de `a` para `b`, ou max + 1 quando são mais de `max` */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      row.push(d);
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

interface Words {
  words: string[];
  sounds: string[];
  /** O nome sem espaços, para "magoanine" escrito "magoa nine" ou o contrário */
  compact: string;
}

const wordsCache = new Map<string, Words>();

function wordsOf(text: string): Words {
  const cached = wordsCache.get(text);
  if (cached) return cached;
  const words = normalizeName(text).split(' ').filter(Boolean).map(canonical);
  const result = { words, sounds: words.map(soundKey), compact: words.join('') };
  if (wordsCache.size > 20000) wordsCache.clear();
  wordsCache.set(text, result);
  return result;
}

/**
 * Quão bem uma palavra escrita coincide com a melhor palavra de um nome:
 * 6 a mesma palavra, 5 o início de uma palavra, 4 soa igual (ou ao seu início), 3 dentro de uma
 * palavra, 2 a um erro (dois em palavras longas), 0 nenhuma. Números têm de coincidir exactamente
 * ou como início (um erro num número levaria a outra rua: "Rua 15" e "Rua 16").
 */
function wordMatch(typed: string, name: Words): number {
  const sound = soundKey(typed);
  const isNumber = /\d/.test(typed);
  let best = 0;
  for (let i = 0; i < name.words.length; i++) {
    const word = name.words[i];
    if (word === typed) return 6;
    if (word.startsWith(typed)) best = Math.max(best, 5);
    if (isNumber || best >= 4) continue;
    const wordSound = name.sounds[i];
    if (wordSound === sound || (sound.length >= 3 && wordSound.startsWith(sound))) best = Math.max(best, 4);
    else if (typed.length >= 3 && word.includes(typed)) best = Math.max(best, 3);
    else if (typed.length >= 4 && best < 2 && sound[0] === wordSound[0]) {
      // Os erros mantêm o primeiro som: "makalala", "zimpetu"; um erro, dois em palavras longas
      const allowed = typed.length >= 8 ? 2 : 1;
      const whole = editDistance(sound, wordSound, allowed);
      // um erro numa palavra ainda não acabada: "makalal" contra o início de "makalela"
      const start = typed.length >= 5 && wordSound.length > sound.length ? editDistance(sound, wordSound.slice(0, sound.length), allowed) : allowed + 1;
      if (Math.min(whole, start) <= allowed) best = 2;
    }
  }
  return best;
}

/**
 * Quão bem `name` coincide com a pesquisa escrita `query` (0 = não coincide; maior é melhor).
 * Cada palavra escrita tem de coincidir com uma palavra do nome, palavras de ligação à parte; a
 * pontuação é guiada pela palavra mais fraca, para que coincidências exactas e de início ("av ind"
 * para "Av. das Indústrias") venham antes das que soam igual e dos erros ("chipamanine",
 * "makalala"). Um nome inteiro igual fica em primeiro.
 */
export function matchScore(name: string, query: string): number {
  const all = wordsOf(query).words;
  if (!all.length) return 0;
  const meaningful = all.filter((w) => !FILLER.has(w));
  const typed = meaningful.length ? meaningful : all;
  const n = wordsOf(name);

  const levels = typed.map((t) => wordMatch(t, n));
  if (levels.every((l) => l > 0)) {
    const named = n.words.filter((w) => !FILLER.has(w)).join(' ');
    const asked = typed.join(' ');
    const whole = named === asked ? 60 : named.startsWith(asked) ? 30 : 0;
    const extra = Math.min(20, n.words.length - typed.length);
    return Math.min(...levels) * 100 + levels.reduce((a, b) => a + b, 0) * 10 + whole - extra;
  }
  // Espaços no sítio errado
  const compact = typed.join('');
  return compact.length >= 5 && n.compact.includes(compact) ? 150 : 0;
}

/**
 * Junta as paragens em locais: mesmo nome (sem os números de via entre parênteses, ver placeName),
 * a menos de PLACE_RADIUS_M de outra paragem do grupo. O local recebe o nome sem o número de via.
 */
export function groupPlaces<S extends NamedStop>(stops: S[]): Place<S>[] {
  const byName = new Map<string, S[]>();
  for (const s of stops) {
    const k = normalizeName(placeName(s.nome));
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
      places.push({ key: members[0].id, nome: placeName(members[0].nome), stops: members, point: [lat, lng] });
    }
  }
  return places;
}

/** Os locais cujo nome coincide com `query` (ver matchScore), os melhores primeiro, depois por nome. */
export function searchPlaces<S extends NamedStop>(places: Place<S>[], query: string, limit = 30): Place<S>[] {
  return places
    .map((p) => ({ p, score: matchScore(p.nome, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.nome.localeCompare(b.p.nome, 'pt'))
    .slice(0, limit)
    .map((x) => x.p);
}

/** Tempo a pé em minutos para uma distância em linha recta (as ruas acrescentam cerca de um quarto). */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * 1.25) / 75)); // 4,5 km/h
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}
