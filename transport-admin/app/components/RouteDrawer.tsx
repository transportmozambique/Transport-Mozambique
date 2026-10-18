"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * O mapa onde se desenha uma via: o administrador clica em pontos (ou paragens), e o percurso
 * entre eles segue as estradas (um router OSRM público). Só um percurso pelas estradas pode ser
 * guardado: quando nenhum router responde, a linha fica tracejada e a página que o usa recusa
 * guardar. Porquê: um percurso em linhas rectas daria distâncias, tarifas e posições erradas.
 * Usado para criar uma via (/vias/novo) e para a redesenhar (/vias/[id]/percurso).
 */

export type Point = [number, number]; // [lng, lat]

/** Routers OSRM públicos de carro, por ordem: o da FOSSGIS (openstreetmap.de), depois o servidor de demonstração do OSRM */
const ROUTERS = [
  "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  "https://router.project-osrm.org/route/v1/driving",
];

/** O percurso pelas estradas através de `pointsKey` ("lng,lat;lng,lat;…"), ou null quando nenhum router tem um */
async function routeThroughPoints(pointsKey: string): Promise<Point[] | null> {
  for (const base of ROUTERS) {
    try {
      const res = await fetch(`${base}/${pointsKey}?overview=full&geometries=geojson`);
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.[0]) return data.routes[0].geometry.coordinates;
    } catch (error) {
      console.error(`O router ${base} falhou:`, error);
    }
  }
  return null;
}

export interface RouteStop {
  id: string;
  nome: string;
  codigo: string;
  geoLocation: string | null; // "lat,lng"
}

/** O que o desenho dá à página: o percurso pelas estradas, e se pode ser guardado */
export interface DrawnRoute {
  /** Os pontos clicados */
  points: number;
  /** O percurso pelas estradas, ou as linhas rectas entre os pontos enquanto é calculado ou quando falhou */
  path: Point[];
  /** Pelo menos dois pontos */
  hasRoute: boolean;
  /** O percurso corresponde aos pontos actuais */
  ready: boolean;
  /** O router não encontrou estrada: o percurso são linhas rectas, que não se guardam */
  failed: boolean;
}

// Os pontos clicados no mapa, com histórico para desfazer/refazer (tudo se pode desfazer, também "Limpar")
interface Drawing {
  points: Point[];
  past: Point[][];
  future: Point[][];
}

type DrawAction =
  | { type: "add"; point: Point }
  | { type: "move"; index: number; point: Point }
  | { type: "remove"; index: number }
  | { type: "set"; points: Point[] }
  | { type: "clear" }
  | { type: "undo" }
  | { type: "redo" };

function drawingReducer(s: Drawing, a: DrawAction): Drawing {
  const commit = (points: Point[]): Drawing => ({ points, past: [...s.past, s.points], future: [] });
  switch (a.type) {
    case "add":
      return commit([...s.points, a.point]);
    case "move":
      return commit(s.points.map((p, i) => (i === a.index ? a.point : p)));
    case "remove":
      return commit(s.points.filter((_, i) => i !== a.index));
    case "set":
      return commit(a.points);
    case "clear":
      return s.points.length ? commit([]) : s;
    case "undo":
      return s.past.length ? { points: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.points, ...s.future] } : s;
    case "redo":
      return s.future.length ? { points: s.future[0], past: [...s.past, s.points], future: s.future.slice(1) } : s;
  }
}

export function parseLatLng(geo: string | null): [number, number] | null {
  const [lat, lng] = (geo || "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

/** Distância em metros de uma paragem ao vértice mais próximo de um percurso (os percursos do OSRM são densos) */
export function distanceToPath([lat, lng]: [number, number], path: Point[]): number {
  const k = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const [pLng, pLat] of path) {
    const dLat = pLat - lat;
    const dLng = (pLng - lng) * k;
    best = Math.min(best, dLat * dLat + dLng * dLng);
  }
  return Math.sqrt(best) * 111320;
}

export function pathKm(path: Point[]): number {
  return path.slice(1).reduce((sum, [lng, lat], i) => {
    const [pLng, pLat] = path[i];
    const k = Math.cos((lat * Math.PI) / 180);
    return sum + Math.hypot(lat - pLat, (lng - pLng) * k) * 111.32;
  }, 0);
}

/**
 * Poucos pontos ao longo de um percurso (Douglas–Peucker, com a tolerância a dobrar até ficarem no
 * máximo max): um desenho que parte deles segue as curvas do percurso com poucos pontos a ajustar.
 */
export function pathPoints(path: Point[], max = 25): Point[] {
  if (path.length <= 2) return path;
  const k = Math.cos((path[0][1] * Math.PI) / 180) * 111320;
  const xy = ([lng, lat]: Point) => [lng * k, lat * 111320];
  const toSegment = (p: Point, a: Point, b: Point) => {
    const [px, py] = xy(p);
    const [ax, ay] = xy(a);
    const [bx, by] = xy(b);
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  };
  for (let tol = 20; ; tol *= 2) {
    const keep = new Set([0, path.length - 1]);
    const stack: [number, number][] = [[0, path.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      let far = -1;
      let dmax = tol;
      for (let i = a + 1; i < b; i++) {
        const d = toSegment(path[i], path[a], path[b]);
        if (d > dmax) {
          dmax = d;
          far = i;
        }
      }
      if (far > 0) {
        keep.add(far);
        stack.push([a, far], [far, b]);
      }
    }
    if (keep.size <= max) return [...keep].sort((x, y) => x - y).map((i) => path[i]);
  }
}

export default function RouteDrawer({
  color,
  stops,
  nearIds,
  reference,
  seed,
  onChange,
  title = "Desenhar Rota no Mapa",
  className = "",
}: {
  color: string;
  /** Todas as paragens, no mapa; clicar numa junta um ponto exactamente nela */
  stops: RouteStop[];
  /** Paragens realçadas por estarem na via */
  nearIds: Set<string>;
  /** Um percurso mostrado tracejado e cinzento por baixo do desenho (o percurso actual da via) */
  reference?: Point[];
  /** Um botão que começa o desenho a partir destes pontos (alguns pontos do percurso actual) */
  seed?: { label: string; points: Point[] };
  onChange: (route: DrawnRoute) => void;
  title?: string;
  className?: string;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const pointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const stopMarkersRef = useRef(new Map<string, maplibregl.Marker>());
  const [drawing, dispatch] = useReducer(drawingReducer, { points: [], past: [], future: [] });
  const [route, setRoute] = useState<{ key: string; path: Point[]; failed: boolean } | null>(null);
  const [routeAttempt, setRouteAttempt] = useState(0); // "Tentar de novo" pergunta outra vez aos routers

  // Percurso pelas estradas para os pontos clicados. Cada resposta fica ligada aos pontos para que
  // foi pedida, para uma resposta lenta de pontos antigos nunca substituir o percurso dos actuais.
  const pointsKey = drawing.points.map(([lng, lat]) => `${lng},${lat}`).join(";");
  useEffect(() => {
    const points = pointsKey ? pointsKey.split(";").map((p) => p.split(",").map(Number) as Point) : [];
    if (points.length < 2) return;
    let cancelled = false;
    routeThroughPoints(pointsKey).then((path) => {
      if (!cancelled) setRoute(path ? { key: pointsKey, path, failed: false } : { key: pointsKey, path: points, failed: true });
    });
    return () => {
      cancelled = true;
    };
  }, [pointsKey, routeAttempt]);

  const hasRoute = drawing.points.length >= 2;
  const routeReady = hasRoute && route?.key === pointsKey;
  const routingFailed = routeReady && route.failed;
  // Enquanto um percurso novo é calculado, o anterior fica no mapa
  const routedPath: Point[] = useMemo(() => (hasRoute && route ? route.path : []), [hasRoute, route]);

  useEffect(() => {
    onChange({ points: drawing.points.length, path: routedPath, hasRoute, ready: routeReady, failed: routingFailed });
  }, [onChange, drawing.points.length, routedPath, hasRoute, routeReady, routingFailed]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    const initMap = () => {
      if (!mapContainer.current) return;
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            "osm-tiles": {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors · Rotas: OSRM / FOSSGIS",
              maxzoom: 19,
            },
          },
          layers: [{ id: "osm-tiles", type: "raster", source: "osm-tiles", minzoom: 0, maxzoom: 19 }],
        },
        center: [32.5892, -25.9655], // Maputo
        zoom: 12,
        pitch: 60,
        maxZoom: 19,
      });
      map.current.addControl(new maplibregl.NavigationControl(), "top-right");
      map.current.on("error", (e) => {
        if (e.error?.message?.includes("Failed to fetch") || e.error?.message?.includes("tile")) return;
        console.error("Erro do mapa:", e);
      });
      // Pronto logo que o estilo é lido, sem esperar por todos os mosaicos ("load"): numa rede lenta,
      // os muitos mosaicos da vista inclinada deixariam os pontos e as paragens fora do mapa muito tempo
      map.current.once("style.load", () => {
        if (!map.current) return;
        map.current.addSource("openmaptiles", { type: "vector", url: "https://tiles.openfreemap.org/planet" });
        map.current.addLayer({
          id: "3d-buildings",
          source: "openmaptiles",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": ["get", "render_height"],
            "fill-extrusion-base": ["get", "render_min_height"],
            "fill-extrusion-opacity": 0.6,
          },
        });
        setMapReady(true);
      });
      // Clicar para juntar um ponto da via
      map.current.on("click", (e) => dispatch({ type: "add", point: [e.lngLat.lng, e.lngLat.lat] }));
    };
    // Atrasar a criação do mapa para o contentor já estar desenhado
    const timeoutId = setTimeout(() => requestAnimationFrame(initMap), 100);
    return () => {
      clearTimeout(timeoutId);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Desfazer / refazer pelo teclado (não enquanto se escreve num campo: esses têm o seu próprio desfazer)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "undo" });
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // O percurso actual, por baixo do desenho, e o mapa enquadrado nele
  const referenceKey = reference?.length ? `${reference[0]}|${reference.length}` : "";
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady || !reference || reference.length < 2) return;
    const data: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: reference } };
    const source = m.getSource("reference") as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      m.addSource("reference", { type: "geojson", data });
      m.addLayer({
        id: "reference",
        type: "line",
        source: "reference",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#475569", "line-width": 4, "line-opacity": 0.75, "line-dasharray": [1.5, 1.5] },
      });
    }
    const bounds = reference.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(reference[0], reference[0]));
    m.fitBounds(bounds, { padding: 40, pitch: 0, duration: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only for another path
  }, [referenceKey, mapReady]);

  // Marcadores numerados para os pontos clicados: arrastar um para o mover, clicar num para o tirar
  useEffect(() => {
    const m = map.current;
    pointMarkersRef.current.forEach((marker) => marker.remove());
    pointMarkersRef.current = [];
    if (!m || !mapReady) return;
    drawing.points.forEach((point, index) => {
      const el = document.createElement("div");
      el.textContent = String(index + 1);
      el.title = "Arraste para mover · clique para remover";
      el.dataset.testid = "route-point";
      el.style.cssText = `
        min-width: 20px; height: 20px; padding: 0 4px; background: ${color}; color: white;
        font: 600 11px/14px system-ui, sans-serif; text-align: center; border: 3px solid white;
        border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer;
      `;
      const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(point).addTo(m);
      let dragged = false;
      marker.on("dragstart", () => {
        dragged = true;
      });
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        dispatch({ type: "move", index, point: [lng, lat] });
      });
      el.addEventListener("click", (ev) => {
        ev.stopPropagation(); // não é um ponto novo no mapa
        if (dragged) {
          dragged = false;
          return;
        }
        dispatch({ type: "remove", index });
      });
      pointMarkersRef.current.push(marker);
    });
  }, [drawing.points, color, mapReady]);

  // Linha do percurso pelas estradas
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    if (routedPath.length < 2) {
      if (m.getLayer("route")) m.removeLayer("route");
      if (m.getSource("route")) m.removeSource("route");
      return;
    }
    const data: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routedPath } };
    const source = m.getSource("route") as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      m.addSource("route", { type: "geojson", data });
      m.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": color, "line-width": 4 },
      });
    }
    m.setPaintProperty("route", "line-color", color);
    m.setPaintProperty("route", "line-dasharray", routingFailed ? [2, 2] : [1, 0]);
  }, [routedPath, routingFailed, color, mapReady]);

  // Todas as paragens no mapa. Clicar numa junta um ponto da via exactamente nela.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    const markers = stopMarkersRef.current;
    markers.forEach((marker) => marker.remove());
    markers.clear();
    stops.forEach((paragem) => {
      const at = parseLatLng(paragem.geoLocation);
      if (!at) return;
      const [lat, lng] = at;
      const el = document.createElement("div");
      el.style.cssText = `
        width: 10px; height: 10px; background: #6b7280; border: 2px solid white; border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: pointer;
      `;
      const popup = new maplibregl.Popup({ offset: 10 });
      const box = document.createElement("div");
      box.style.cssText = "color: black; font-size: 12px;";
      const name = document.createElement("strong");
      name.textContent = paragem.nome;
      const code = document.createElement("span");
      code.style.cssText = "font-family: monospace; font-size: 10px;";
      code.textContent = paragem.codigo;
      box.append(name, document.createElement("br"), code);
      popup.setDOMContent(box);
      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).setPopup(popup).addTo(m);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        dispatch({ type: "add", point: [lng, lat] });
        marker.togglePopup();
      });
      markers.set(paragem.id, marker);
    });
  }, [stops, mapReady]);

  // Realçar as paragens ao longo da via
  useEffect(() => {
    stopMarkersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      const near = nearIds.has(id);
      el.style.background = near ? color : "#6b7280";
      el.style.width = near ? "12px" : "10px";
      el.style.height = near ? "12px" : "10px";
      el.style.border = near ? "3px solid white" : "2px solid white";
    });
  }, [nearIds, color, stops, mapReady]);

  const button =
    "px-3 py-1.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 mt-1">
              Clique no mapa ou numa paragem para adicionar um ponto. Arraste um ponto para o mover; clique nele para o remover.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {seed && seed.points.length >= 2 && (
              <button type="button" onClick={() => dispatch({ type: "set", points: seed.points })} className={button}>
                {seed.label}
              </button>
            )}
            <button type="button" onClick={() => dispatch({ type: "undo" })} disabled={!drawing.past.length} title="Desfazer (Ctrl+Z)" className={button}>
              ↶ Desfazer
            </button>
            <button type="button" onClick={() => dispatch({ type: "redo" })} disabled={!drawing.future.length} title="Refazer (Ctrl+Y)" className={button}>
              ↷ Refazer
            </button>
            <button type="button" onClick={() => dispatch({ type: "clear" })} disabled={!drawing.points.length} className={button}>
              Limpar Rota
            </button>
          </div>
        </div>
        <p className={`text-xs ${routingFailed ? "text-slate-800" : "text-slate-600"}`} data-testid="route-status">
          {!hasRoute && "Adicione pelo menos dois pontos."}
          {hasRoute && !routeReady && "A calcular o percurso pelas estradas…"}
          {routeReady && !routingFailed && `Percurso pelas estradas: ${pathKm(routedPath).toFixed(1)} km`}
          {routingFailed && "Não foi possível calcular o percurso pelas estradas (linha tracejada). "}
          {routingFailed && (
            <button
              type="button"
              onClick={() => {
                setRoute(null);
                setRouteAttempt((n) => n + 1);
              }}
              className="underline font-medium"
            >
              Tentar de novo
            </button>
          )}
        </p>
      </div>
      <div ref={mapContainer} className="w-full h-[420px] sm:h-[600px] lg:h-[calc(100dvh-24rem)] lg:min-h-[420px]" />
    </div>
  );
}
