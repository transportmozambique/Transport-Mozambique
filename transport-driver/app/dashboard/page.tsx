"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { API_BASE, type TripState } from "@/lib/api";
import Sheet, { type SheetSnap } from "../components/Sheet";

interface MotoristaData {
  id: string;
  nome: string;
  bi: string;
  telefone: string;
  email: string;
  foto?: string;
  status: string;
  categoriaCarta: string;
  experienciaAnos: number;
  token?: string; // session token from the login, sent as "Authorization: Bearer"
  transporte?: { id: string; matricula: string; marca: string; modelo: string; cor: string; lotacao: number; currGeoLocation?: string; };
  via?: { id: string; nome: string; codigo: string; terminalPartida: string; terminalChegada: string; geoLocationPath: string; municipio: string; paragens: Array<{ id: string; nome: string; geoLocation: string; isTerminal: boolean; }>; };
}

// Passengers waiting along the route (stop alerts asked for in the last 3 hours)
interface Waiting { total: number; paragens: Array<{ nome: string; aEspera: number; }>; }

const BUS_SVG = `<svg width="40" height="48" viewBox="0 0 48 56" style="display:block;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.45))">
  <ellipse cx="24" cy="52" rx="18" ry="3" fill="#000" opacity="0.25"/>
  <rect x="8" y="16" width="32" height="34" rx="7" fill="#0f172a" stroke="#fff" stroke-width="2"/>
  <rect x="12" y="20" width="24" height="9" rx="3" fill="#e0f2fe" opacity=".9"/>
  <circle cx="16" cy="14" r="3" fill="#fef08a" stroke="#fff"/>
  <circle cx="32" cy="14" r="3" fill="#fef08a" stroke="#fff"/>
  <circle cx="15" cy="50" r="4" fill="#1e293b"/>
  <circle cx="33" cy="50" r="4" fill="#1e293b"/>
</svg>`;

/** A route path, "lng,lat;lng,lat;…", as [lng, lat] points */
function parsePoints(text: string | undefined | null): [number, number][] {
  return (text ?? "")
    .split(";")
    .map((p) => p.split(",").map(Number))
    .filter((p): p is [number, number] => p.length === 2 && p.every(Number.isFinite));
}

/**
 * The part of the map the panel leaves visible, as the map's padding (so centring uses it):
 * above the sheet on a phone, right of the card on a computer.
 */
function mapPadding(snap: SheetSnap) {
  return window.matchMedia('(min-width: 768px)').matches
    ? { top: 0, bottom: 0, left: 432, right: 0 }
    : { top: 80, bottom: snap === 'peek' ? 136 : Math.round(window.innerHeight * 0.5), left: 0, right: 0 };
}

const initials = (nome: string) => {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

const clock = (s: number) =>
  `${Math.floor(s / 3600).toString().padStart(2, "0")}:${Math.floor((s % 3600) / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

export default function DashboardPage() {
  const router = useRouter();
  const [motorista, setMotorista] = useState<MotoristaData | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [tripStart, setTripStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tripBusy, setTripBusy] = useState(false);
  const [tripError, setTripError] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const busRef = useRef<Marker | null>(null);
  // The phone's position: the bus marker follows it
  const [here, setHere] = useState<[number, number] | null>(null);
  const hereRef = useRef<[number, number] | null>(null);
  // Real GPS: during a trip the phone's position goes to /api/gps with the vehicle's device code
  // (created in the admin, Transporte → Rastreador GPS), saved once on this phone.
  const [gpsCode, setGpsCode] = useState("");
  const [gpsInput, setGpsInput] = useState("");
  const [gpsStatus, setGpsStatus] = useState("");
  const gpsRef = useRef({ active: false, code: "", lastSent: 0 });

  useEffect(() => {
    const stored = localStorage.getItem('motorista');
    if (!stored) { router.push('/'); return; }
    setMotorista(JSON.parse(stored));
    try {
      const code = localStorage.getItem('gpsCodigo') || '';
      setGpsCode(code);
      setGpsInput(code);
    } catch {}

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition((p) => {
        setSpeed(Math.round((p.coords.speed || 0) * 3.6));
        setHere([p.coords.longitude, p.coords.latitude]);
        const g = gpsRef.current;
        if (!g.active || !g.code || Date.now() - g.lastSent < 15000) return;
        g.lastSent = Date.now();
        fetch(`${API_BASE}/api/gps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${g.code}` },
          body: JSON.stringify({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            speed: p.coords.speed == null ? null : p.coords.speed * 3.6,
            heading: p.coords.heading,
            accuracy: p.coords.accuracy,
            timestamp: p.timestamp,
          }),
        })
          .then((r) => setGpsStatus(r.ok ? `GPS enviado às ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}` : r.status === 401 ? 'Código GPS inválido' : 'Erro ao enviar GPS'))
          .catch(() => setGpsStatus('Sem ligação: GPS não enviado'));
      }, () => setGpsStatus('Localização do telemóvel indisponível'), { enableHighAccuracy: true, maximumAge: 5000 });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [router]);

  useEffect(() => {
    gpsRef.current.active = isActive;
    gpsRef.current.code = gpsCode;
  }, [isActive, gpsCode]);

  const saveGpsCode = () => {
    const code = gpsInput.trim();
    try { localStorage.setItem('gpsCodigo', code); } catch {}
    setGpsCode(code);
    gpsRef.current.lastSent = 0;
    setGpsStatus(code ? 'Código guardado: a posição é enviada durante a viagem' : 'Código removido');
  };

  // The map, tilted with 3D buildings, with the route, its stops and the bus
  useEffect(() => {
    if (!motorista || !mapContainerRef.current || mapRef.current) return;
    let cancelled = false;

    import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !mapContainerRef.current) return;
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [32.5732, -25.9692],
        zoom: 14,
        pitch: 60,
        bearing: 0,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        setMapReady(true);
        map.setPadding(mapPadding('half'));
        const firstSymbolId = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
        if (!map.getSource('openmaptiles')) map.addSource('openmaptiles', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
        map.addLayer(
          {
            id: '3d-buildings',
            source: 'openmaptiles',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 15,
            paint: {
              'fill-extrusion-color': '#d1d5db',
              'fill-extrusion-height': ['case', ['has', 'render_height'], ['get', 'render_height'], 5],
              'fill-extrusion-base': ['case', ['has', 'render_min_height'], ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.8,
            },
          },
          firstSymbolId,
        );

        const coords = parsePoints(motorista.via?.geoLocationPath);
        if (!coords.length) return;
        map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
        map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 10 } });
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#2563eb', 'line-width': 6 } });

        // A stop's position is "lat,lng" (the other way round from the path)
        const stops = (motorista.via?.paragens ?? []).flatMap((s) => {
          const [lat, lng] = s.geoLocation.split(',').map(Number);
          return Number.isFinite(lat) && Number.isFinite(lng)
            ? [{ type: 'Feature' as const, properties: { nome: s.nome, terminal: s.isTerminal }, geometry: { type: 'Point' as const, coordinates: [lng, lat] } }]
            : [];
        });
        map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: stops } });
        map.addLayer({
          id: 'stops',
          type: 'circle',
          source: 'stops',
          paint: {
            'circle-radius': ['case', ['get', 'terminal'], 8, 5.5],
            'circle-color': ['case', ['get', 'terminal'], '#0f172a', '#ffffff'],
            'circle-stroke-color': ['case', ['get', 'terminal'], '#ffffff', '#2563eb'],
            'circle-stroke-width': 3,
          },
        });
        map.addLayer({
          id: 'stop-names',
          type: 'symbol',
          source: 'stops',
          minzoom: 13,
          layout: { 'text-field': ['get', 'nome'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-max-width': 10 },
          paint: { 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
        });

        const busEl = document.createElement('div');
        busEl.innerHTML = BUS_SVG;
        busRef.current = new maplibregl.Marker({ element: busEl, anchor: 'center' }).setLngLat(hereRef.current ?? coords[0]).addTo(map);
        map.flyTo({ center: hereRef.current ?? coords[0], zoom: 14, pitch: 60, duration: 2000 });
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      busRef.current = null;
    };
  }, [motorista]);

  // The bus marker is where the phone is, once its position is known
  useEffect(() => {
    hereRef.current = here;
    if (here) busRef.current?.setLngLat(here);
  }, [here]);

  useEffect(() => {
    if (mapReady) mapRef.current?.setPadding(mapPadding(snap));
  }, [snap, mapReady]);

  const centre = () => {
    const at = here ?? parsePoints(motorista?.via?.geoLocationPath)[0];
    if (at) mapRef.current?.flyTo({ center: at, zoom: 16, pitch: 60 });
  };

  // Trip state is stored on the server and shared with the USSD driver menu
  const applyTrip = useCallback((trip: TripState) => {
    setIsActive(trip.emViagem);
    setTripStart(trip.emViagem && trip.viagemIniciadaEm ? new Date(trip.viagemIniciadaEm).getTime() : null);
  }, []);

  const handleLogout = useCallback(() => { localStorage.removeItem('motorista'); router.push('/'); }, [router]);

  // Load it on open and re-check every 30s, so a trip started or ended by USSD shows up here.
  // The session token from the login identifies the driver; without a valid one, sign in again.
  const sessionToken: string | undefined = motorista?.token;
  useEffect(() => {
    if (!motorista) return;
    if (!sessionToken) { handleLogout(); return; }
    let cancelled = false;
    const load = () => fetch(`${API_BASE}/api/driver/trip`, { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then((r) => {
        if (r.status === 401 && !cancelled) handleLogout();
        return r.ok ? r.json() : null;
      })
      .then((trip: TripState | null) => { if (trip && !cancelled) applyTrip(trip); })
      .catch(() => {});
    load();
    const i = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(i); };
  }, [motorista, sessionToken, applyTrip, handleLogout]);

  // Passengers waiting at the route's stops, refreshed every minute
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    const load = () => fetch(`${API_BASE}/api/driver/seguidores`, { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((w: Waiting | null) => { if (w && !cancelled) setWaiting(w); })
      .catch(() => {});
    load();
    const i = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(i); };
  }, [sessionToken]);

  const toggleRide = async () => {
    if (!motorista || tripBusy) return;
    setTripBusy(true);
    setTripError("");
    try {
      const res = await fetch(`${API_BASE}/api/driver/trip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: isActive ? 'encerrar' : 'iniciar' }),
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      if (!res.ok) { setTripError(data.error || 'Erro ao atualizar a viagem'); return; }
      setNow(Date.now());
      applyTrip(data);
    } catch {
      setTripError('Erro de conexão. Tente novamente.');
    } finally {
      setTripBusy(false);
    }
  };

  useEffect(() => { if (isActive) { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); } }, [isActive]);
  const rideTime = isActive && tripStart !== null ? Math.max(0, Math.floor((now - tripStart) / 1000)) : 0;

  if (!motorista) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  const via = motorista.via;
  const terminals = new Set((via?.paragens ?? []).filter((s) => s.isTerminal).map((s) => s.nome));
  // The route's stops in travel order, with the passengers waiting at each (until the count
  // arrives, the stops from the sign-in). Stops in a row with the same name (both sides of a
  // street) are shown once, with their passengers added up.
  const stops = (waiting?.paragens.length ? waiting.paragens : (via?.paragens ?? []).map((s) => ({ nome: s.nome, aEspera: 0 }))).reduce<
    { nome: string; aEspera: number }[]
  >((list, s) => {
    const last = list[list.length - 1];
    if (last && last.nome.trim().toLowerCase() === s.nome.trim().toLowerCase()) last.aEspera += s.aEspera;
    else list.push({ nome: s.nome, aEspera: s.aEspera });
    return list;
  }, []);
  const total = waiting?.total ?? 0;

  const driverCard = (
    <button onClick={() => setShowProfile(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Abrir o perfil">
      <DriverId motorista={motorista} />
    </button>
  );
  const statusPill = (
    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
      {isActive ? 'Em viagem' : 'Parado'}
    </span>
  );

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-100">
      <div className="absolute inset-0 z-0">
        <div ref={mapContainerRef} className="h-full w-full" />
      </div>

      {/* Phone: the driver and the trip state on top of the map */}
      <div className="absolute left-3 right-3 top-3 z-40 flex items-center gap-3 rounded-2xl bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur md:hidden">
        {driverCard}
        {statusPill}
      </div>

      <button
        onClick={centre}
        aria-label="Centrar no autocarro"
        className={`absolute right-3 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg hover:bg-slate-50 ${snap === 'peek' ? 'bottom-[148px]' : 'bottom-[calc(50dvh+12px)]'} md:bottom-8`}
      >
        <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="3.5" />
          <path strokeLinecap="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
        </svg>
      </button>

      <Sheet snap={snap} onSnap={setSnap} peek={136} label="Viagem" header={<>{driverCard}{statusPill}</>}>
        <div className="space-y-5 pt-1">
          <div>
            <button
              onClick={toggleRide}
              disabled={tripBusy}
              className={`w-full rounded-full py-4 text-base font-bold text-white shadow-lg transition-colors disabled:opacity-60 ${isActive ? 'bg-slate-900 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              {tripBusy ? 'Um momento…' : isActive ? 'Terminar viagem' : 'Iniciar viagem'}
            </button>
            {tripError && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{tripError}</p>}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat value={clock(rideTime)} label="Tempo de viagem" small />
            <Stat value={String(speed)} label="km/h" />
            <Stat value={String(total)} label="À espera" accent={total > 0} />
          </div>

          <button
            onClick={() => setShowProfile(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!gpsCode ? 'bg-slate-300' : isActive ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">GPS do telemóvel</span>
              <span className="block truncate text-xs text-slate-500">
                {!gpsCode ? 'Sem código: toque para o configurar' : gpsStatus || (isActive ? 'A enviar a posição durante a viagem' : 'Enviado durante a viagem')}
              </span>
            </span>
            <span className="text-slate-400" aria-hidden>›</span>
          </button>

          {via ? (
            <section>
              <div className="mb-3 flex items-start gap-2">
                <span className="mt-0.5 shrink-0 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white">{via.codigo}</span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900">{via.nome}</h2>
                  <p className="text-xs text-slate-500">
                    {via.terminalPartida} → {via.terminalChegada}
                  </p>
                </div>
              </div>
              <ol>
                {stops.map((s, i) => {
                  const terminal = terminals.has(s.nome);
                  return (
                    <li key={`${s.nome}-${i}`} className="relative flex items-center gap-3 py-1.5 pl-1">
                      {i < stops.length - 1 && <span className="absolute left-[11px] top-1/2 h-full w-0.5 bg-blue-200" aria-hidden />}
                      <span
                        className={`relative z-10 shrink-0 rounded-full border-[3px] ${terminal ? 'h-4 w-4 border-slate-900 bg-white' : 'ml-0.5 h-3 w-3 border-blue-600 bg-white'}`}
                        aria-hidden
                      />
                      <span className={`min-w-0 flex-1 truncate text-sm ${terminal ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{s.nome}</span>
                      {s.aEspera > 0 && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                          {s.aEspera} à espera
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs text-slate-500">À espera: pedidos de alerta das últimas 3 horas (app ou USSD) em cada paragem. Atualizado a cada minuto.</p>
            </section>
          ) : (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Sem rota atribuída. Peça ao administrador para o atribuir a um veículo com rota.</p>
          )}
        </div>
      </Sheet>

      {showProfile && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 md:items-center" onClick={() => setShowProfile(false)}>
          <div
            role="dialog"
            aria-label="Perfil"
            className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-md md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <DriverId motorista={motorista} />
              </div>
              <button onClick={() => setShowProfile(false)} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                Fechar
              </button>
            </div>
            <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 text-sm">
              <Row label="BI" value={motorista.bi} />
              <Row label="Telefone" value={motorista.telefone} />
              {motorista.transporte && <Row label="Veículo" value={`${motorista.transporte.marca} ${motorista.transporte.modelo} · ${motorista.transporte.matricula}`} />}
              {via && <Row label="Rota" value={`${via.codigo} · ${via.nome}`} />}
            </dl>

            <label className="mt-5 block text-sm font-semibold text-slate-900" htmlFor="gps-code">
              Código GPS do veículo
            </label>
            <p className="text-xs text-slate-500">Do painel de administração (Transportes → veículo → Rastreador GPS). Com ele, a posição do telemóvel é enviada durante a viagem.</p>
            <div className="mt-2 flex gap-2">
              <input
                id="gps-code"
                value={gpsInput}
                onChange={(e) => setGpsInput(e.target.value)}
                placeholder="Código do rastreador"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <button onClick={saveGpsCode} className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                Guardar
              </button>
            </div>
            {gpsStatus && <p className="mt-2 text-xs text-slate-600">{gpsStatus}</p>}

            <button onClick={handleLogout} className="mt-6 w-full rounded-full border border-slate-300 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DriverId({ motorista }: { motorista: MotoristaData }) {
  return (
    <>
      {motorista.foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={motorista.foto} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{initials(motorista.nome)}</span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-slate-900">{motorista.nome}</span>
        <span className="block truncate text-xs text-slate-500">
          {motorista.transporte?.matricula ?? 'Sem veículo'}
          {motorista.via ? ` · ${motorista.via.codigo}` : ''}
        </span>
      </span>
    </>
  );
}

function Stat({ value, label, small = false, accent = false }: { value: string; label: string; small?: boolean; accent?: boolean }) {
  return (
    <div className={`rounded-2xl px-2 py-3 text-center ${accent ? 'bg-emerald-50' : 'bg-slate-50'}`}>
      <div className={`font-bold tabular-nums ${small ? 'text-base' : 'text-2xl'} ${accent ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
