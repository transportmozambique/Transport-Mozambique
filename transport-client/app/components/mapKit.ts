import maplibregl from "maplibre-gl";
import { formatEta, maputoClock } from "@/lib/eta";

/** Map pieces and time formats shared by the planner (TripPlanner) and journey tracking (JourneyFollow). */

const GLIDE_MS = 1500;

export const BUS_SVG = `<svg width="30" height="36" viewBox="0 0 32 38" style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));cursor:pointer">
<rect x="6" y="10" width="20" height="22" rx="1.5" fill="#2563eb" stroke="#0a1f5c" stroke-width="1"/>
<rect x="8" y="8" width="16" height="3" rx=".5" fill="#1e3a8a"/><rect x="8" y="12" width="16" height="5" rx=".5" fill="#e0f2fe" opacity=".8"/>
<rect x="7" y="18" width="4" height="4" rx=".3" fill="#dbeafe" opacity=".7"/><rect x="21" y="18" width="4" height="4" rx=".3" fill="#dbeafe" opacity=".7"/>
<rect x="7" y="24" width="4" height="4" rx=".3" fill="#dbeafe" opacity=".7"/><rect x="21" y="24" width="4" height="4" rx=".3" fill="#dbeafe" opacity=".7"/>
<circle cx="11" cy="7" r="2" fill="#fef08a" stroke="#fff"/><circle cx="21" cy="7" r="2" fill="#fef08a" stroke="#fff"/>
<circle cx="10" cy="33" r="2.5" fill="#1f2937"/><circle cx="22" cy="33" r="2.5" fill="#1f2937"/></svg>`;

export const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// Moves a marker smoothly instead of jumping; far jumps (a GPS fix, a terminal) are not animated
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

/** Popup content built as DOM, so names from the database are never parsed as HTML. */
export function popupContent(lines: { text: string; bold?: boolean; color?: string; href?: string }[]) {
  const div = document.createElement("div");
  div.style.color = "#0f172a";
  lines.forEach((line, i) => {
    if (i) div.appendChild(document.createElement("br"));
    const el = document.createElement(line.href ? "a" : line.bold ? "strong" : "span");
    el.textContent = line.text;
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

/** Dark or white text, whichever reads better on the route colour `hex`. */
export function textOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#0f172a" : "#ffffff";
}

/** Initials of the signed-in passenger ("HG"), or null when nobody is signed in. */
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

/** The passenger's marker: a pin with their initials (or a person icon), pulsing at its tip. */
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

/** Puts the passenger's initials in the pin, or the person icon when nobody is signed in. */
export function paintFace(face: HTMLElement) {
  const initials = myInitials();
  if (initials) face.textContent = initials;
  else face.innerHTML = PERSON_SVG;
}

export const maputoDay = (d: Date) => d.toLocaleDateString("pt-PT", { timeZone: "Africa/Maputo" });

/** "às 17:58", or "amanhã às 06:32" when it is on the next day in Maputo. */
export function at(iso: string) {
  const d = new Date(iso);
  return `${maputoDay(d) === maputoDay(new Date()) ? "às" : "amanhã às"} ${maputoClock(d)}`;
}

/** "daqui a 7 min" for a moment in the next hour, else nothing (the clock time is shown). */
export function soon(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutes >= 60) return null;
  return minutes <= 1 ? "agora" : `daqui a ${formatEta(minutes).text}`;
}

/** "35 min", or "10 h 55 min" for long waits. */
export function duration(minutes: number) {
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
}
