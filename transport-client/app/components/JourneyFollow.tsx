"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FollowBus, FollowedBus, FollowedJourney, FollowWalk } from "@/lib/follow";
import type { StopRef } from "@/lib/journeys";
import { maputoClock } from "@/lib/eta";
import { distanceMeters, formatDistance, type Point } from "@/lib/places";
import Plate from "./Plate";
import UserAvatar from "./UserAvatar";
import Sheet, { type SheetSnap } from "./Sheet";
import { useWalkPaths, type Walk } from "./walkPaths";
import { BUS_SVG, EMPTY, at, duration, glideMarker, mePin, paintFace, soon, textOn, WALK_ATTRIBUTION } from "./mapKit";

/**
 * Acompanhar uma viagem (/viagem): todos os seus autocarros, as caminhadas e o passageiro num só
 * mapa, com o passo em que ele está agora. A página deduz o passo da posição do passageiro e das
 * dos autocarros (a bordo quando está junto do autocarro depois da paragem de embarque, fora quando
 * o autocarro passou a sua paragem), e o passageiro pode corrigi-lo ("Já entrei", "Já saí").
 * Porquê deduzir: quem vai num autocarro cheio não tem mãos para carregar em botões a cada passo.
 */

const REFRESH_MS = 10_000;
/** A menos disto do autocarro, depois da paragem de embarque: o passageiro vai nele */
const ON_BUS_M = 120;
/** A menos disto de uma paragem: o passageiro está lá */
const AT_STOP_M = 50;

type Phase = { a: number; bordo: boolean };
type Leg = [busId: string, from: string, to: string];

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
const padding = () => (isDesktop() ? { top: 60, bottom: 60, left: 460, right: 60 } : { top: 90, bottom: Math.round(window.innerHeight * 0.5), left: 30, right: 30 });

function readPhase(key: string): Phase {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (saved && typeof saved.a === "number") return { a: saved.a, bordo: Boolean(saved.bordo) };
  } catch {
    // sem armazenamento (janela privada): começa na primeira etapa
  }
  return { a: 0, bordo: false };
}

function busMarker(matricula: string, cor: string) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:default";
  const icon = document.createElement("div");
  icon.innerHTML = BUS_SVG;
  const tag = document.createElement("div");
  tag.textContent = matricula;
  tag.style.cssText = `margin-top:-2px;padding:1px 6px;border-radius:999px;background:${cor};color:${textOn(cor)};font:700 11px ui-monospace,monospace;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)`;
  el.append(icon, tag);
  return el;
}

export default function JourneyFollow() {
  const router = useRouter();
  const params = useSearchParams();
  const b = params.get("b") ?? "";
  const legs = useMemo(
    () => b.split(",").filter(Boolean).map((x) => x.split("~") as Leg),
    [b],
  );
  const busOnly = legs.length === 1 && !legs[0][2];
  const startId = params.get("de");
  const endId = params.get("para");
  const toLabel = params.get("n") ?? "";
  const fromLabel = params.get("o") ?? "";
  const phaseKey = `viagem:${b}`;

  const [phase, setPhaseState] = useState<Phase>(() => (typeof window === "undefined" ? { a: 0, bordo: false } : readPhase(phaseKey)));
  const setPhase = useCallback(
    (p: Phase) => {
      setPhaseState(p);
      try {
        sessionStorage.setItem(phaseKey, JSON.stringify(p));
      } catch {
        // não fica guardado entre recarregamentos
      }
    },
    [phaseKey],
  );
  const [journey, setJourney] = useState<FollowedJourney | null>(null);
  const [bus, setBus] = useState<FollowedBus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Point | null>(null);
  const [snap, setSnap] = useState<SheetSnap>("half");

  const meRef = useRef<Point | null>(null);
  const phaseRef = useRef(phase);
  const lastBoarding = useRef<number | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ── Position ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p: Point = [pos.coords.latitude, pos.coords.longitude];
        meRef.current = p;
        setMe(p);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ── Dados, e o passo em que o passageiro está ─────────────────────────────
  // Pedidos outra vez logo que a posição é conhecida pela primeira vez: a caminhada mede-se a partir dela
  const hasMe = me !== null;
  useEffect(() => {
    if (!legs.length) return;
    let cancelled = false;
    const load = async () => {
      const q = new URLSearchParams({ b });
      const p = meRef.current;
      if (!busOnly) {
        q.set("a", String(phase.a));
        q.set("bordo", phase.bordo ? "1" : "0");
        if (startId) q.set("de", startId);
        if (endId) q.set("para", endId);
      }
      try {
        // POST, para a posição do passageiro ficar fora dos registos de pedidos
        const res = await fetch(`/api/viagem?${q}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p ? { lat: Number(p[0].toFixed(5)), lng: Number(p[1].toFixed(5)) } : {}),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Não foi possível acompanhar esta viagem");
          return;
        }
        setError(null);
        if (data.autocarro) {
          setBus(data.autocarro);
          return;
        }
        const v: FollowedJourney = data.viagem;
        setJourney(v);

        // Avança sozinho: a bordo quando está com o autocarro depois da paragem de embarque, fora
        // quando o autocarro passou a paragem de saída (ou o passageiro está nela e o autocarro não)
        const cur = v.etapas.find((e): e is FollowBus => e.tipo === "autocarro" && e.estado === "agora");
        const ph = phaseRef.current;
        const pos = meRef.current;
        if (cur && !ph.bordo) {
          const busAt: Point = [cur.autocarro.lat, cur.autocarro.lng];
          const withBus = pos ? distanceMeters(pos, busAt) <= ON_BUS_M : lastBoarding.current !== null && Date.now() >= lastBoarding.current - 60_000;
          if (cur.autocarro.trecho === "entre" && withBus) setPhase({ a: ph.a, bordo: true });
          if (cur.embarque) lastBoarding.current = Date.parse(cur.embarque);
        } else if (cur && ph.bordo) {
          const atStop = pos && distanceMeters(pos, [cur.para.lat, cur.para.lng]) <= AT_STOP_M;
          const awayFromBus = pos && distanceMeters(pos, [cur.autocarro.lat, cur.autocarro.lng]) > 2 * ON_BUS_M;
          if (cur.autocarro.trecho === "depois" || (atStop && awayFromBus)) {
            lastBoarding.current = null;
            setPhase({ a: ph.a + 1, bordo: false });
          }
        }
      } catch {
        if (!cancelled) setError("Sem ligação. A tentar de novo…");
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [b, legs.length, busOnly, phase.a, phase.bordo, startId, endId, setPhase, hasMe]);

  // ── Map ─────────────────────────────────────────────────────────────────────
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const busMarkers = useRef(new Map<string, maplibregl.Marker>());
  const meMarker = useRef<maplibregl.Marker | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!mapRef.current || map.current) return;
    const m = new maplibregl.Map({
      container: mapRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [32.5892, -25.9655],
      zoom: 12,
      attributionControl: { compact: true, customAttribution: WALK_ATTRIBUTION },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      m.addSource("legs", { type: "geojson", data: EMPTY });
      m.addSource("walks", { type: "geojson", data: EMPTY });
      m.addSource("points", { type: "geojson", data: EMPTY });
      m.addLayer({
        id: "walk",
        type: "line",
        source: "walks",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#334155", "line-width": 4, "line-dasharray": [0.6, 1.6], "line-opacity": ["case", ["get", "feito"], 0.35, 1] },
      });
      m.addLayer({
        id: "bus-casing",
        type: "line",
        source: "legs",
        filter: ["==", ["get", "kind"], "bus"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 10, "line-opacity": ["case", ["get", "feito"], 0.5, 1] },
      });
      m.addLayer({
        id: "bus",
        type: "line",
        source: "legs",
        filter: ["==", ["get", "kind"], "bus"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "cor"], "line-width": 6, "line-opacity": ["case", ["get", "feito"], 0.35, 1] },
      });
      m.addLayer({
        id: "stops-small",
        type: "circle",
        source: "points",
        filter: ["==", ["get", "role"], "stop"],
        paint: { "circle-radius": 3.5, "circle-color": "#ffffff", "circle-stroke-color": ["get", "cor"], "circle-stroke-width": 2 },
      });
      m.addLayer({
        id: "stops-main",
        type: "circle",
        source: "points",
        filter: ["in", ["get", "role"], ["literal", ["board", "alight"]]],
        paint: { "circle-radius": 7, "circle-color": "#ffffff", "circle-stroke-color": "#0f172a", "circle-stroke-width": 3 },
      });
      m.addLayer({
        id: "stops-end",
        type: "circle",
        source: "points",
        filter: ["==", ["get", "role"], "end"],
        paint: { "circle-radius": 9, "circle-color": "#0f172a", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
      });
      m.addLayer({
        id: "stop-names",
        type: "symbol",
        source: "points",
        filter: ["in", ["get", "role"], ["literal", ["board", "alight", "end"]]],
        layout: {
          "text-field": ["get", "nome"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
          "text-offset": [0, 1.3],
          "text-anchor": "top",
          "text-max-width": 12,
        },
        paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 2 },
      });
      setMapReady(true);
    });
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Linhas e paragens da viagem (ou da via do autocarro)
  useEffect(() => {
    const m = map.current;
    if (!mapReady || !m) return;
    const lines: GeoJSON.Feature[] = [];
    const points: GeoJSON.Feature[] = [];
    const point = (s: StopRef, role: string, cor = "#0f172a"): GeoJSON.Feature => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: { role, nome: s.nome, cor },
    });
    if (journey) {
      journey.etapas.forEach((e, i) => {
        const feito = e.estado === "feito";
        if (e.tipo === "pe") {
          lines.push({ type: "Feature", geometry: { type: "LineString", coordinates: [[e.de.lng, e.de.lat], [e.para.lng, e.para.lat]] }, properties: { kind: "walk-ends" } });
          if (i === journey.etapas.length - 1) points.push(point(e.para, "end"));
        } else {
          lines.push({ type: "Feature", geometry: { type: "LineString", coordinates: e.percurso }, properties: { kind: "bus", cor: e.via.cor, feito } });
          e.paragens.slice(0, -1).forEach((s) => points.push(point(s, "stop", e.via.cor)));
          points.push(point(e.de, "board"));
          points.push(point(e.para, i === journey.etapas.length - 1 ? "end" : "alight"));
        }
      });
    } else if (bus) {
      lines.push({ type: "Feature", geometry: { type: "LineString", coordinates: bus.percurso }, properties: { kind: "bus", cor: bus.via.cor, feito: false } });
      bus.proximas.forEach((p) => points.push(point(p.paragem, "stop", bus.via.cor)));
      if (bus.paragem) points.push(point(bus.paragem.paragem, "board"));
    }
    (m.getSource("legs") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: lines });
    (m.getSource("points") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: points });

    // A viagem inteira à vista, uma vez
    if (!fitted.current && lines.length) {
      fitted.current = true;
      const bounds = new maplibregl.LngLatBounds();
      for (const f of lines) for (const c of (f.geometry as GeoJSON.LineString).coordinates) bounds.extend(c as [number, number]);
      if (meRef.current) bounds.extend([meRef.current[1], meRef.current[0]]);
      // e o autocarro de que o passageiro está à espera, ou em que vai
      const now = journey?.etapas.find((e): e is FollowBus => e.tipo === "autocarro" && e.estado === "agora");
      if (now) bounds.extend([now.autocarro.lng, now.autocarro.lat]);
      if (bus) bounds.extend([bus.autocarro.lng, bus.autocarro.lat]);
      m.fitBounds(bounds, { padding: padding(), maxZoom: 16, duration: 0 });
    }
  }, [mapReady, journey, bus]);

  // As caminhadas, pelas ruas logo que os caminhos chegam
  const walkLegs = useMemo(() => (journey?.etapas ?? []).filter((e): e is FollowWalk => e.tipo === "pe"), [journey]);
  const walks = useMemo<Walk[]>(() => walkLegs.map((e) => ({ from: [e.de.lat, e.de.lng], to: [e.para.lat, e.para.lng] })), [walkLegs]);
  const walkLines = useWalkPaths(walks);
  useEffect(() => {
    if (!mapReady) return;
    (map.current?.getSource("walks") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: walkLines.map((coordinates, i) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: { feito: walkLegs[i]?.estado === "feito" },
      })),
    });
  }, [mapReady, walkLines, walkLegs]);

  // Os autocarros da viagem, em movimento
  useEffect(() => {
    const m = map.current;
    if (!mapReady || !m) return;
    const live = journey
      ? journey.etapas.filter((e): e is FollowBus => e.tipo === "autocarro" && e.estado !== "feito").map((e) => ({ id: e.transporte.id, matricula: e.transporte.matricula, cor: e.via.cor, lat: e.autocarro.lat, lng: e.autocarro.lng }))
      : bus
        ? [{ id: bus.transporte.id, matricula: bus.transporte.matricula, cor: bus.via.cor, lat: bus.autocarro.lat, lng: bus.autocarro.lng }]
        : [];
    const keep = new Set(live.map((x) => x.id));
    for (const [id, marker] of busMarkers.current) {
      if (!keep.has(id)) {
        marker.remove();
        busMarkers.current.delete(id);
      }
    }
    for (const x of live) {
      const existing = busMarkers.current.get(x.id);
      if (existing) glideMarker(existing, [x.lng, x.lat]);
      else busMarkers.current.set(x.id, new maplibregl.Marker({ element: busMarker(x.matricula, x.cor), anchor: "bottom" }).setLngLat([x.lng, x.lat]).addTo(m));
    }
  }, [mapReady, journey, bus]);

  // O passageiro
  useEffect(() => {
    const m = map.current;
    if (!mapReady || !m || !me) return;
    if (!meMarker.current) {
      const { el, face } = mePin();
      paintFace(face);
      meMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([me[1], me[0]]).addTo(m);
    } else meMarker.current.setLngLat([me[1], me[0]]);
  }, [mapReady, me]);

  const showAll = () => {
    const m = map.current;
    if (!m) return;
    const bounds = new maplibregl.LngLatBounds();
    const src = journey ? journey.etapas.flatMap((e) => (e.tipo === "pe" ? [[e.de.lng, e.de.lat], [e.para.lng, e.para.lat]] : e.percurso)) : (bus?.percurso ?? []);
    for (const c of src) bounds.extend(c as [number, number]);
    if (me) bounds.extend([me[1], me[0]]);
    if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: padding(), maxZoom: 16 });
  };
  const showMe = () => me && map.current?.flyTo({ center: [me[1], me[0]], zoom: 16 });

  // ── Panel ───────────────────────────────────────────────────────────────────
  const back = () => (window.history.length > 1 ? router.back() : router.push("/"));
  const finish = () => {
    try {
      sessionStorage.removeItem(phaseKey);
    } catch {
      // nada guardado
    }
    router.push("/");
  };

  let body: React.ReactNode;
  if (!legs.length) body = <p className="text-sm text-slate-600">Esta ligação não tem nenhuma viagem.</p>;
  else if (error && !journey && !bus) body = <p className="text-sm text-red-700">{error}</p>;
  else if (busOnly) body = bus ? <BusPanel bus={bus} /> : <Loading />;
  else
    body = journey ? (
      <JourneyPanel
        journey={journey}
        phase={phase}
        me={me}
        toLabel={toLabel}
        fromLabel={fromLabel}
        onPhase={setPhase}
        onFinish={finish}
      />
    ) : (
      <Loading />
    );

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-100">
      <style jsx global>{`
        @keyframes tp-pulse {
          0% { transform: scale(0.6); opacity: 0.5; }
          100% { transform: scale(2); opacity: 0; }
        }
        .maplibregl-ctrl-top-right { top: 76px; }
        @media (min-width: 768px) { .maplibregl-ctrl-top-right { top: 0; } }
      `}</style>
      <div className="absolute inset-0 z-0">
        <div className="h-full w-full" ref={mapRef} />
      </div>

      {/* Botões do mapa: a viagem inteira, e o passageiro */}
      <div className={`absolute z-30 right-3 flex flex-col gap-2 ${snap === "peek" ? "bottom-[108px]" : "bottom-[calc(50dvh+12px)]"} md:bottom-6`}>
        <button onClick={showAll} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-lg hover:bg-slate-50">
          Ver a viagem toda
        </button>
        {me && (
          <button onClick={showMe} aria-label="Centrar em mim" className="self-end flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg hover:bg-slate-50">
            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
          </button>
        )}
      </div>

      {/* Barra de cima no telemóvel */}
      <div className="md:hidden absolute top-3 left-3 right-3 z-40 flex items-center justify-between gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-lg">
        <button onClick={back} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-800">
          ← Voltar
        </button>
        <span className="truncate text-sm font-bold text-slate-900">{busOnly ? "Autocarro" : "A sua viagem"}</span>
        <UserAvatar />
      </div>

      {/* Painel: um cartão à esquerda num computador, uma folha em baixo num telemóvel (arrastada até ao ecrã inteiro) */}
      <Sheet
        snap={snap}
        onSnap={setSnap}
        peek={96}
        label={busOnly ? "Acompanhar autocarro" : "A sua viagem"}
        header={
          <>
            <button onClick={back} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-200">
              ← Voltar
            </button>
            <span className="text-sm font-bold text-slate-900">{busOnly ? "Acompanhar autocarro" : "A sua viagem"}</span>
            <UserAvatar />
          </>
        }
      >
        {body}
      </Sheet>
    </div>
  );
}

function Loading() {
  return <p className="py-6 text-center text-sm text-slate-600">A carregar a viagem…</p>;
}

function JourneyPanel({
  journey,
  phase,
  me,
  toLabel,
  fromLabel,
  onPhase,
  onFinish,
}: {
  journey: FollowedJourney;
  phase: Phase;
  me: Point | null;
  toLabel: string;
  fromLabel: string;
  onPhase: (p: Phase) => void;
  onFinish: () => void;
}) {
  const buses = journey.etapas.filter((e): e is FollowBus => e.tipo === "autocarro");
  const current = buses.find((e) => e.estado === "agora") ?? null;
  const last = journey.etapas[journey.etapas.length - 1];
  const finalWalk = !current && last?.tipo === "pe" ? last : null;
  const arrived = !current && (!finalWalk || (me !== null && distanceMeters(me, [finalWalk.para.lat, finalWalk.para.lng]) <= AT_STOP_M));
  // Minutos desde a última actualização (no máximo REFRESH_MS)
  const leftMin = journey.duracaoMin;

  return (
    <div>
      {/* Para onde, e quando */}
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Destino</p>
        <p className="truncate text-lg font-bold text-slate-900">{toLabel || last?.para.nome}</p>
        <p className="text-sm text-slate-700">
          {arrived ? (
            "Chegou."
          ) : (
            <>
              Chega <strong className="text-slate-900">{at(journey.chegada)}</strong>
              {leftMin < 60 && leftMin >= 0 ? ` · daqui a ${duration(Math.max(1, leftMin))}` : ""}
            </>
          )}
          {" · "}
          {journey.tarifa} MT
        </p>
        {fromLabel && <p className="text-xs text-slate-500 truncate">Partida: {fromLabel}</p>}
      </div>

      <NowCard journey={journey} current={current} finalWalk={finalWalk} arrived={arrived} phase={phase} me={me} onPhase={onPhase} onFinish={onFinish} />

      {/* Todos os passos */}
      <ol className="mt-4 space-y-0">
        {journey.etapas.map((e, i) => (
          <Step key={i} e={e} last={i === journey.etapas.length - 1} />
        ))}
      </ol>

      <div className="mt-4 flex flex-col gap-2">
        {buses[0] && <AlertButton transporteId={buses[0].transporte.id} paragemId={buses[0].de.id} paragem={buses[0].de.nome} />}
        <button onClick={onFinish} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
          Terminar viagem
        </button>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Atualizado às {maputoClock(new Date(journey.atualizadoEm))}. Horas estimadas pela posição dos autocarros (GPS quando disponível, senão o horário).
      </p>
    </div>
  );
}

/** O passo em que o passageiro está agora, em letra grande, com o que fazer. */
function NowCard({
  journey,
  current,
  finalWalk,
  arrived,
  phase,
  me,
  onPhase,
  onFinish,
}: {
  journey: FollowedJourney;
  current: FollowBus | null;
  finalWalk: FollowWalk | null;
  arrived: boolean;
  phase: Phase;
  me: Point | null;
  onPhase: (p: Phase) => void;
  onFinish: () => void;
}) {
  const box = "rounded-2xl bg-slate-900 p-4 text-white";
  const action = "mt-3 inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100";
  const ghost = "mt-3 ml-2 inline-flex items-center rounded-full border border-white/40 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10";

  if (arrived)
    return (
      <div className={box}>
        <p className="text-lg font-bold">Chegou ao destino</p>
        <button className={action} onClick={onFinish}>
          Terminar viagem
        </button>
      </div>
    );

  if (!current && finalWalk)
    return (
      <div className={box}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">A pé</p>
        <p className="text-lg font-bold">Caminhe até {finalWalk.para.nome}</p>
        <p className="text-sm text-white/80">
          {formatDistance(finalWalk.metros)} · {finalWalk.minutos} min
        </p>
      </div>
    );
  if (!current) return null;

  const walk = journey.etapas.find((e): e is FollowWalk => e.tipo === "pe" && e.estado === "agora" && e.para.id === current.de.id);
  const atStop = !walk || walk.metros <= AT_STOP_M || (me !== null && distanceMeters(me, [current.de.lat, current.de.lng]) <= AT_STOP_M);
  const busLabel = (
    <span className="inline-flex items-center gap-2">
      <span className="rounded-lg px-1.5 py-0.5 text-xs font-bold" style={{ background: current.via.cor, color: textOn(current.via.cor) }}>
        {current.via.codigo}
      </span>
      <span className="font-mono text-sm font-bold">{current.transporte.matricula}</span>
    </span>
  );

  if (phase.bordo) {
    const left = current.paragens.length;
    return (
      <div className={box}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">No autocarro {busLabel}</p>
        <p className="mt-1 text-lg font-bold">
          Saia em {current.para.nome} {current.chegada ? at(current.chegada) : ""}
        </p>
        <p className="text-sm text-white/80">
          {current.chegada && soon(current.chegada) ? `${soon(current.chegada)} · ` : ""}
          {left} {left === 1 ? "paragem" : "paragens"} · sentido {current.sentido}
        </p>
        <button className={action} onClick={() => onPhase({ a: phase.a + 1, bordo: false })}>
          Já saí
        </button>
        <button className={ghost} onClick={() => onPhase({ a: phase.a, bordo: false })}>
          Ainda não entrei
        </button>
      </div>
    );
  }

  const comes = current.autocarro.minutosAteEmbarque;
  return (
    <div className={box}>
      <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{atStop ? "Na paragem" : "A pé"}</p>
      <p className="mt-1 text-lg font-bold">{atStop ? `Espere em ${current.de.nome}` : `Caminhe até ${current.de.nome}`}</p>
      {!atStop && walk && (
        <p className="text-sm text-white/80">
          {formatDistance(walk.metros)} · {walk.minutos} min a pé
        </p>
      )}
      <div className="mt-3 rounded-xl bg-white/10 p-3">
        <div className="flex items-center justify-between gap-2">
          {busLabel}
          <span className="text-xs text-white/70 truncate">sentido {current.sentido}</span>
        </div>
        <p className="mt-1 text-sm">
          {comes !== null && comes < 60
            ? comes <= 1
              ? "O autocarro está a chegar à paragem"
              : `O autocarro chega à paragem em ${comes} min`
            : current.embarque
              ? `O autocarro passa ${at(current.embarque)}`
              : "Sem hora para este autocarro"}
          {/* A distância só interessa enquanto o autocarro vem a caminho (não de noite) */}
          {comes !== null && comes < 60 && current.autocarro.metrosAteEmbarque ? ` · a ${formatDistance(current.autocarro.metrosAteEmbarque)}` : ""}
        </p>
        {current.perde && current.embarque && (
          <p className="mt-1 text-xs font-semibold text-amber-300">Chega antes de si: apanha-o na passagem seguinte, {at(current.embarque)}.</p>
        )}
      </div>
      <button className={action} onClick={() => onPhase({ a: phase.a, bordo: true })}>
        Já entrei no autocarro
      </button>
    </div>
  );
}

function Step({ e, last }: { e: FollowWalk | FollowBus; last: boolean }) {
  const dot =
    e.estado === "feito" ? (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-[11px] font-bold text-white" aria-label="Feito">
        ✓
      </span>
    ) : e.estado === "agora" ? (
      <span className="h-5 w-5 rounded-full border-4 border-blue-600 bg-white" aria-label="Agora" />
    ) : (
      <span className="h-5 w-5 rounded-full border-2 border-slate-400 bg-white" aria-label="Depois" />
    );
  const muted = e.estado === "feito" ? "opacity-50" : "";
  const line =
    e.tipo === "pe" ? (
      <span className="w-0 flex-1 border-l-2 border-dashed border-slate-400" />
    ) : (
      <span className="w-1.5 flex-1 rounded-full" style={{ background: e.via.cor }} />
    );
  return (
    <li className={`flex gap-3 ${muted}`}>
      <div className="flex w-5 flex-col items-center">
        {dot}
        {!last && line}
      </div>
      <div className="min-w-0 flex-1 pb-4 text-sm">
        {e.tipo === "pe" ? (
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">A pé</span> · {formatDistance(e.metros)} ({e.minutos} min) até{" "}
            <strong className="font-semibold">{e.para.nome}</strong>
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  <span className="mr-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: e.via.cor, color: textOn(e.via.cor) }}>
                    {e.via.codigo}
                  </span>
                  {e.via.nome}
                </p>
                <p className="text-xs text-slate-600">Sentido {e.sentido}</p>
              </div>
              <Plate matricula={e.transporte.matricula} />
            </div>
            <p className="mt-1 text-slate-800">
              Apanhe em <strong className="font-semibold">{e.de.nome}</strong> {e.embarque ? at(e.embarque) : ""}
            </p>
            <p className="text-slate-800">
              Saia em <strong className="font-semibold">{e.para.nome}</strong> {e.chegada ? at(e.chegada) : ""}
            </p>
            <p className="text-xs text-slate-500">
              {e.paragens.length} {e.paragens.length === 1 ? "paragem" : "paragens"} · {duration(e.viagemMin)} · {formatDistance(e.metros)} · {e.tarifa} MT
            </p>
            {e.estado === "depois" && e.autocarro.minutosAteEmbarque !== null && e.autocarro.minutosAteEmbarque < 60 && (
              <p className="text-xs text-blue-700">Este autocarro está a {e.autocarro.minutosAteEmbarque} min da paragem agora.</p>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function BusPanel({ bus }: { bus: FollowedBus }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900">
            <span className="mr-1.5 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: bus.via.cor, color: textOn(bus.via.cor) }}>
              {bus.via.codigo}
            </span>
            {bus.via.nome}
          </p>
          <p className="text-sm text-slate-600">Sentido {bus.sentido}</p>
          <p className="text-xs text-slate-500">{bus.autocarro.fonte === "gps" ? "Posição GPS" : "Posição pelo horário"}</p>
        </div>
        <Plate matricula={bus.transporte.matricula} />
      </div>

      {bus.paragem && (
        <div className="mt-3 rounded-2xl bg-slate-900 p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">A sua paragem</p>
          <p className="text-lg font-bold">{bus.paragem.paragem.nome}</p>
          <p className="text-sm text-white/80">
            {bus.paragem.minutos <= 1 ? "O autocarro está a chegar" : `O autocarro chega em ${duration(bus.paragem.minutos)}`} · sentido {bus.paragem.sentido}
          </p>
        </div>
      )}

      <h3 className="mt-4 mb-1 text-sm font-bold text-slate-900">Próximas paragens</h3>
      {bus.proximas.length ? (
        <ol className="divide-y divide-slate-100">
          {bus.proximas.filter((p, i, all) => i === 0 || p.paragem.nome !== all[i - 1].paragem.nome).map((p) => (
            <li key={p.paragem.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate text-slate-800">{p.paragem.nome}</span>
              <span className="shrink-0 font-semibold text-slate-900">{p.minutos <= 1 ? "agora" : duration(p.minutos)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-600">
          {bus.estado === "Fora de serviço" ? "O autocarro está parado: o motorista ainda não iniciou a viagem." : "O autocarro está parado no terminal."}
        </p>
      )}
      {bus.paragem && <div className="mt-3"><AlertButton transporteId={bus.transporte.id} paragemId={bus.paragem.paragem.id} paragem={bus.paragem.paragem.nome} /></div>}
      <p className="mt-3 text-[11px] text-slate-500">Atualizado às {maputoClock(new Date(bus.atualizadoEm))}.</p>
    </div>
  );
}

/** Um alerta por SMS quando um autocarro está perto de `paragem` (a página da conta lista-os). */
function AlertButton({ transporteId, paragemId, paragem }: { transporteId: string; paragemId: string; paragem: string }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; message?: string }>({ status: "idle" });
  const save = async () => {
    let token: string | undefined;
    try {
      token = JSON.parse(localStorage.getItem("utente") ?? "null")?.token;
    } catch {
      token = undefined;
    }
    if (!token) {
      setState({ status: "error", message: "Entre na sua conta para receber o SMS." });
      return;
    }
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/user/missions/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transporteId, paragemId }),
      });
      if (res.status === 401) {
        localStorage.removeItem("utente");
        setState({ status: "error", message: "A sua sessão expirou. Entre de novo." });
        return;
      }
      const data = await res.json();
      setState(res.ok ? { status: "done", message: data.message } : { status: "error", message: data.error ?? "Não foi possível guardar." });
    } catch {
      setState({ status: "error", message: "Sem ligação ao servidor." });
    }
  };
  if (state.status === "done") return <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">SMS ativado para {paragem}.</p>;
  return (
    <div>
      <button
        onClick={save}
        disabled={state.status === "loading"}
        className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {state.status === "loading" ? "A guardar…" : `Avisar-me por SMS quando o autocarro estiver perto de ${paragem}`}
      </button>
      {state.message && <p className="mt-1 text-xs text-red-700">{state.message}</p>}
    </div>
  );
}
