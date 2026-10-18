"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Destino, Journey, StopDestinations, StopRef, WalkLeg } from "@/lib/journeys";
import { formatEta } from "@/lib/eta";
import { distanceMeters, formatDistance, groupPlaces, searchPlaces, walkMinutes, type Place, type Point } from "@/lib/places";
import UserAvatar from "./UserAvatar";
import Plate from "./Plate";
import Sheet, { type SheetSnap } from "./Sheet";
import { useWalkPaths, type Walk } from "./walkPaths";
import {
  BUS_SVG,
  EMPTY,
  at,
  duration,
  glideMarker,
  mePin,
  paintFace,
  popupContent,
  soon,
  textOn,
  WALK_ATTRIBUTION,
} from "./mapKit";

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


const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

/**
 * The part of the map the panels cover. Set as the map's own padding (MapLibre also keeps the
 * padding of flyTo/easeTo, and fitBounds adds its own on top), so centring and fitting use the
 * visible part of the map.
 */
function mapPadding(sheetOpen: boolean) {
  return isDesktop()
    ? { top: 16, bottom: 0, left: 420, right: 0 }
    : { top: 80, bottom: sheetOpen ? Math.round(window.innerHeight * 0.5) : 64, left: 0, right: 0 };
}


const NO_WALKS: Walk[] = [];

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
  // Route lines of the buses tapped so far ([lng, lat] pairs), fetched on the first tap
  const busRoutes = useRef(new Map<string, [number, number][]>());
  const lastTappedBus = useRef<string | null>(null);
  const meMarker = useRef<maplibregl.Marker | null>(null);
  const meFace = useRef<HTMLElement | null>(null);
  const centredOnMe = useRef(false);
  const selectStop = useRef<(id: string) => void>(() => {});

  const [vias, setVias] = useState<NetVia[]>([]);
  const [stops, setStops] = useState<NetStop[]>([]);
  // Stops no route with a vehicle passes: shown on the map, not offered as a start or destination
  const [idleStops, setIdleStops] = useState<NetStop[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [netError, setNetError] = useState(false);
  const [me, setMe] = useState<Point | null>(null);
  const [locState, setLocState] = useState<LocationState>("asking");
  const [mapCentre, setMapCentre] = useState<Point>(MAPUTO);
  const [view, setView] = useState<View>({ kind: "nearby" });
  // A: where the journey starts when it is not the passenger's position (a place they picked)
  const [start, setStart] = useState<(PlacePick & { point: Point }) | null>(null);
  // Every destination from the start, with the stop where the first bus is taken (B)
  const [destinos, setDestinos] = useState<{ key: string; list: Destino[] | null }>({ key: "", list: null });
  const [snap, setSnap] = useState<SheetSnap>("half");
  const expanded = snap !== "peek";
  // Shows the panel when something is picked, without lowering it from the whole screen
  const raise = useCallback(() => setSnap((s) => (s === "peek" ? "half" : s)), []);
  const [shownWalks, setShownWalks] = useState<Walk[]>([]);
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

  const stopById = useMemo(() => new Map([...stops, ...idleStops].map((s) => [s.id, s])), [stops, idleStops]);
  const places = useMemo(() => groupPlaces(stops), [stops]);

  // ── Data ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/stops")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { vias: NetVia[]; paragens: Omit<NetStop, "point">[]; semAutocarro?: Omit<NetStop, "point" | "v">[] }) => {
        setVias(data.vias);
        setStops(data.paragens.map((s) => ({ ...s, point: [s.lat, s.lng] as Point })));
        setIdleStops((data.semAutocarro ?? []).map((s) => ({ ...s, v: [], point: [s.lat, s.lng] as Point })));
      })
      .catch(() => setNetError(true));
    fetch("/api/buses?fields=map")
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

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocState("unavailable");
      return;
    }
    if (locState !== "ok") setLocState("asking");
    watchPosition();
  }, [locState, watchPosition]);

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
      attributionControl: { compact: true, customAttribution: WALK_ATTRIBUTION },
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

      for (const id of ["bus-route", "journey", "journey-walk", "idle-stops", "stops", "nearby", "selected"]) m.addSource(id, { type: "geojson", data: EMPTY });
      m.addLayer({ id: "bus-route", type: "line", source: "bus-route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ef4444", "line-width": 4, "line-opacity": 0.8 } });
      m.addLayer({
        id: "journey-walk",
        type: "line",
        source: "journey-walk",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#334155", "line-width": 4, "line-dasharray": [0.6, 1.6] },
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
      // Every stop at every zoom: white where buses pass, grey where none does
      m.addLayer({
        id: "idle-dot",
        type: "circle",
        source: "idle-stops",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2, 13, 3.5, 16, 6],
          "circle-color": "#cbd5e1",
          "circle-stroke-color": "#64748b",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 13, 1.5],
        },
      });
      m.addLayer({
        id: "stops-dot",
        type: "circle",
        source: "stops",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 13, 4, 16, 7],
          "circle-color": "#ffffff",
          "circle-stroke-color": "#334155",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 13, 2],
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

      for (const layer of ["idle-dot", "stops-dot", "nearby-dot"]) {
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

  // Every stop, as small dots
  useEffect(() => {
    if (!mapReady) return;
    const points = (list: NetStop[]): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: list.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] }, properties: { id: s.id } })),
    });
    source("stops")?.setData(points(stops));
    source("idle-stops")?.setData(points(idleStops));
  }, [mapReady, stops, idleStops]);

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
          { text: "Acompanhar →", href: `/viagem?b=${bus.id}` },
        ]),
      );
      el.addEventListener("click", async () => {
        const show = (coords: [number, number][]) =>
          source("bus-route")?.setData(
            coords.length > 1 ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } : EMPTY,
          );
        lastTappedBus.current = bus.id;
        const known = busRoutes.current.get(bus.id);
        if (known) return show(known);
        show([]);
        try {
          const data = await fetch(`/api/bus/${bus.id}`).then((res) => (res.ok ? res.json() : null));
          const coords: [number, number][] = data?.routeCoords ?? [];
          busRoutes.current.set(bus.id, coords);
          // Another bus may have been tapped while this one loaded
          if (lastTappedBus.current === bus.id) show(coords);
        } catch {
          // No line this time; the next tap asks again
        }
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
      const { el, face } = mePin();
      meFace.current = face;
      paintFace(face);
      meMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([me[1], me[0]])
        .setPopup(new maplibregl.Popup({ offset: 44 }).setDOMContent(popupContent([{ text: "Está aqui", bold: true }])))
        .addTo(map.current);
    } else {
      meMarker.current.setLngLat([me[1], me[0]]);
    }
    if (!centredOnMe.current && meInArea) {
      centredOnMe.current = true;
      map.current.flyTo({ center: [me[1], me[0]], zoom: 15, duration: 1200 });
    }
  }, [mapReady, me, meInArea]);

  // Initials in the pin follow sign-in and sign-out
  useEffect(() => {
    if (meFace.current) paintFace(meFace.current);
  }, [signedIn]);

  // Stops near the passenger (or near the centre of the map when the position is unknown)
  const anchor: Point = start ? start.point : me && meInArea ? me : mapCentre;
  const fromMe = !start && Boolean(me && meInArea);

  // Destinations from the start: the picked place, or the passenger's position (asked again
  // when they have moved about 100 m)
  const destinosKey = start ? `from=${start.ids.join(",")}` : fromMe && me ? `lat=${me[0].toFixed(3)}&lng=${me[1].toFixed(3)}` : "";
  useEffect(() => {
    if (!destinosKey) return;
    let cancelled = false;
    fetch(`/api/destinos?${destinosKey}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((d) => !cancelled && setDestinos({ key: destinosKey, list: d.destinos }))
      .catch(() => !cancelled && setDestinos({ key: destinosKey, list: [] }));
    return () => {
      cancelled = true;
    };
  }, [destinosKey]);

  const pickStart = useCallback(
    (p: PlacePick | "me") => {
      setView({ kind: "nearby" });
      raise();
      if (p === "me") {
        setStart(null);
        if (me && map.current) map.current.flyTo({ center: [me[1], me[0]], zoom: 15 });
        else locate();
        return;
      }
      const first = stopById.get(p.ids[0]);
      if (!first) return;
      setStart({ ...p, point: first.point });
      map.current?.flyTo({ center: [first.lng, first.lat], zoom: 15 });
    },
    [me, stopById, locate, raise],
  );
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
      raise();
      const s = stopById.get(id);
      if (s && map.current) map.current.easeTo({ center: [s.lng, s.lat], zoom: Math.max(map.current.getZoom(), 15) });
    },
    [stopById, raise],
  );
  // The map's click handlers are attached once, when it loads; they call the latest openStop
  useEffect(() => {
    selectStop.current = openStop;
  }, [openStop]);

  const selectedStopId = view.kind === "stop" ? view.stopId : view.kind === "nearby" && start ? start.ids[0] : null;
  useEffect(() => {
    if (!mapReady) return;
    const s = selectedStopId ? stopById.get(selectedStopId) : null;
    source("selected")?.setData(
      s ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [s.lng, s.lat] } } : EMPTY,
    );
  }, [mapReady, selectedStopId, stopById]);

  const planTo = (place: { ids: string[]; label: string }, from: JourneysState["from"], fromLabel: string) => {
    setView({ kind: "journeys", from, fromLabel, to: place.ids, toLabel: place.label, back: view });
    setShownWalks([]);
    raise();
  };

  // No journey on the map: all the buses again
  const hideJourney = useCallback(() => {
    if (!mapReady) return;
    for (const marker of busMarkers.current.values()) marker.getElement().style.display = "";
    source("journey")?.setData(EMPTY);
  }, [mapReady]);

  const showJourney = useCallback(
    (journey: Journey | null) => {
      if (!mapReady || !map.current) return;
      if (!journey) return hideJourney();
      // While a journey is shown, only its buses stay on the map
      const used = new Set(journey.etapas.flatMap((e) => (e.tipo === "autocarro" ? [e.transporte.id] : [])));
      for (const [id, marker] of busMarkers.current) marker.getElement().style.display = used.has(id) ? "" : "none";
      const features: GeoJSON.Feature[] = [];
      const walks: Walk[] = [];
      const bounds = new maplibregl.LngLatBounds();
      for (const leg of journey.etapas) {
        if (leg.tipo === "pe") {
          walks.push({ from: [leg.de.lat, leg.de.lng], to: [leg.para.lat, leg.para.lng] });
          bounds.extend([leg.de.lng, leg.de.lat]).extend([leg.para.lng, leg.para.lat]);
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
      setShownWalks(walks);
      source("bus-route")?.setData(EMPTY);
      if (!bounds.isEmpty()) map.current.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 800 });
    },
    [mapReady, hideJourney],
  );

  useEffect(() => {
    if (view.kind !== "journeys") hideJourney();
  }, [view.kind, hideJourney]);

  // The walks of the journey shown, along the streets once their paths arrive
  const walkLines = useWalkPaths(view.kind === "journeys" ? shownWalks : NO_WALKS);
  useEffect(() => {
    if (!mapReady) return;
    source("journey-walk")?.setData({
      type: "FeatureCollection",
      features: walkLines.map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } })),
    });
  }, [mapReady, walkLines]);

  const titleBar = (
    <>
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
    </>
  );

  // ── Layout ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-100">
      <style jsx global>{`
        @keyframes tp-pulse {
          0% { transform: scale(0.6); opacity: 0.5; }
          100% { transform: scale(2); opacity: 0; }
        }
        .maplibregl-popup-content { border-radius: 14px; padding: 10px 14px; font-size: 14px; line-height: 1.5; }
        .maplibregl-ctrl-top-right { top: 76px; }
        @media (min-width: 768px) { .maplibregl-ctrl-top-right { top: 0; } }
      `}</style>

      {/* MapLibre makes its container position: relative, so it gets its own wrapper; z-0 keeps
          the markers (z-index 1000 in globals.css) under the panels */}
      <div className="absolute inset-0 z-0">
        <div className="h-full w-full" ref={mapRef} />
      </div>

      {/* Title and account: a bar at the top on phones, the top of the panel on larger screens */}
      <div className="md:hidden absolute top-3 left-3 right-3 z-40 flex items-center justify-between gap-3 bg-white/95 backdrop-blur rounded-2xl px-4 py-2.5 shadow-lg">
        {titleBar}
      </div>

      {/* My location */}
      <button
        onClick={() => {
          if (me && map.current) map.current.flyTo({ center: [me[1], me[0]], zoom: 15 });
          else locate();
          setView({ kind: "nearby" });
          raise();
        }}
        className={`absolute z-20 right-3 ${expanded ? "bottom-[calc(50dvh+12px)]" : "bottom-[76px]"} md:bottom-8 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-slate-50`}
        aria-label="Mostrar a minha localização"
        title="A minha localização"
      >
        <svg className={`w-6 h-6 ${me ? "text-blue-600" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3.5" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M12 2v3m0 14v3M2 12h3m14 0h3" />
        </svg>
      </button>

      {/* Panel: bottom sheet on phones (dragged up to the whole screen), side panel on larger screens */}
      <Sheet snap={snap} onSnap={setSnap} peek={64} header={titleBar} label="Planear viagem">
        {netError ? (
          <p className="text-sm text-red-700 py-4">Não foi possível carregar as paragens. Recarregue a página.</p>
        ) : view.kind === "nearby" ? (
          <NearbyView
            nearby={nearby}
            vias={vias}
            places={places}
            locState={locState}
            meInArea={meInArea}
            loading={!stops.length}
            onStop={openStop}
            onRetry={locate}
            origin={start ? start.label : fromMe ? "A sua localização" : "Escolha o ponto de partida"}
            originIsMe={fromMe}
            hasStart={Boolean(start) || fromMe}
            anchor={anchor}
            destinos={destinos.key === destinosKey ? destinos.list : null}
            onOrigin={pickStart}
            onDestination={(p) =>
              start
                ? planTo(p, { stopIds: start.ids }, start.label)
                : me && meInArea
                  ? planTo(p, { me }, "A sua localização")
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
            onOrigin={pickStart}
            onDestination={(p) => planTo(p, { stopIds: [view.stopId] }, stopById.get(view.stopId)?.nome ?? "Paragem")}
          />
        ) : (
          <JourneysView key={`${JSON.stringify(view.from)}>${view.to.join(",")}`} view={view} onBack={() => setView(view.back)} onShow={showJourney} />
        )}
      </Sheet>
    </div>
  );
}

// ─── Nearby stops ─────────────────────────────────────────────────────────────

type PlacePick = { ids: string[]; label: string };

/** The start and end dots joined by a line, as in ride-hailing apps. */
function RouteDots() {
  return (
    <div className="flex flex-col items-center py-5 pl-1" aria-hidden>
      <span className="w-3 h-3 rounded-full bg-blue-600 ring-4 ring-blue-100" />
      <span className="w-0.5 flex-1 bg-slate-300 my-1.5" />
      <span className="w-3 h-3 rounded-full bg-slate-900 ring-4 ring-slate-200" />
    </div>
  );
}

/**
 * Where the journey starts ("Partida": the passenger's position, or a stop or place they pick)
 * and where it goes ("Para onde quer ir?"), with the search results of the field being typed in.
 */
function RouteFields({
  places,
  vias,
  origin,
  originIsMe,
  canUseMe,
  directRouteIdx,
  near,
  onOrigin,
  onPick,
}: {
  places: Place<NetStop>[];
  vias: NetVia[];
  origin: string;
  originIsMe: boolean;
  canUseMe: boolean;
  directRouteIdx?: Set<number>;
  /** Where distances in the results are measured from (the passenger, or the stop shown) */
  near: Point | null;
  onOrigin: (p: PlacePick | "me") => void;
  onPick: (p: PlacePick) => void;
}) {
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [originQuery, setOriginQuery] = useState("");
  const [query, setQuery] = useState("");
  const active = editingOrigin ? originQuery : query;
  const results = useMemo(() => (active.trim().length >= 2 ? searchPlaces(places, active, 12) : []), [places, active]);
  const routeName = (p: Place<NetStop>) => vias[p.stops[0]?.v[0]]?.nome;
  const field =
    "w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500";

  return (
    <div className="mb-4">
      <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2">
        <RouteDots />
        <div className="flex-1 min-w-0 space-y-2">
          {editingOrigin ? (
            <input
              autoFocus
              value={originQuery}
              onChange={(e) => setOriginQuery(e.target.value)}
              placeholder="De onde parte? Paragem ou local"
              aria-label="Partida"
              className={field}
            />
          ) : (
            <button
              onClick={() => setEditingOrigin(true)}
              className="w-full text-left rounded-xl bg-white border border-slate-200 px-3 py-1.5 hover:border-slate-400"
              aria-label={`Partida: ${origin}. Mudar`}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Partida</span>
              <span className={`block truncate text-sm font-semibold ${originIsMe ? "text-blue-700" : "text-slate-900"}`}>{origin}</span>
            </button>
          )}
          <label className="block">
            <span className="sr-only">Para onde quer ir?</span>
            <input
              value={query}
              onFocus={() => setEditingOrigin(false)}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Para onde quer ir?"
              className={`${field} py-3`}
            />
          </label>
        </div>
      </div>

      {editingOrigin && (
        <div className="mt-2 flex flex-wrap gap-2">
          {canUseMe && (
            <button
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-100"
              onClick={() => {
                setEditingOrigin(false);
                onOrigin("me");
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="3.5" strokeWidth={2} />
                <path strokeLinecap="round" strokeWidth={2} d="M12 2v3m0 14v3M2 12h3m14 0h3" />
              </svg>
              A sua localização
            </button>
          )}
          <button
            className="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-200"
            onClick={() => {
              setEditingOrigin(false);
              setOriginQuery("");
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {active.trim().length >= 2 && (
        <ul className="mt-2 divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {results.length === 0 && <li className="px-3 py-3 text-sm text-slate-600">Nenhuma paragem com esse nome.</li>}
          {results.map((p) => {
            const direct = !editingOrigin && directRouteIdx ? p.stops.some((s) => s.v.some((i) => directRouteIdx.has(i))) : undefined;
            const twins = results.filter((r) => r.nome === p.nome).length > 1;
            const away = near ? formatDistance(distanceMeters(near, p.point)) : null;
            return (
              <li key={p.key}>
                <button
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-2"
                  onClick={() => {
                    const pick = { ids: p.stops.map((s) => s.id), label: p.nome };
                    if (editingOrigin) {
                      setEditingOrigin(false);
                      setOriginQuery("");
                      onOrigin(pick);
                    } else onPick(pick);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 truncate">{p.nome}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      {[away && `a ${away}`, twins && routeName(p)].filter(Boolean).join(" · ")}
                    </span>
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

/** The chosen start and destination, shown above the journeys. */
function RouteSummary({ from, to }: { from: string; to: string }) {
  return (
    <div className="mb-3 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2">
      <RouteDots />
      <div className="flex-1 min-w-0 space-y-2 py-1">
        <p className="px-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Partida</span>
          <span className="block truncate text-sm font-semibold text-slate-900">{from}</span>
        </p>
        <p className="px-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Destino</span>
          <span className="block truncate text-base font-bold text-slate-900">{to}</span>
        </p>
      </div>
    </div>
  );
}

function NearbyView({
  nearby,
  vias,
  places,
  locState,
  meInArea,
  loading,
  onStop,
  onRetry,
  origin,
  originIsMe,
  hasStart,
  anchor,
  destinos,
  onOrigin,
  onDestination,
}: {
  nearby: { stop: NetStop; m: number }[];
  vias: NetVia[];
  places: Place<NetStop>[];
  locState: LocationState;
  meInArea: boolean;
  loading: boolean;
  onStop: (id: string) => void;
  onRetry: () => void;
  origin: string;
  originIsMe: boolean;
  /** A start is known (the passenger's position or a picked place), so destinations can be listed */
  hasStart: boolean;
  anchor: Point;
  destinos: Destino[] | null;
  onOrigin: (p: PlacePick | "me") => void;
  onDestination: (p: PlacePick) => void;
}) {
  const fromMe = originIsMe;
  const fromPlace = hasStart && !originIsMe;
  const [tab, setTab] = useState<"destinos" | "paragens">("destinos");
  const showing = hasStart ? tab : "paragens";
  // Nothing within NEAR_RADIUS_M: the list holds the nearest stops, however far
  const far = !loading && nearby.length > 0 && nearby[0].m > NEAR_RADIUS_M;
  return (
    <div>
      <RouteFields
        places={places}
        vias={vias}
        origin={origin}
        originIsMe={originIsMe}
        canUseMe={!originIsMe}
        near={anchor}
        onOrigin={onOrigin}
        onPick={onDestination}
      />
      {hasStart && (
        <Tabs
          value={showing}
          options={[
            ["destinos", "Para onde ir"],
            ["paragens", "Paragens perto"],
          ]}
          onChange={setTab}
        />
      )}
      {showing === "destinos" ? (
        destinos ? (
          <AllDestinations destinos={destinos} showBoarding onDestination={onDestination} />
        ) : (
          <p className="text-sm text-slate-600 py-3">A calcular para onde pode ir…</p>
        )
      ) : (
        <>
          <h2 className="text-sm font-bold text-slate-900 mb-1">
            {far ? "Paragens mais próximas" : fromMe ? "Onde vai apanhar o autocarro?" : fromPlace ? "Paragens perto da partida" : "Paragens nesta zona do mapa"}
          </h2>
          {fromMe && !far && (
            <p className="text-xs text-slate-600 mb-2">Escolha a paragem perto de si onde quer apanhar o autocarro.</p>
          )}
          {far && (
            <p className="text-xs text-slate-600 mb-2">
              Não há paragens a menos de {formatDistance(NEAR_RADIUS_M)} {fromMe ? "de si" : fromPlace ? "da partida" : "do centro do mapa"}.
            </p>
          )}
          {!fromMe && !fromPlace && (
            <p className="text-xs text-slate-600 mb-2">
              {locState === "asking" && "A procurar a sua localização…"}
              {locState === "denied" && "A localização está desativada. Ative-a no navegador para ver as paragens perto de si, ou toque numa paragem no mapa."}
              {locState === "unavailable" && (
                <>
                  Não foi possível obter a sua localização.{" "}
                  <button
                    className="ml-1 inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    onClick={onRetry}
                  >
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
                  <button className="w-full text-left py-2.5 flex items-center gap-3 hover:bg-slate-50 rounded-xl px-1" onClick={() => onStop(stop.id)}>
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
                      {fromMe && m <= NEAR_RADIUS_M && <span className="block text-xs text-slate-500">{walkMinutes(m)} min a pé</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** Two or three choices as a segmented control. */
function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="mb-3 inline-flex rounded-full bg-slate-100 p-1" role="tablist">
      {options.map(([key, label]) => (
        <button
          key={key}
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${value === key ? "bg-white text-slate-900 shadow" : "text-slate-600 hover:text-slate-900"}`}
        >
          {label}
        </button>
      ))}
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
  onOrigin,
  onDestination,
}: {
  stop: NetStop | null;
  stopId: string;
  vias: NetVia[];
  places: Place<NetStop>[];
  me: Point | null;
  onBack: () => void;
  onOrigin: (p: PlacePick | "me") => void;
  onDestination: (p: PlacePick) => void;
}) {
  const [data, setData] = useState<(StopDestinations & { destinos: Destino[] }) | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"todos" | "rotas">("todos");

  // No route with a vehicle passes this stop: nothing to ask the server
  const idle = stop !== null && stop.v.length === 0;

  useEffect(() => {
    if (idle) return;
    let cancelled = false;
    fetch(`/api/stops/${encodeURIComponent(stopId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [stopId, idle]);

  const direct = useMemo(() => new Set(stop?.v ?? []), [stop]);
  const away = me && stop ? distanceMeters(me, stop.point) : null;

  return (
    <div>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-200 active:bg-slate-300">
        <span aria-hidden>←</span> Paragens perto
      </button>
      <h2 className="text-lg font-bold text-slate-900 leading-tight">{stop?.nome ?? data?.paragem.nome ?? "Paragem"}</h2>
      <p className="text-xs text-slate-600 mb-3">
        {stop ? (idle ? "sem autocarros" : `${stop.v.length} ${stop.v.length === 1 ? "rota" : "rotas"}`) : ""}
        {away !== null && away < 50_000 ? ` · a ${formatDistance(away)} de si (${walkMinutes(away)} min a pé)` : ""}
      </p>

      {idle ? (
        <p className="text-sm text-slate-700 bg-slate-100 rounded-xl p-3">
          Nenhum autocarro passa nesta paragem: as rotas que a servem não têm veículos. Escolha uma paragem branca no mapa.
        </p>
      ) : (
        <>
          <RouteFields
            places={places}
            vias={vias}
            origin={stop?.nome ?? data?.paragem.nome ?? "Paragem"}
            originIsMe={false}
            canUseMe
            directRouteIdx={direct}
            near={stop?.point ?? null}
            onOrigin={onOrigin}
            onPick={onDestination}
          />

          <h3 className="text-sm font-bold text-slate-900 mb-2">Para onde pode ir daqui</h3>
          <Tabs
            value={tab}
            options={[
              ["todos", "Todos os destinos"],
              ["rotas", "Por rota"],
            ]}
            onChange={setTab}
          />
          {error && <p className="text-sm text-red-700">Não foi possível ler os destinos desta paragem.</p>}
          {!data && !error && <p className="text-sm text-slate-600">A carregar…</p>}
          {tab === "todos" && data && <AllDestinations key={stopId} destinos={data.destinos} onDestination={onDestination} />}
          {tab === "rotas" && (
            <div className="space-y-3">
              {data?.rotas.map((rota) => (
                <div key={rota.via.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <p
                    className="px-3 py-2 text-sm font-semibold flex items-center gap-2"
                    style={{ background: rota.via.cor, color: textOn(rota.via.cor) }}
                  >
                    <span className="text-xs font-bold opacity-80 shrink-0">{rota.via.codigo}</span>
                    <span className="min-w-0 truncate">{rota.via.nome}</span>
                  </p>
                  {rota.sentidos.map((sentido) => {
                    const key = `${rota.via.id}:${sentido.para}`;
                    const all = distinctNames(sentido.paragens);
                    const shown = open[key] ? all : all.slice(0, 4);
                    return (
                      <div key={key} className="px-3 py-2.5 border-t border-slate-100 first-of-type:border-t-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">Sentido {sentido.para}</p>
                            <p className="text-xs text-slate-600">
                              {sentido.proximo
                                ? `Próximo autocarro ${formatEta(sentido.proximo.minutos).text}`
                                : "Sem autocarro neste sentido"}
                            </p>
                          </div>
                          {sentido.proximo && <Plate matricula={sentido.proximo.matricula} />}
                        </div>
                        {/* The stops ahead, as a line in the route's colour: tap one to go there */}
                        <ol className="mt-2 ml-2 border-l-2" style={{ borderColor: rota.via.cor }}>
                          {shown.map((p) => (
                            <li key={p.id} className="relative">
                              <span
                                className="absolute -left-[7px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2"
                                style={{ borderColor: rota.via.cor }}
                                aria-hidden
                              />
                              <button
                                className="w-full ml-2 flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-slate-100"
                                onClick={() => onDestination({ ids: [p.id], label: p.nome })}
                              >
                                <span className="min-w-0 truncate text-sm text-slate-800">{p.nome}</span>
                                <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">Ir</span>
                              </button>
                            </li>
                          ))}
                        </ol>
                        {all.length > 4 && (
                          <button
                            className="mt-2 text-xs px-3 py-1 rounded-full border border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-50"
                            onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                          >
                            {open[key] ? "Mostrar menos" : `Ver as ${all.length} paragens`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Every place reachable from the start, earliest arrival first, including those that take more
 * than one bus. With `showBoarding`, each says where the first bus is taken (B in A → B → C).
 */
function AllDestinations({
  destinos,
  showBoarding,
  onDestination,
}: {
  destinos: Destino[];
  showBoarding?: boolean;
  onDestination: (p: { ids: string[]; label: string }) => void;
}) {
  const [count, setCount] = useState(25);
  if (!destinos.length) return <p className="text-sm text-slate-600">Nenhum destino com os autocarros de agora.</p>;
  return (
    <div>
      <p className="text-xs text-slate-600 mb-2">
        {destinos.length} destinos, pela hora de chegada.
        {showBoarding ? " Cada um diz onde apanhar o primeiro autocarro." : ""} Toque num para ver a viagem, mesmo os que precisam de mais de um autocarro.
      </p>
      <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
        {destinos.slice(0, count).map((d) => (
          <li key={d.ids[0]}>
            <button
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-3"
              onClick={() => onDestination({ ids: d.ids, label: d.nome })}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900 truncate">{d.nome}</span>
                {showBoarding && (
                  <span className="block text-xs text-slate-600 truncate">
                    Apanhe em <strong className="font-semibold text-slate-800">{d.embarque.nome}</strong>
                    {d.metrosAtePrimeira > 0 ? ` · ${formatDistance(d.metrosAtePrimeira)} a pé` : ""}
                  </span>
                )}
                <span className="mt-1 flex items-center gap-1 flex-wrap">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      d.transbordos === 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {d.transbordos === 0 ? "Directo" : `${d.transbordos + 1} autocarros`}
                  </span>
                  {d.vias.map((v, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: v.cor, color: textOn(v.cor) }}
                      title={v.nome}
                    >
                      {v.codigo}
                    </span>
                  ))}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-slate-900">Chega {at(d.chegada).replace("às ", "")}</span>
                <span className="block text-xs text-slate-500">{duration(d.minutos)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {destinos.length > count && (
        <button
          className="mt-2 text-sm px-3.5 py-1.5 rounded-full border border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-50"
          onClick={() => setCount((c) => c + 50)}
        >
          Ver mais destinos ({destinos.length - count})
        </button>
      )}
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
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-200 active:bg-slate-300">
        <span aria-hidden>←</span> Voltar
      </button>
      <RouteSummary from={view.fromLabel} to={view.toLabel} />

      {error && <p className="text-sm text-red-700">Não foi possível planear a viagem. Tente de novo.</p>}
      {!options && !error && <p className="text-sm text-slate-600">A procurar autocarros…</p>}
      {options?.length === 0 && (
        <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Não há ligação de autocarro entre estes dois locais. Experimente uma paragem próxima do destino.
        </p>
      )}
      {/* From a stop the first bus is taken there; a walk first only when no bus from it gets there */}
      {options?.length && !("me" in view.from) && options[0].etapas[0].tipo === "pe" ? (
        <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
          Nenhum autocarro de {view.fromLabel} chega lá. A viagem começa a pé, até uma paragem perto.
        </p>
      ) : null}

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
                    <span key={n} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      a pé
                    </span>
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
              <p className="mx-3 mb-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-2">
                Parte da viagem só é possível amanhã: os autocarros circulam das 05:00 às 21:00.
              </p>
            )}
            {i === chosen && <Legs journey={j} fromLabel={view.fromLabel} toLabel={view.toLabel} />}
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

/** The page that follows a journey: every bus, the walks and the passenger on one map. */
function followUrl(journey: Journey, fromLabel: string, toLabel: string) {
  const buses = journey.etapas.filter((e) => e.tipo === "autocarro");
  const last = journey.etapas[journey.etapas.length - 1];
  const q = new URLSearchParams({
    b: buses.map((e) => `${e.transporte.id}~${e.de.id}~${e.para.id}`).join(","),
    para: last.para.id,
    o: fromLabel,
    n: toLabel,
  });
  if (journey.etapas[0].de.id) q.set("de", journey.etapas[0].de.id);
  return `/viagem?${q}`;
}

function Legs({ journey, fromLabel, toLabel }: { journey: Journey; fromLabel: string; toLabel: string }) {
  const router = useRouter();
  return (
    <>
    <ol className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
      {journey.etapas.map((e, n) =>
        e.tipo === "pe" ? (
          <WalkStep key={n} leg={e} />
        ) : (
          <li key={n} className="flex gap-3">
            <span className="w-1.5 rounded-full shrink-0" style={{ background: e.via.cor || "#2563eb" }} aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{e.via.nome}</p>
                  <p className="text-xs text-slate-600">Sentido {e.sentido}</p>
                </div>
                <Plate matricula={e.transporte.matricula} />
              </div>
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
            </div>
          </li>
        ),
      )}
    </ol>
    <div className="px-3 pb-3">
      <button
        className="w-full inline-flex items-center justify-center gap-1 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        onClick={() => router.push(followUrl(journey, fromLabel, toLabel))}
      >
        Acompanhar viagem →
      </button>
    </div>
    </>
  );
}

const firstBus = (j: Journey) => j.etapas.findIndex((e) => e.tipo === "autocarro");

function WalkStep({ leg }: { leg: WalkLeg }) {
  return (
    <li className="flex gap-3 text-sm text-slate-700">
      <span className="w-1.5 shrink-0 border-l-2 border-dashed border-slate-400 ml-0.5" aria-hidden />
      <p>
        <span className="mr-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">A pé</span>
        Caminhe {formatDistance(leg.metros)} ({leg.minutos} min) até <Stop s={leg.para} />
      </p>
    </li>
  );
}

/** A bus's plate, drawn like a number plate so it is easy to match with the bus in the street. */

function Stop({ s }: { s: StopRef }) {
  return <strong className="font-semibold">{s.nome}</strong>;
}

