"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Journey, StopDestinations, StopRef, WalkLeg } from "@/lib/journeys";
import { formatEta, maputoClock } from "@/lib/eta";
import { distanceMeters, formatDistance, groupPlaces, searchPlaces, walkMinutes, type Place, type Point } from "@/lib/places";
import UserAvatar from "./UserAvatar";

/**
 * The passenger's map: live buses, the passenger's position and the stops near it. Tapping a
 * stop lists where its buses go; choosing a destination (or typing one) shows journeys, with
 * changes of bus when no single bus goes there, drawn on the map.
 */

interface NetVia {
  id: string;
  codigo: string;
  nome: string;
  cor: string;
}

interface NetStop {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  v: number[];
  point: Point;
}

interface Bus {
  id: string;
  matricula: string;
  via: string;
  latitude: number;
  longitude: number;
  status: string;
  routePath: [number, number][];
}

type View =
  | { kind: "nearby" }
  | { kind: "stop"; stopId: string }
  | { kind: "journeys"; from: { stopIds: string[] } | { me: Point }; fromLabel: string; to: string[]; toLabel: string; back: View };

type JourneysState = Extract<View, { kind: "journeys" }>;

type LocationState = "asking" | "ok" | "denied" | "unavailable";

const MAPUTO: Point = [-25.9655, 32.5892];
/** Farther than this from Maputo, the position is not used to centre the map */
const SERVICE_AREA_M = 80_000;
const NEAR_RADIUS_M = 1500;
const NEAR_MAX = 8;
const BUS_REFRESH_MS = 5000;
const GLIDE_MS = 1500;

const BUS_SVG = `<svg width="30" height="36" viewBox="0 0 32 38" style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));cursor:pointer">
<rect x="6" y="10" width="20" height="22" rx="1.5" fill="#2563eb" stroke="#0a1f5c" stroke-width="1"/>
<rect x="8" y="8" width="16" height="3" rx=".5" fill="#1e3a8a"/><rect x="8" y="12" width="16" height="5" rx=".5" fill="#e0f2fe" opacity=".8"/>
<rect x="7" y="18" width="4" height="4" rx=".3" fill="#dbeafe" opacity=".7"/><rect x="21" y="18" width="4" height="4" rx=".3" fill="#dbeafe" opacity=".7"/>
<rect x="7" y="24" width="4" height="4" rx=".3" fill="#dbeafe" opacity=".7"/><rect x="21" y="24" width="4" height="4" rx=".3" fill="#dbeafe" opacity=".7"/>
<circle cx="11" cy="7" r="2" fill="#fef08a" stroke="#fff"/><circle cx="21" cy="7" r="2" fill="#fef08a" stroke="#fff"/>
<circle cx="10" cy="33" r="2.5" fill="#1f2937"/><circle cx="22" cy="33" r="2.5" fill="#1f2937"/></svg>`;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// Moves a marker smoothly instead of jumping; far jumps (a GPS fix, a terminal) are not animated
function glideMarker(marker: maplibregl.Marker, to: [number, number]) {
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
function popupContent(lines: { text: string; bold?: boolean; color?: string; href?: string }[]) {
  const div = document.createElement("div");
  div.style.color = "#0f172a";
  lines.forEach((line, i) => {
    if (i) div.appendChild(document.createElement("br"));
    const el = document.createElement(line.href ? "a" : line.bold ? "strong" : "span");
    el.textContent = line.text;
    if (line.color) el.style.color = line.color;
    if (el instanceof HTMLAnchorElement) {
      el.href = line.href!;
      el.style.fontWeight = "600";
      el.style.textDecoration = "underline";
    }
    div.appendChild(el);
  });
  return div;
}

/** Dark or white text, whichever reads better on the route colour `hex`. */
function textOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#0f172a" : "#ffffff";
}

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

/**
 * The part of the map the panels cover. Set as the map's own padding (MapLibre also keeps the
 * padding of flyTo/easeTo, and fitBounds adds its own on top), so centring and fitting use the
 * visible part of the map.
 */
function mapPadding(sheetOpen: boolean) {
  return isDesktop()
    ? { top: 90, bottom: 0, left: 420, right: 0 }
    : { top: 80, bottom: sheetOpen ? Math.round(window.innerHeight * 0.5) : 64, left: 0, right: 0 };
}

const maputoDay = (d: Date) => d.toLocaleDateString("pt-PT", { timeZone: "Africa/Maputo" });

/** "às 17:58", or "amanhã às 06:32" when it is on the next day in Maputo. */
function at(iso: string) {
  const d = new Date(iso);
  return `${maputoDay(d) === maputoDay(new Date()) ? "às" : "amanhã às"} ${maputoClock(d)}`;
}

/** "daqui a 7 min" for a moment in the next hour, else nothing (the clock time is shown). */
function soon(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutes >= 60) return null;
  return minutes <= 1 ? "agora" : `daqui a ${formatEta(minutes).text}`;
}

/** "35 min", or "10 h 55 min" for long waits. */
function duration(minutes: number) {
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
}

/** Runs of stops with the same name (both sides of a street, one avenue) shown once. */
function distinctNames<T extends { nome: string }>(list: T[]): T[] {
  return list.filter((s, i) => i === 0 || s.nome.trim().toLowerCase() !== list[i - 1].nome.trim().toLowerCase());
}

export default function TripPlanner() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const busMarkers = useRef(new Map<string, maplibregl.Marker>());
  const meMarker = useRef<maplibregl.Marker | null>(null);
  const centredOnMe = useRef(false);
  const selectStop = useRef<(id: string) => void>(() => {});

  const [vias, setVias] = useState<NetVia[]>([]);
  const [stops, setStops] = useState<NetStop[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [netError, setNetError] = useState(false);
  const [me, setMe] = useState<Point | null>(null);
  const [locState, setLocState] = useState<LocationState>("asking");
  const [mapCentre, setMapCentre] = useState<Point>(MAPUTO);
  const [view, setView] = useState<View>({ kind: "nearby" });
  const [expanded, setExpanded] = useState(true);
  // Signed in when the passenger app stored a session (read after hydration, false on the server)
  const signedIn = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      return () => window.removeEventListener("storage", onChange);
    },
    () => {
      try {
        return Boolean(localStorage.getItem("utente"));
      } catch {
        return false;
      }
    },
    () => false,
  );

  const stopById = useMemo(() => new Map(stops.map((s) => [s.id, s])), [stops]);
  const places = useMemo(() => groupPlaces(stops), [stops]);

  // ── Data ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/stops")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { vias: NetVia[]; paragens: Omit<NetStop, "point">[] }) => {
        setVias(data.vias);
        setStops(data.paragens.map((s) => ({ ...s, point: [s.lat, s.lng] as Point })));
      })
      .catch(() => setNetError(true));
    fetch("/api/buses")
      .then((res) => res.json())
      .then((data) => setBuses(data.buses ?? []))
      .catch(() => setBuses([]));
  }, []);

  // ── Position ────────────────────────────────────────────────────────────────
  const watchId = useRef<number | null>(null);
  const watchPosition = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setMe([pos.coords.latitude, pos.coords.longitude]);
        setLocState("ok");
      },
      (err) => setLocState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
  }, []);

  // Asked when the page opens: the map is about the stops around the passenger
  useEffect(() => {
    watchPosition();
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [watchPosition]);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setLocState("unavailable");
      return;
    }
    if (locState !== "ok") setLocState("asking");
    watchPosition();
  };

  const meInArea = me !== null && distanceMeters(me, MAPUTO) <= SERVICE_AREA_M;

  // ── Map ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || map.current) return;
    const m = new maplibregl.Map({
      container: mapRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [MAPUTO[1], MAPUTO[0]],
      zoom: 12,
      pitch: 30,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    m.on("load", () => {
      m.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      const firstSymbol = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
      if (!m.getSource("openmaptiles")) m.addSource("openmaptiles", { type: "vector", url: "https://tiles.openfreemap.org/planet" });
      m.addLayer(
        {
          id: "3d-buildings",
          source: "openmaptiles",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#d1d5db",
            "fill-extrusion-height": ["case", ["has", "render_height"], ["get", "render_height"], 5],
            "fill-extrusion-base": ["case", ["has", "render_min_height"], ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": 0.8,
          },
        },
        firstSymbol,
      );

      for (const id of ["bus-route", "journey", "stops", "nearby", "selected"]) m.addSource(id, { type: "geojson", data: EMPTY });
      m.addLayer({ id: "bus-route", type: "line", source: "bus-route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ef4444", "line-width": 4, "line-opacity": 0.8 } });
      m.addLayer({
        id: "journey-walk",
        type: "line",
        source: "journey",
        filter: ["==", ["get", "kind"], "walk"],
        paint: { "line-color": "#334155", "line-width": 3, "line-dasharray": [1, 1.5] },
      });
      // Dark outline: some route colours are very light
      m.addLayer({
        id: "journey-bus-casing",
        type: "line",
        source: "journey",
        filter: ["==", ["get", "kind"], "bus"],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#0f172a", "line-width": 9, "line-opacity": 0.55 },
      });
      m.addLayer({
        id: "journey-bus",
        type: "line",
        source: "journey",
        filter: ["==", ["get", "kind"], "bus"],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 6, "line-opacity": 0.9 },
      });
      m.addLayer({
        id: "journey-points",
        type: "circle",
        source: "journey",
        filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-radius": 7, "circle-color": ["get", "color"], "circle-stroke-color": "#0f172a", "circle-stroke-width": 3 },
      });
      m.addLayer({
        id: "stops-dot",
        type: "circle",
        source: "stops",
        minzoom: 13,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 3, 16, 7],
          "circle-color": "#ffffff",
          "circle-stroke-color": "#475569",
          "circle-stroke-width": 2,
        },
      });
      m.addLayer({
        id: "nearby-dot",
        type: "circle",
        source: "nearby",
        paint: { "circle-radius": 8, "circle-color": "#10b981", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
      });
      m.addLayer({
        id: "selected-dot",
        type: "circle",
        source: "selected",
        paint: { "circle-radius": 11, "circle-color": "#0f172a", "circle-stroke-color": "#ffffff", "circle-stroke-width": 4 },
      });

      for (const layer of ["stops-dot", "nearby-dot"]) {
        m.on("click", layer, (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "string") selectStop.current(id);
        });
        m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
      }
      m.on("moveend", () => {
        const c = m.getCenter();
        setMapCentre([c.lat, c.lng]);
      });
      setMapReady(true);
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  const source = (id: string) => map.current?.getSource(id) as GeoJSONSource | undefined;

  // Keep the map's padding equal to what the panel covers
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const m = map.current;
    const apply = () => m.setPadding(mapPadding(expanded));
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [mapReady, expanded]);

  // Every stop, as small dots when zoomed in
  useEffect(() => {
    if (!mapReady) return;
    source("stops")?.setData({
      type: "FeatureCollection",
      features: stops.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] }, properties: { id: s.id } })),
    });
  }, [mapReady, stops]);

  // Live buses
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const m = map.current;
    for (const bus of buses) {
      if (busMarkers.current.has(bus.id)) continue;
      const el = document.createElement("div");
      el.innerHTML = BUS_SVG;
      el.setAttribute("aria-label", `Autocarro ${bus.matricula}`);
      const popup = new maplibregl.Popup({ offset: 20 }).setDOMContent(
        popupContent([
          { text: bus.matricula, bold: true },
          { text: bus.via },
          { text: bus.status, color: "#059669" },
          { text: "Acompanhar →", href: `/track/${bus.id}` },
        ]),
      );
      el.addEventListener("click", () => {
        const route = source("bus-route");
        route?.setData(
          bus.routePath?.length
            ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: bus.routePath } }
            : EMPTY,
        );
      });
      busMarkers.current.set(bus.id, new maplibregl.Marker({ element: el }).setLngLat([bus.longitude, bus.latitude]).setPopup(popup).addTo(m));
    }
  }, [mapReady, buses]);

  useEffect(() => {
    if (!buses.length) return;
    const interval = setInterval(async () => {
      try {
        const data = await fetch("/api/buses?fields=position").then((res) => res.json());
        for (const bus of data.buses ?? []) {
          const marker = busMarkers.current.get(bus.id);
          if (marker) glideMarker(marker, [bus.longitude, bus.latitude]);
        }
      } catch {
        // Next refresh will try again
      }
    }, BUS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [buses.length]);

  // The passenger's position
  useEffect(() => {
    if (!mapReady || !map.current || !me) return;
    if (!meMarker.current) {
      const el = document.createElement("div");
      el.innerHTML = `<div style="position:relative;width:32px;height:32px">
        <div style="position:absolute;inset:4px;background:#3b82f6;border-radius:50%;opacity:.3;animation:tp-pulse 2s ease-out infinite"></div>
        <div style="position:absolute;top:8px;left:8px;width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div></div>`;
      el.setAttribute("aria-label", "A sua localização");
      meMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat([me[1], me[0]])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setDOMContent(popupContent([{ text: "Está aqui", bold: true }])))
        .addTo(map.current);
    } else {
      meMarker.current.setLngLat([me[1], me[0]]);
    }
    if (!centredOnMe.current && meInArea) {
      centredOnMe.current = true;
      map.current.flyTo({ center: [me[1], me[0]], zoom: 15, duration: 1200 });
    }
  }, [mapReady, me, meInArea]);

  // Stops near the passenger (or near the centre of the map when the position is unknown)
  const anchor: Point = me && meInArea ? me : mapCentre;
  const nearby = useMemo(() => {
    const all = stops.map((s) => ({ stop: s, m: distanceMeters(anchor, s.point) })).sort((a, b) => a.m - b.m);
    const close = all.filter((x) => x.m <= NEAR_RADIUS_M).slice(0, NEAR_MAX);
    return close.length ? close : all.slice(0, 3);
  }, [stops, anchor]);

  useEffect(() => {
    if (!mapReady) return;
    source("nearby")?.setData({
      type: "FeatureCollection",
      features:
        view.kind === "journeys"
          ? []
          : nearby.map(({ stop }) => ({ type: "Feature", geometry: { type: "Point", coordinates: [stop.lng, stop.lat] }, properties: { id: stop.id } })),
    });
  }, [mapReady, nearby, view.kind]);

  // ── Views ───────────────────────────────────────────────────────────────────
  const openStop = useCallback(
    (id: string) => {
      setView({ kind: "stop", stopId: id });
      setExpanded(true);
      const s = stopById.get(id);
      if (s && map.current) map.current.easeTo({ center: [s.lng, s.lat], zoom: Math.max(map.current.getZoom(), 15) });
    },
    [stopById],
  );
  // The map's click handlers are attached once, when it loads; they call the latest openStop
  useEffect(() => {
    selectStop.current = openStop;
  }, [openStop]);

  const selectedStopId = view.kind === "stop" ? view.stopId : null;
  useEffect(() => {
    if (!mapReady) return;
    const s = selectedStopId ? stopById.get(selectedStopId) : null;
    source("selected")?.setData(
      s ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [s.lng, s.lat] } } : EMPTY,
    );
  }, [mapReady, selectedStopId, stopById]);

  const planTo = (place: { ids: string[]; label: string }, from: JourneysState["from"], fromLabel: string) => {
    setView({ kind: "journeys", from, fromLabel, to: place.ids, toLabel: place.label, back: view });
    setExpanded(true);
  };

  const showJourney = useCallback(
    (journey: Journey | null) => {
      if (!mapReady || !map.current) return;
      // While a journey is shown, only its buses stay on the map
      const used = new Set(journey?.etapas.flatMap((e) => (e.tipo === "autocarro" ? [e.transporte.id] : [])));
      for (const [id, marker] of busMarkers.current) marker.getElement().style.display = !journey || used.has(id) ? "" : "none";
      if (!journey) {
        source("journey")?.setData(EMPTY);
        return;
      }
      const features: GeoJSON.Feature[] = [];
      const bounds = new maplibregl.LngLatBounds();
      for (const leg of journey.etapas) {
        if (leg.tipo === "pe") {
          const line: [number, number][] = [[leg.de.lng, leg.de.lat], [leg.para.lng, leg.para.lat]];
          features.push({ type: "Feature", properties: { kind: "walk" }, geometry: { type: "LineString", coordinates: line } });
          line.forEach((p) => bounds.extend(p));
        } else {
          const line = leg.percurso.length > 1 ? leg.percurso : [[leg.de.lng, leg.de.lat], [leg.para.lng, leg.para.lat]];
          features.push({ type: "Feature", properties: { kind: "bus", color: leg.via.cor || "#2563eb" }, geometry: { type: "LineString", coordinates: line } });
          for (const end of [leg.de, leg.para]) {
            features.push({ type: "Feature", properties: { color: leg.via.cor || "#2563eb" }, geometry: { type: "Point", coordinates: [end.lng, end.lat] } });
          }
          line.forEach((p) => bounds.extend(p as [number, number]));
        }
      }
      source("journey")?.setData({ type: "FeatureCollection", features });
      source("bus-route")?.setData(EMPTY);
      if (!bounds.isEmpty()) map.current.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 800 });
    },
    [mapReady],
  );

  useEffect(() => {
    if (view.kind !== "journeys") showJourney(null);
  }, [view.kind, showJourney]);

  // ── Layout ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-100">
      <style jsx global>{`
        @keyframes tp-pulse {
          0% { transform: scale(0.6); opacity: 0.5; }
          100% { transform: scale(2); opacity: 0; }
        }
        .maplibregl-popup-content { border-radius: 8px; padding: 10px 14px; font-size: 14px; line-height: 1.5; }
        .maplibregl-ctrl-top-right { top: 76px; }
        @media (min-width: 768px) { .maplibregl-ctrl-top-right { top: 0; } }
      `}</style>

      {/* MapLibre makes its container position: relative, so it gets its own wrapper; z-0 keeps
          the markers (z-index 1000 in globals.css) under the panels */}
      <div className="absolute inset-0 z-0">
        <div className="h-full w-full" ref={mapRef} />
      </div>

      {/* Title and account */}
      <div className="absolute top-3 left-3 right-3 md:right-auto md:w-[400px] z-20 flex items-center justify-between gap-3 bg-white/95 backdrop-blur rounded-xl px-4 py-2.5 shadow-lg">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900 truncate">Transportes Moçambique</h1>
          <p className="text-xs text-slate-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="font-semibold text-emerald-700">{buses.length} autocarros</span>
            <span>· tempo real</span>
          </p>
        </div>
        {signedIn ? (
          <UserAvatar />
        ) : (
          <button
            onClick={() => router.push("/auth")}
            className="shrink-0 px-4 py-2 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-slate-800"
          >
            Entrar
          </button>
        )}
      </div>

      {/* My location */}
      <button
        onClick={() => {
          if (me && map.current) map.current.flyTo({ center: [me[1], me[0]], zoom: 15 });
          else locate();
          setView({ kind: "nearby" });
          setExpanded(true);
        }}
        className={`absolute z-20 right-3 ${expanded ? "bottom-[calc(50vh+12px)]" : "bottom-[76px]"} md:bottom-8 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-slate-50`}
        aria-label="Mostrar a minha localização"
        title="A minha localização"
      >
        <svg className={`w-6 h-6 ${me ? "text-blue-600" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3.5" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M12 2v3m0 14v3M2 12h3m14 0h3" />
        </svg>
      </button>

      {/* Panel: bottom sheet on phones, side panel on larger screens */}
      <section
        className={`absolute z-30 bg-white shadow-2xl flex flex-col left-0 right-0 bottom-0 rounded-t-2xl md:rounded-2xl md:left-3 md:right-auto md:top-[84px] md:bottom-3 md:w-[400px] ${
          expanded ? "max-h-[50vh] md:max-h-none" : "max-h-[64px] md:max-h-none"
        }`}
        aria-label="Planear viagem"
      >
        <button
          className="md:hidden w-full pt-2 pb-1 flex justify-center"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Recolher painel" : "Abrir painel"}
        >
          <span className="w-10 h-1.5 rounded-full bg-slate-300" />
        </button>
        <div className="overflow-y-auto px-4 pb-4 md:pt-4 flex-1">
          {netError ? (
            <p className="text-sm text-red-700 py-4">Não foi possível carregar as paragens. Recarregue a página.</p>
          ) : view.kind === "nearby" ? (
            <NearbyView
              nearby={nearby}
              vias={vias}
              places={places}
              locState={locState}
              hasMe={Boolean(me)}
              meInArea={meInArea}
              loading={!stops.length}
              onStop={openStop}
              onRetry={locate}
              onDestination={(p) =>
                me && meInArea
                  ? planTo(p, { me }, "a sua localização")
                  : nearby[0] && planTo(p, { stopIds: [nearby[0].stop.id] }, nearby[0].stop.nome)
              }
            />
          ) : view.kind === "stop" ? (
            <StopView
              key={view.stopId}
              stop={stopById.get(view.stopId) ?? null}
              stopId={view.stopId}
              vias={vias}
              places={places}
              me={me}
              onBack={() => setView({ kind: "nearby" })}
              onDestination={(p) => planTo(p, { stopIds: [view.stopId] }, stopById.get(view.stopId)?.nome ?? "Paragem")}
            />
          ) : (
            <JourneysView key={`${JSON.stringify(view.from)}>${view.to.join(",")}`} view={view} onBack={() => setView(view.back)} onShow={showJourney} />
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Nearby stops ─────────────────────────────────────────────────────────────

function DestinationSearch({
  places,
  directRouteIdx,
  vias,
  onPick,
  autoFocus,
}: {
  places: Place<NetStop>[];
  directRouteIdx?: Set<number>;
  vias: NetVia[];
  onPick: (p: { ids: string[]; label: string }) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => (query.trim().length >= 2 ? searchPlaces(places, query, 12) : []), [places, query]);
  const routeName = (p: Place<NetStop>) => vias[p.stops[0]?.v[0]]?.nome;

  return (
    <div className="mb-3">
      <label className="relative block">
        <span className="sr-only">Para onde quer ir?</span>
        <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Para onde quer ir?"
          className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
      </label>
      {query.trim().length >= 2 && (
        <ul className="mt-2 divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {results.length === 0 && <li className="px-3 py-3 text-sm text-slate-600">Nenhuma paragem com esse nome.</li>}
          {results.map((p) => {
            const direct = directRouteIdx ? p.stops.some((s) => s.v.some((i) => directRouteIdx.has(i))) : undefined;
            const twins = results.filter((r) => r.nome === p.nome).length > 1;
            return (
              <li key={p.key}>
                <button
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-2"
                  onClick={() => onPick({ ids: p.stops.map((s) => s.id), label: p.nome })}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 truncate">{p.nome}</span>
                    {twins && <span className="block text-xs text-slate-500 truncate">{routeName(p)}</span>}
                  </span>
                  {direct !== undefined && (
                    <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${direct ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {direct ? "Directo" : "Com transbordo"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NearbyView({
  nearby,
  vias,
  places,
  locState,
  hasMe,
  meInArea,
  loading,
  onStop,
  onRetry,
  onDestination,
}: {
  nearby: { stop: NetStop; m: number }[];
  vias: NetVia[];
  places: Place<NetStop>[];
  locState: LocationState;
  hasMe: boolean;
  meInArea: boolean;
  loading: boolean;
  onStop: (id: string) => void;
  onRetry: () => void;
  onDestination: (p: { ids: string[]; label: string }) => void;
}) {
  const fromMe = hasMe && meInArea;
  return (
    <div>
      <DestinationSearch places={places} vias={vias} onPick={onDestination} />
      <h2 className="text-sm font-bold text-slate-900 mb-1">{fromMe ? "Paragens perto de si" : "Paragens nesta zona do mapa"}</h2>
      {!fromMe && (
        <p className="text-xs text-slate-600 mb-2">
          {locState === "asking" && "A procurar a sua localização…"}
          {locState === "denied" && "A localização está desativada. Ative-a no navegador para ver as paragens perto de si, ou toque numa paragem no mapa."}
          {locState === "unavailable" && (
            <>
              Não foi possível obter a sua localização.{" "}
              <button className="underline font-medium" onClick={onRetry}>
                Tentar de novo
              </button>
            </>
          )}
          {locState === "ok" && !meInArea && "Está fora da área servida. Mova o mapa ou toque numa paragem."}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-slate-600 py-3">A carregar paragens…</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {nearby.map(({ stop, m }) => (
            <li key={stop.id}>
              <button className="w-full text-left py-2.5 flex items-center gap-3 hover:bg-slate-50 rounded-lg px-1" onClick={() => onStop(stop.id)}>
                <span className="shrink-0 w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center" aria-hidden>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 truncate">{stop.nome}</span>
                  <span className="block text-xs text-slate-600 truncate">
                    {stop.v.length} {stop.v.length === 1 ? "rota" : "rotas"} · {vias[stop.v[0]]?.nome}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold text-slate-900">{formatDistance(m)}</span>
                  {fromMe && <span className="block text-xs text-slate-500">{walkMinutes(m)} min a pé</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── One stop: where its buses go ─────────────────────────────────────────────

function StopView({
  stop,
  stopId,
  vias,
  places,
  me,
  onBack,
  onDestination,
}: {
  stop: NetStop | null;
  stopId: string;
  vias: NetVia[];
  places: Place<NetStop>[];
  me: Point | null;
  onBack: () => void;
  onDestination: (p: { ids: string[]; label: string }) => void;
}) {
  const [data, setData] = useState<StopDestinations | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stops/${encodeURIComponent(stopId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [stopId]);

  const direct = useMemo(() => new Set(stop?.v ?? []), [stop]);
  const away = me && stop ? distanceMeters(me, stop.point) : null;

  return (
    <div>
      <button onClick={onBack} className="text-sm text-slate-600 hover:text-slate-900 mb-2 flex items-center gap-1">
        <span aria-hidden>←</span> Paragens perto
      </button>
      <h2 className="text-lg font-bold text-slate-900 leading-tight">{stop?.nome ?? data?.paragem.nome ?? "Paragem"}</h2>
      <p className="text-xs text-slate-600 mb-3">
        {stop ? `${stop.v.length} ${stop.v.length === 1 ? "rota" : "rotas"}` : ""}
        {away !== null && away < 50_000 ? ` · a ${formatDistance(away)} de si (${walkMinutes(away)} min a pé)` : ""}
      </p>

      <DestinationSearch places={places} vias={vias} directRouteIdx={direct} onPick={onDestination} />

      <h3 className="text-sm font-bold text-slate-900 mb-2">Para onde vão os autocarros daqui</h3>
      {error && <p className="text-sm text-red-700">Não foi possível ler os destinos desta paragem.</p>}
      {!data && !error && <p className="text-sm text-slate-600">A carregar…</p>}
      <div className="space-y-3">
        {data?.rotas.map((rota) => (
          <div key={rota.via.id} className="border border-slate-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: rota.via.cor }} aria-hidden />
              <span className="min-w-0 truncate">{rota.via.nome}</span>
            </p>
            {rota.sentidos.map((sentido) => {
              const key = `${rota.via.id}:${sentido.para}`;
              const all = distinctNames(sentido.paragens);
              const shown = open[key] ? all : all.slice(0, 4);
              return (
                <div key={key} className="mt-2">
                  <p className="text-xs text-slate-700">
                    <span className="font-semibold">Sentido {sentido.para}</span>
                    {sentido.proximo ? (
                      <span>
                        {" "}· próximo autocarro {formatEta(sentido.proximo.minutos).text}{" "}
                        <span className="text-slate-500">({sentido.proximo.matricula})</span>
                      </span>
                    ) : (
                      <span className="text-slate-500"> · sem autocarro</span>
                    )}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {shown.map((p) => (
                      <li key={p.id}>
                        <button
                          className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-800 hover:bg-slate-200"
                          onClick={() => onDestination({ ids: [p.id], label: p.nome })}
                        >
                          {p.nome}
                        </button>
                      </li>
                    ))}
                    {all.length > 4 && (
                      <li>
                        <button
                          className="text-xs px-2 py-1 rounded-full text-slate-700 underline"
                          onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                        >
                          {open[key] ? "Mostrar menos" : `Ver as ${all.length} paragens`}
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Journeys ─────────────────────────────────────────────────────────────────

function JourneysView({
  view,
  onBack,
  onShow,
}: {
  view: JourneysState;
  onBack: () => void;
  onShow: (j: Journey | null) => void;
}) {
  const [options, setOptions] = useState<Journey[] | null>(null);
  const [error, setError] = useState(false);
  const [chosen, setChosen] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ to: view.to.join(",") });
    if ("me" in view.from) {
      q.set("lat", String(view.from.me[0]));
      q.set("lng", String(view.from.me[1]));
    } else q.set("from", view.from.stopIds.join(","));
    fetch(`/api/journeys?${q}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((d) => {
        if (cancelled) return;
        setOptions(d.opcoes ?? []);
        setChosen(0);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
    // The view is replaced (new key) for every new search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onShow(options?.[chosen] ?? null);
  }, [options, chosen, onShow]);

  return (
    <div>
      <button onClick={onBack} className="text-sm text-slate-600 hover:text-slate-900 mb-2 flex items-center gap-1">
        <span aria-hidden>←</span> Voltar
      </button>
      <p className="text-xs text-slate-600">Partida: {view.fromLabel}</p>
      <h2 className="text-lg font-bold text-slate-900 leading-tight mb-3">Para {view.toLabel}</h2>

      {error && <p className="text-sm text-red-700">Não foi possível planear a viagem. Tente de novo.</p>}
      {!options && !error && <p className="text-sm text-slate-600">A procurar autocarros…</p>}
      {options?.length === 0 && (
        <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Não há ligação de autocarro entre estes dois locais. Experimente uma paragem próxima do destino.
        </p>
      )}

      <div className="space-y-3">
        {options?.map((j, i) => (
          <div key={i} className={`rounded-xl border ${i === chosen ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"}`}>
            <button className="w-full text-left p-3" onClick={() => setChosen(i)} aria-expanded={i === chosen}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-bold text-slate-900">Chega {at(j.chegada)}</span>
                <span className="text-sm font-semibold text-slate-900">{j.tarifa} MT</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {j.transbordos === 0 ? "Directo" : `${j.transbordos} ${j.transbordos === 1 ? "transbordo" : "transbordos"}`} · {duration(j.duracaoMin)}
                {j.metrosAPe > 0 ? ` · ${formatDistance(j.metrosAPe)} a pé` : ""}
              </p>
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {j.etapas.map((e, n) =>
                  e.tipo === "pe" ? (
                    <span key={n} className="text-xs text-slate-500" aria-label="a pé">🚶</span>
                  ) : (
                    <span
                      key={n}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full max-w-[150px] truncate"
                      style={{ background: e.via.cor || "#2563eb", color: textOn(e.via.cor || "#2563eb") }}
                    >
                      {e.via.nome}
                    </span>
                  ),
                )}
              </div>
            </button>
            {i === chosen && at(j.chegada).startsWith("amanhã") && !at(j.partida).startsWith("amanhã") && (
              <p className="mx-3 mb-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Parte da viagem só é possível amanhã: os autocarros circulam das 05:00 às 21:00.
              </p>
            )}
            {i === chosen && <Legs journey={j} />}
          </div>
        ))}
      </div>
      {options && options.length > 0 && (
        <p className="text-[11px] text-slate-500 mt-3">
          Horas estimadas pela posição dos autocarros (GPS quando disponível, senão o horário). Cada autocarro cobra o seu bilhete.
        </p>
      )}
    </div>
  );
}

function Legs({ journey }: { journey: Journey }) {
  const router = useRouter();
  return (
    <ol className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
      {journey.etapas.map((e, n) =>
        e.tipo === "pe" ? (
          <WalkStep key={n} leg={e} />
        ) : (
          <li key={n} className="flex gap-3">
            <span className="w-1.5 rounded-full shrink-0" style={{ background: e.via.cor || "#2563eb" }} aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-900">{e.via.nome}</p>
              <p className="text-xs text-slate-600">Sentido {e.sentido} · autocarro {e.transporte.matricula}</p>
              <p className="mt-1 text-slate-800">
                Apanhe em <Stop s={e.de} /> {at(e.embarque)}{" "}
                <span className="text-slate-500">
                  {n === firstBus(journey) ? (soon(e.embarque) ? `(${soon(e.embarque)})` : "") : `(espera ${duration(e.esperaMin)})`}
                </span>
              </p>
              <p className="text-slate-800">
                Saia em <Stop s={e.para} /> {at(e.chegada)}
              </p>
              <p className="text-xs text-slate-500">
                {e.paragens} {e.paragens === 1 ? "paragem" : "paragens"} · {duration(e.viagemMin)} · {formatDistance(e.metros)} · {e.tarifa} MT
              </p>
              <button
                className="mt-1.5 text-xs font-semibold text-slate-900 underline"
                onClick={() => router.push(`/track/${e.transporte.id}?paragem=${e.de.id}&destino=${e.para.id}`)}
              >
                Acompanhar este autocarro →
              </button>
            </div>
          </li>
        ),
      )}
    </ol>
  );
}

const firstBus = (j: Journey) => j.etapas.findIndex((e) => e.tipo === "autocarro");

function WalkStep({ leg }: { leg: WalkLeg }) {
  return (
    <li className="flex gap-3 text-sm text-slate-700">
      <span className="w-1.5 shrink-0 border-l-2 border-dashed border-slate-400 ml-0.5" aria-hidden />
      <p>
        🚶 Caminhe {formatDistance(leg.metros)} ({leg.minutos} min) até <Stop s={leg.para} />
      </p>
    </li>
  );
}

function Stop({ s }: { s: StopRef }) {
  return <strong className="font-semibold">{s.nome}</strong>;
}

