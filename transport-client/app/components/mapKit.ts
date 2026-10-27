import maplibregl from "maplibre-gl";
import { formatEta, maputoClock } from "@/lib/eta";

/** Peças de mapa e formatos de hora partilhados pelo planeador (TripPlanner) e pelo acompanhamento da viagem (JourneyFollow). */

const GLIDE_MS = 1500;

export const BUS_SVG = `<svg width="30" height="36" viewBox="0 0 32 38" style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));cursor:pointer">
<rect x="6" y="10" width="20" height="22" rx="4" fill="#2563eb" stroke="#0a1f5c" stroke-width="1"/>
<rect x="8" y="8" width="16" height="3" rx="1.5" fill="#1e3a8a"/><rect x="8" y="12" width="16" height="5" rx="1.5" fill="#e0f2fe" opacity=".8"/>
<rect x="7" y="18" width="4" height="4" rx="1" fill="#dbeafe" opacity=".7"/><rect x="21" y="18" width="4" height="4" rx="1" fill="#dbeafe" opacity=".7"/>
<rect x="7" y="24" width="4" height="4" rx="1" fill="#dbeafe" opacity=".7"/><rect x="21" y="24" width="4" height="4" rx="1" fill="#dbeafe" opacity=".7"/>
<circle cx="11" cy="7" r="2" fill="#fef08a" stroke="#fff"/><circle cx="21" cy="7" r="2" fill="#fef08a" stroke="#fff"/>
<circle cx="10" cy="33" r="2.5" fill="#1f2937"/><circle cx="22" cy="33" r="2.5" fill="#1f2937"/></svg>`;

/** Crédito que o router da FOSSGIS pede (caminhadas pelas ruas), com o "corrigir o mapa" do OpenStreetMap */
export const WALK_ATTRIBUTION =
  'Percursos a pé: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">OSRM / FOSSGIS</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Corrigir o mapa</a>';

export const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// Move um marcador suavemente em vez de saltar; saltos grandes (uma posição GPS, um terminal) não são animados
export function glideMarker(marker: maplibregl.Marker, to: [number, number]) {
  const from = marker.getLngLat();
  const dLng = to[0] - from.lng;
  const dLat = to[1] - from.lat;
  if (Math.abs(dLng) + Math.abs(dLat) > 0.02) {
    marker.setLngLat(to);
    return;
  }
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / GLIDE_MS);
    marker.setLngLat([from.lng + dLng * k, from.lat + dLat * k]);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Conteúdo do balão construído como DOM, para os nomes vindos da base de dados nunca serem lidos como HTML (sem injecção de código). */
export function popupContent(lines: { text: string; bold?: boolean; color?: string; href?: string; key?: string }[]) {
  const div = document.createElement("div");
  div.style.color = "#0f172a";
  lines.forEach((line, i) => {
    if (i) div.appendChild(document.createElement("br"));
    const el = document.createElement(line.href ? "a" : line.bold ? "strong" : "span");
    el.textContent = line.text;
    if (line.key) el.dataset.key = line.key; // para encontrar a linha e actualizá-la depois (o estado de um autocarro)
    if (line.color) el.style.color = line.color;
    if (el instanceof HTMLAnchorElement) {
      el.href = line.href!;
      el.style.cssText =
        "display:inline-block;margin-top:6px;padding:4px 12px;border-radius:9999px;background:#0f172a;color:#fff;font-weight:600;font-size:12px;text-decoration:none";
    }
    div.appendChild(el);
  });
  return div;
}

/** Texto escuro ou branco, o que se ler melhor sobre a cor da via `hex`. */
export function textOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#0f172a" : "#ffffff";
}

/** Iniciais do passageiro com sessão ("HG"), ou null quando ninguém entrou. */
export function myInitials(): string | null {
  try {
    const nome: unknown = JSON.parse(localStorage.getItem("utente") ?? "null")?.nome;
    if (typeof nome !== "string" || !nome.trim()) return null;
    const words = nome.trim().split(/\s+/);
    return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : nome.trim().slice(0, 2)).toUpperCase();
  } catch {
    return null;
  }
}

export const PERSON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z"/></svg>`;

/** O marcador do passageiro: um alfinete com as suas iniciais (ou um ícone de pessoa), a pulsar na ponta. */
export function mePin() {
  const el = document.createElement("div");
  el.style.cssText = "position:relative;width:44px;height:52px;cursor:pointer";
  el.setAttribute("aria-label", "A sua localização");
  const pulse = document.createElement("div");
  pulse.style.cssText =
    "position:absolute;left:10px;bottom:-8px;width:24px;height:16px;border-radius:50%;background:#2563eb;opacity:.35;animation:tp-pulse 2s ease-out infinite";
  const pin = document.createElement("div");
  pin.style.cssText =
    "position:absolute;top:0;left:2px;width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#2563eb;border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35)";
  const face = document.createElement("div");
  face.style.cssText =
    "position:absolute;top:7px;left:9px;width:26px;height:26px;border-radius:50%;background:#0f172a;color:#fff;font:700 11px system-ui,sans-serif;display:flex;align-items:center;justify-content:center";
  el.append(pulse, pin, face);
  return { el, face };
}

/** Põe as iniciais do passageiro no alfinete, ou o ícone de pessoa quando ninguém entrou. */
export function paintFace(face: HTMLElement) {
  const initials = myInitials();
  if (initials) face.textContent = initials;
  else face.innerHTML = PERSON_SVG;
}

export const maputoDay = (d: Date) => d.toLocaleDateString("pt-PT", { timeZone: "Africa/Maputo" });

/** "às 17:58", ou "amanhã às 06:32" quando é no dia seguinte em Maputo. */
export function at(iso: string) {
  const d = new Date(iso);
  return `${maputoDay(d) === maputoDay(new Date()) ? "às" : "amanhã às"} ${maputoClock(d)}`;
}

/** "daqui a 7 min" para um momento na próxima hora, senão nada (mostra-se a hora). */
export function soon(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutes >= 60) return null;
  return minutes <= 1 ? "agora" : `daqui a ${formatEta(minutes).text}`;
}

/** "35 min", ou "10 h 55 min" para esperas longas. */
export function duration(minutes: number) {
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
}
