"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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
  transporte?: {
    id: string;
    matricula: string;
    marca: string;
    modelo: string;
    cor: string;
    lotacao: number;
    currGeoLocation?: string;
  };
  via?: {
    id: string;
    nome: string;
    codigo: string;
    terminalPartida: string;
    terminalChegada: string;
    geoLocationPath: string;
    municipio: string;
    paragens: Array<{
      id: string;
      nome: string;
      geoLocation: string;
      isTerminal: boolean;
    }>;
  };
}

interface ClientInfo {
  total: number;
  stops: Array<{
    stopName: string;
    clients: number;
    money: number;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [motorista, setMotorista] = useState<MotoristaData | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [clients, setClients] = useState(0);
  const [rideTime, setRideTime] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [showRideInfoModal, setShowRideInfoModal] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const clientInfo: ClientInfo = {
    total: clients,
    stops: motorista?.via?.paragens.map((stop, idx) => ({
      stopName: stop.nome,
      clients: Math.floor(clients * (idx + 1) / (motorista?.via?.paragens.length || 1)),
      money: Math.floor(clients * (idx + 1) / (motorista?.via?.paragens.length || 1) * 15)
    })) || []
  };

  useEffect(() => {
    const stored = localStorage.getItem('motorista');
    if (!stored) { router.push('/'); return; }
    setMotorista(JSON.parse(stored));

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (p) => setSpeed(Math.round((p.coords.speed || 0) * 3.6)),
        () => {}, { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [router]);

  // Initialize map
  useEffect(() => {
    if (!motorista || !mapContainerRef.current || mapRef.current) return;

    console.log("Creating map with 3D tilt...");

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [32.5732, -25.9692],
      zoom: 15,
      pitch: 60, // 60 degree tilt for 3D view
      bearing: 0
    });

    mapRef.current = map;

    map.on('load', () => {
      console.log("Map loaded with 3D");

      if (motorista?.via?.geoLocationPath) {
        const coords = motorista.via.geoLocationPath.split(';')
          .map(c => { const [lng, lat] = c.split(',').map(Number); return [lng, lat] as [number, number]; })
          .filter(c => !isNaN(c[0]) && !isNaN(c[1]));

        if (coords.length > 0) {
          // Add route
          map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
          map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#374151', 'line-width': 5 } });

          // Add bus marker
          const busEl = document.createElement('div');
          busEl.innerHTML = `<svg width="40" height="48" viewBox="0 0 48 56"><ellipse cx="24" cy="52" rx="18" ry="3" fill="#000" opacity="0.3"/><rect x="8" y="16" width="32" height="34" rx="2" fill="#374151" stroke="#000"/><rect x="10" y="12" width="28" height="5" rx="1" fill="#000"/><circle cx="16" cy="14" r="3" fill="#fff" stroke="#000"/><circle cx="32" cy="14" r="3" fill="#fff" stroke="#000"/><circle cx="14" cy="50" r="4" fill="#000"/><circle cx="34" cy="50" r="4" fill="#000"/></svg>`;
          new maplibregl.Marker({ element: busEl }).setLngLat(coords[0]).addTo(map);

          // Add stops
          motorista.via.paragens.forEach(stop => {
            const [lng, lat] = stop.geoLocation.split(',').map(Number);
            if (!isNaN(lng) && !isNaN(lat)) {
              const el = document.createElement('div');
              el.style.cssText = `width:${stop.isTerminal?20:14}px;height:${stop.isTerminal?20:14}px;background:${stop.isTerminal?'#000':'#666'};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)`;
              new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
            }
          });

          map.flyTo({ center: coords[0], zoom: 16, pitch: 60, duration: 2000 });
        }
      }
    });

    map.on('error', (e) => console.error('Map error:', e));
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => { mapRef.current = null; };
  }, [motorista]);

  const handleLogout = () => { localStorage.removeItem('motorista'); router.push('/'); };
  const toggleRide = () => { setIsActive(!isActive); if (isActive) { setClients(0); setRideTime(0); } };
  const formatTime = (s: number) => `${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor((s%3600)/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  useEffect(() => { if (isActive) { const i = setInterval(() => setRideTime(t => t + 1), 1000); return () => clearInterval(i); } }, [isActive]);

  if (!motorista) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-500 border-t-white"></div></div>;

  return (
    <div className="min-h-screen bg-gray-900 relative overflow-hidden">
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      <div className="absolute top-4 left-4 z-20">
        <button onClick={() => setShowInfo(!showInfo)} className="flex items-center gap-3 bg-gray-900/90 p-3 rounded-xl border border-gray-700">
          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
            {motorista.foto ? <img src={motorista.foto} className="w-10 h-10 rounded-full" /> : <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
          </div>
          <div><p className="text-white font-medium text-sm">{motorista.nome}</p><p className="text-gray-400 text-xs">{motorista.transporte?.matricula || 'Sem veiculo'}</p></div>
        </button>
        {showInfo && <div className="mt-2 bg-gray-900 p-4 rounded-xl w-64">
          <p className="text-gray-400 text-xs">BI: <span className="text-white">{motorista.bi}</span></p>
          <p className="text-gray-400 text-xs">Telefone: <span className="text-white">{motorista.telefone}</span></p>
          {motorista.transporte && <><p className="text-gray-400 text-xs">Veiculo: <span className="text-white">{motorista.transporte.marca}</span></p><p className="text-gray-400 text-xs">Matricula: <span className="text-white">{motorista.transporte.matricula}</span></p></>}
          {motorista.via && <p className="text-gray-400 text-xs">Rota: <span className="text-white">{motorista.via.nome}</span></p>}
          <button onClick={handleLogout} className="mt-3 w-full py-2 bg-gray-800 text-white rounded-lg">Sair</button>
        </div>}
      </div>

      <div className="absolute top-4 right-4 z-20">
        <button onClick={toggleRide} className={`px-6 py-3 rounded-xl font-semibold ${isActive ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
          {isActive ? 'Finalizar' : 'Iniciar'}
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gray-900/95 p-4 border-t border-gray-700">
        <div className="flex justify-around">
          <div className="text-center"><div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center mb-2"><span className="text-2xl font-bold text-white">{speed}</span></div><p className="text-gray-400 text-xs">km/h</p></div>
          <button onClick={() => setShowClientsModal(true)} className="text-center"><div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center mb-2"><span className="text-2xl font-bold text-white">{clients}</span></div><p className="text-gray-400 text-xs">Seguidores</p></button>
          <button onClick={() => setShowRideInfoModal(true)} className="text-center"><div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center mb-2"><span className="text-xl font-bold text-white">{formatTime(rideTime)}</span></div></button>
        </div>
      </div>

      {showClientsModal && <div className="fixed inset-0 bg-black/70 z-30 flex items-end"><div className="bg-gray-900 w-full rounded-t-2xl p-6 max-h-[70vh] overflow-y-auto">
        <div className="flex justify-between mb-4"><h2 className="text-xl font-bold text-white">Passageiros</h2><button onClick={() => setShowClientsModal(false)} className="text-white">X</button></div>
        <div className="bg-gray-700 p-4 rounded-xl mb-4 flex justify-between"><span className="text-white font-bold">Total</span><span className="text-2xl font-bold text-white">{clientInfo.stops.reduce((s, i) => s + i.money, 0)} MT</span></div>
        {clientInfo.stops.map((s, i) => <div key={i} className="bg-gray-800 p-4 rounded-xl mb-2 flex justify-between"><span className="text-white">{s.stopName}</span><span className="text-white">{s.money} MT</span></div>)}
      </div></div>}

      {showRideInfoModal && <div className="fixed inset-0 bg-black/70 z-30 flex items-end"><div className="bg-gray-900 w-full rounded-t-2xl p-6 max-h-[70vh] overflow-y-auto">
        <div className="flex justify-between mb-4"><h2 className="text-xl font-bold text-white">Info</h2><button onClick={() => setShowRideInfoModal(false)} className="text-white">X</button></div>
        <div className="bg-gray-800 p-4 rounded-xl mb-2 flex justify-between"><span className="text-gray-400">Tempo</span><span className="text-white">{formatTime(rideTime)}</span></div>
        <div className="bg-gray-800 p-4 rounded-xl mb-2 flex justify-between"><span className="text-gray-400">Velocidade</span><span className="text-white">{speed} km/h</span></div>
      </div></div>}
    </div>
  );
}