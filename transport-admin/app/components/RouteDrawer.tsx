"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * The map where a route is drawn: the admin clicks points (or stops), and the path between them
 * follows the roads (the public OSRM router). Only a road path can be saved: when the router
 * fails, the line is dashed and the page that uses it refuses to save. Used to create a route
 * (/vias/novo) and to redraw one (/vias/[id]/percurso).
 */

export type Point = [number, number]; // [lng, lat]

export interface RouteStop {
  id: string;
  nome: string;
  codigo: string;
  geoLocation: string | null; // "lat,lng"
}

/** What the drawing gives the page: the road path, and whether it can be saved */
export interface DrawnRoute {
  /** Points clicked */
  points: number;
  /** The road path, or the straight lines between the points while it is computed or failed */
  path: Point[];
  /** At least two points */
  hasRoute: boolean;
  /** The path matches the current points */
  ready: boolean;
  /** The router found no road: the path is straight lines, not to be saved */
  failed: boolean;
}

// The points clicked on the map, with undo/redo history (every change can be undone, also "Limpar")
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

/** Distance in metres from a stop to the closest vertex of a road path (OSRM paths are dense) */
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
 * A few points along a path (Douglas–Peucker, the tolerance doubled until at most max are left):
 * a drawing that starts from them follows the path's turns with few points to adjust.
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
  /** Every stop, on the map; clicking one adds a point exactly on it */
  stops: RouteStop[];
  /** Stops highlighted as being on the route */
  nearIds: Set<string>;
  /** A path shown dashed and grey under the drawing (the route's current path) */
  reference?: Point[];
  /** A button that starts the drawing from these points (a few points of the current path) */
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
  const [routeAttempt, setRouteAttempt] = useState(0); // "Tentar de novo" asks OSRM again

  // Road-following path for the clicked points. Each answer is tied to the points it was asked
  // for, so a slow answer for older points never replaces the path of the current ones.
  const pointsKey = drawing.points.map(([lng, lat]) => `${lng},${lat}`).join(";");
  useEffect(() => {
    const points = pointsKey ? pointsKey.split(";").map((p) => p.split(",").map(Number) as Point) : [];
    if (points.length < 2) return;
    let cancelled = false;
    fetch(`https://router.project-osrm.org/route/v1/driving/${pointsKey}?overview=full&geometries=geojson`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.code === "Ok" && data.routes?.[0]) setRoute({ key: pointsKey, path: data.routes[0].geometry.coordinates, failed: false });
        else setRoute({ key: pointsKey, path: points, failed: true });
      })
      .catch((error) => {
        console.error("Error fetching route:", error);
        if (!cancelled) setRoute({ key: pointsKey, path: points, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [pointsKey, routeAttempt]);

  const hasRoute = drawing.points.length >= 2;
  const routeReady = hasRoute && route?.key === pointsKey;
  const routingFailed = routeReady && route.failed;
  // While a new path is being computed the previous one stays on the map
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
              attribution: "© OpenStreetMap contributors",
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
        console.error("Map error:", e);
      });
      // Ready once the style is read, without waiting for every tile ("load"): on a slow network
      // the tilted view's many tiles would keep the points and stops off the map for a long time
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
      // Click to add a route point
      map.current.on("click", (e) => dispatch({ type: "add", point: [e.lngLat.lng, e.lngLat.lat] }));
    };
    // Delay map initialization to ensure container is rendered
    const timeoutId = setTimeout(() => requestAnimationFrame(initMap), 100);
    return () => {
      clearTimeout(timeoutId);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Undo / redo from the keyboard (not while typing in a field: those have their own undo)
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

  // The current path, under the drawing, and the map fitted to it
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

  // Numbered markers for the clicked points: drag one to move it, click one to remove it
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
        ev.stopPropagation(); // not a new point on the map
        if (dragged) {
          dragged = false;
          return;
        }
        dispatch({ type: "remove", index });
      });
      pointMarkersRef.current.push(marker);
    });
  }, [drawing.points, color, mapReady]);

  // Road path line
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

  // Every stop on the map. Clicking one adds a route point exactly on it.
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

  // Highlight the stops along the route
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
        <p className={`text-xs ${routingFailed ? "text-red-700" : "text-slate-600"}`} data-testid="route-status">
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
