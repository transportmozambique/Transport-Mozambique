"use client";

import { useState, useEffect, useMemo, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { orderStopsAlongRoute } from "@/lib/routeOrder";

type Point = [number, number]; // [lng, lat]

interface Municipio {
  id: string;
  nome: string;
}

interface Paragem {
  id: string;
  nome: string;
  codigo: string;
  geoLocation: string | null; // "lat,lng"
}

// The points clicked on the map, with undo/redo history (every change can be undone, also "Limpar")
interface Drawing {
  points: Point[];
  past: Point[][];
  future: Point[][];
}

type DrawAction =
  | { type: 'add'; point: Point }
  | { type: 'move'; index: number; point: Point }
  | { type: 'remove'; index: number }
  | { type: 'clear' }
  | { type: 'undo' }
  | { type: 'redo' };

function drawingReducer(s: Drawing, a: DrawAction): Drawing {
  const commit = (points: Point[]): Drawing => ({ points, past: [...s.past, s.points], future: [] });
  switch (a.type) {
    case 'add':
      return commit([...s.points, a.point]);
    case 'move':
      return commit(s.points.map((p, i) => (i === a.index ? a.point : p)));
    case 'remove':
      return commit(s.points.filter((_, i) => i !== a.index));
    case 'clear':
      return s.points.length ? commit([]) : s;
    case 'undo':
      return s.past.length
        ? { points: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.points, ...s.future] }
        : s;
    case 'redo':
      return s.future.length
        ? { points: s.future[0], past: [...s.past, s.points], future: s.future.slice(1) }
        : s;
  }
}

const NEAR_ROUTE_M = 50;

function parseLatLng(geo: string | null): [number, number] | null {
  const [lat, lng] = (geo || '').split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

// Distance in metres from a stop to the closest vertex of a road path (OSRM paths are dense)
function distanceToPath([lat, lng]: [number, number], path: Point[]): number {
  const k = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const [pLng, pLat] of path) {
    const dLat = pLat - lat;
    const dLng = (pLng - lng) * k;
    best = Math.min(best, dLat * dLat + dLng * dLng);
  }
  return Math.sqrt(best) * 111320;
}

export default function NovaVia() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const pointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const paragemMarkersRef = useRef(new Map<string, maplibregl.Marker>());
  const [drawing, dispatch] = useReducer(drawingReducer, { points: [], past: [], future: [] });
  const [route, setRoute] = useState<{ key: string; path: Point[]; failed: boolean } | null>(null);
  const [routeAttempt, setRouteAttempt] = useState(0); // "Tentar de novo" asks OSRM again
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [allParagens, setAllParagens] = useState<Paragem[]>([]);
  const [excludedParagens, setExcludedParagens] = useState<string[]>([]); // stops near the route the user unticked

  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    cor: '#3B82F6',
    terminalPartida: '',
    terminalChegada: '',
    municipioId: '',
  });

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    fetch('/api/municipios?limit=1000')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((result) => setMunicipios(result.data || []))
      .catch((error) => {
        console.error('Erro ao carregar municípios:', error);
        setNotification({ message: 'Erro ao carregar municípios', type: 'error' });
      });
    // Every stop (there are more than 1000)
    fetch('/api/paragens?limit=10000')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((result) => setAllParagens(result.data || []))
      .catch((error) => console.error('Erro ao carregar paragens:', error));
  }, []);

  // Road-following path for the clicked points. Each answer is tied to the points it was asked
  // for, so a slow answer for older points never replaces the path of the current ones.
  const pointsKey = drawing.points.map(([lng, lat]) => `${lng},${lat}`).join(';');
  useEffect(() => {
    const points = pointsKey ? pointsKey.split(';').map((p) => p.split(',').map(Number) as Point) : [];
    if (points.length < 2) return;
    let cancelled = false;
    fetch(`https://router.project-osrm.org/route/v1/driving/${pointsKey}?overview=full&geometries=geojson`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.code === 'Ok' && data.routes?.[0]) {
          setRoute({ key: pointsKey, path: data.routes[0].geometry.coordinates, failed: false });
        } else {
          setRoute({ key: pointsKey, path: points, failed: true });
        }
      })
      .catch((error) => {
        console.error('Error fetching route:', error);
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

  // Stops close to the route, in travel order
  const nearbyParagens = useMemo(() => {
    if (routedPath.length < 2) return [];
    const near = allParagens.filter((p) => {
      const at = parseLatLng(p.geoLocation);
      return at !== null && distanceToPath(at, routedPath) <= NEAR_ROUTE_M;
    });
    const stored = routedPath.map(([lng, lat]) => `${lng},${lat}`).join(';');
    return orderStopsAlongRoute(near, stored, (p) => p.geoLocation);
  }, [routedPath, allParagens]);
  const selectedParagens = nearbyParagens.filter((p) => !excludedParagens.includes(p.id));
  const terminalPartida = formData.terminalPartida.trim() || selectedParagens[0]?.nome || '';
  const terminalChegada = formData.terminalChegada.trim() || selectedParagens[selectedParagens.length - 1]?.nome || '';

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Use requestAnimationFrame to ensure the container is fully rendered
    const initMap = () => {
      if (!mapContainer.current) return;

      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
              maxzoom: 19, // Limit max zoom to prevent tile loading errors
            },
          },
          layers: [
            {
              id: 'osm-tiles',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [32.5892, -25.9655], // Maputo
        zoom: 12,
        pitch: 60,
        maxZoom: 19, // Prevent zooming beyond tile availability
      });

      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Handle tile loading errors gracefully
      map.current.on('error', (e) => {
        if (e.error?.message?.includes('Failed to fetch') || e.error?.message?.includes('tile')) {
          return;
        }
        console.error('Map error:', e);
      });

      map.current.on('load', () => {
        if (!map.current) return;

        map.current.addSource('openmaptiles', {
          type: 'vector',
          url: 'https://api.maptiler.com/tiles/v3/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
        });

        map.current.addLayer({
          id: '3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 15,
          paint: {
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': ['get', 'render_height'],
            'fill-extrusion-base': ['get', 'render_min_height'],
            'fill-extrusion-opacity': 0.6,
          },
        });

        setMapReady(true);
      });

      // Click to add a route point
      map.current.on('click', (e) => {
        dispatch({ type: 'add', point: [e.lngLat.lng, e.lngLat.lat] });
      });
    };

    // Delay map initialization to ensure container is rendered
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(initMap);
    }, 100);

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
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'undo' });
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        dispatch({ type: 'redo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Numbered markers for the clicked points: drag one to move it, click one to remove it
  useEffect(() => {
    const m = map.current;
    pointMarkersRef.current.forEach((marker) => marker.remove());
    pointMarkersRef.current = [];
    if (!m || !mapReady) return;

    drawing.points.forEach((point, index) => {
      const el = document.createElement('div');
      el.textContent = String(index + 1);
      el.title = 'Arraste para mover · clique para remover';
      el.dataset.testid = 'route-point';
      el.style.cssText = `
        min-width: 20px;
        height: 20px;
        padding: 0 4px;
        background: ${formData.cor};
        color: white;
        font: 600 11px/14px system-ui, sans-serif;
        text-align: center;
        border: 3px solid white;
        border-radius: 10px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(point).addTo(m);
      let dragged = false;
      marker.on('dragstart', () => {
        dragged = true;
      });
      marker.on('dragend', () => {
        const { lng, lat } = marker.getLngLat();
        dispatch({ type: 'move', index, point: [lng, lat] });
      });
      el.addEventListener('click', (ev) => {
        ev.stopPropagation(); // not a new point on the map
        if (dragged) {
          dragged = false;
          return;
        }
        dispatch({ type: 'remove', index });
      });
      pointMarkersRef.current.push(marker);
    });
  }, [drawing.points, formData.cor, mapReady]);

  // Road path line
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;

    if (routedPath.length < 2) {
      if (m.getLayer('route')) m.removeLayer('route');
      if (m.getSource('route')) m.removeSource('route');
      return;
    }

    const data: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routedPath } };
    const source = m.getSource('route') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
    } else {
      m.addSource('route', { type: 'geojson', data });
      // Below the 3D buildings would hide it; add it on top of the base map
      m.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': formData.cor, 'line-width': 4 },
      });
    }
    m.setPaintProperty('route', 'line-color', formData.cor);
    m.setPaintProperty('route', 'line-dasharray', routingFailed ? [2, 2] : [1, 0]);
  }, [routedPath, routingFailed, formData.cor, mapReady]);

  // Every stop on the map. Clicking one adds a route point exactly on it.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    const markers = paragemMarkersRef.current;
    markers.forEach((marker) => marker.remove());
    markers.clear();

    allParagens.forEach((paragem) => {
      const at = parseLatLng(paragem.geoLocation);
      if (!at) return;
      const [lat, lng] = at;
      const el = document.createElement('div');
      el.style.cssText = `
        width: 10px;
        height: 10px;
        background: #6b7280;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      const popup = new maplibregl.Popup({ offset: 10 });
      const box = document.createElement('div');
      box.style.cssText = 'color: black; font-size: 12px;';
      const name = document.createElement('strong');
      name.textContent = paragem.nome;
      const code = document.createElement('span');
      code.style.cssText = 'font-family: monospace; font-size: 10px;';
      code.textContent = paragem.codigo;
      box.append(name, document.createElement('br'), code);
      popup.setDOMContent(box);

      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).setPopup(popup).addTo(m);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        dispatch({ type: 'add', point: [lng, lat] });
        marker.togglePopup();
      });
      markers.set(paragem.id, marker);
    });
  }, [allParagens, mapReady]);

  // Highlight the stops along the route
  useEffect(() => {
    const nearIds = new Set(nearbyParagens.map((p) => p.id));
    paragemMarkersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      const near = nearIds.has(id);
      el.style.background = near ? formData.cor : '#6b7280';
      el.style.width = near ? '12px' : '10px';
      el.style.height = near ? '12px' : '10px';
      el.style.border = near ? '3px solid white' : '2px solid white';
    });
  }, [nearbyParagens, formData.cor, allParagens, mapReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.codigo || !formData.municipioId) {
      showNotification('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    if (!hasRoute) {
      showNotification('Desenhe a rota no mapa (clique para adicionar pontos)', 'error');
      return;
    }

    if (!routeReady) {
      showNotification('Aguarde: o percurso pelas estradas ainda está a ser calculado.', 'info');
      return;
    }

    if (routingFailed || routedPath.length < 2) {
      showNotification('Não foi possível calcular o percurso pelas estradas. Verifique a ligação e mova ou adicione um ponto.', 'error');
      return;
    }

    if (!terminalPartida || !terminalChegada) {
      showNotification('Indique os terminais de partida e de chegada', 'error');
      return;
    }

    setLoading(true);
    try {
      // Save the road-following path in the stored "lng,lat;lng,lat" format
      const geoLocationPath = routedPath.map(([lng, lat]) => `${lng},${lat}`).join(';');

      const response = await fetch('/api/vias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          terminalPartida,
          terminalChegada,
          geoLocationPath,
          paragensIds: selectedParagens.map((p) => p.id),
        }),
      });

      if (response.ok) {
        showNotification('Via criada com sucesso!', 'success');
        setTimeout(() => router.push('/vias'), 1500);
      } else {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        try {
          const error = JSON.parse(errorText);
          showNotification(error.details || error.error || 'Erro ao criar via', 'error');
        } catch {
          showNotification(`Erro ao criar via: ${response.status} ${response.statusText}`, 'error');
        }
      }
    } catch (error) {
      console.error('Exception creating via:', error);
      showNotification(
        error instanceof Error ? error.message : 'Erro ao criar via',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const routeKm = routedPath.length > 1
    ? routedPath.slice(1).reduce((sum, [lng, lat], i) => {
        const [pLng, pLat] = routedPath[i];
        const k = Math.cos((lat * Math.PI) / 180);
        return sum + Math.hypot(lat - pLat, (lng - pLng) * k) * 111.32;
      }, 0)
    : 0;

  return (
    <div className="bg-white min-h-screen">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-lg shadow-lg p-4 min-w-[300px] ${
            notification.type === 'success' ? 'bg-green-50 border border-green-200' :
            notification.type === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <p className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-green-800' :
                notification.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {notification.message}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/vias')}
            className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0"
            aria-label="Voltar às vias"
          >
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Nova Via</h2>
            <p className="text-gray-600 mt-1">Criar uma nova via no sistema</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações da Via</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Nome da Via *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  placeholder="Ex: Via Principal Centro"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  placeholder="Ex: VP-001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Município *
                </label>
                <select
                  value={formData.municipioId}
                  onChange={(e) => setFormData({ ...formData, municipioId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  required
                >
                  <option value="">Selecione um município</option>
                  {municipios.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Terminal de Partida *
                  </label>
                  <input
                    type="text"
                    value={formData.terminalPartida}
                    onChange={(e) => setFormData({ ...formData, terminalPartida: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    placeholder={selectedParagens[0] ? `${selectedParagens[0].nome} (1.ª paragem)` : 'Ex: Terminal Central'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Terminal de Chegada *
                  </label>
                  <input
                    type="text"
                    value={formData.terminalChegada}
                    onChange={(e) => setFormData({ ...formData, terminalChegada: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    placeholder={selectedParagens.length > 1 ? `${selectedParagens[selectedParagens.length - 1].nome} (última paragem)` : 'Ex: Terminal Norte'}
                  />
                </div>
              </div>
              {selectedParagens.length > 0 && (
                <p className="text-xs text-gray-600 -mt-2">Em branco: usa a primeira e a última paragem da rota.</p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Cor da Rota
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={formData.cor}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">{formData.cor}</span>
                </div>
              </div>

              {/* Stops along the drawn route, in travel order */}
              {nearbyParagens.length > 0 && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Paragens da Rota ({selectedParagens.length} de {nearbyParagens.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setExcludedParagens(
                          selectedParagens.length === nearbyParagens.length ? nearbyParagens.map((p) => p.id) : [],
                        )
                      }
                      className="text-xs font-medium text-gray-900 hover:text-gray-700 px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {selectedParagens.length === nearbyParagens.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {nearbyParagens.map((paragem, i) => {
                      const selected = !excludedParagens.includes(paragem.id);
                      return (
                        <label
                          key={paragem.id}
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all ${
                            selected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              setExcludedParagens((prev) =>
                                prev.includes(paragem.id) ? prev.filter((id) => id !== paragem.id) : [...prev, paragem.id],
                              )
                            }
                            className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                          />
                          <span className="text-xs text-gray-500 w-5 text-right">{i + 1}</span>
                          <span>
                            <span className="block text-sm font-medium text-gray-900">{paragem.nome}</span>
                            <span className="block text-xs text-gray-600 font-mono">{paragem.codigo}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-700" data-testid="route-counts">
                  <span>Pontos na rota: <strong className="text-gray-900">{drawing.points.length}</strong></span>
                  <span>Paragens próximas: <strong className="text-gray-900">{nearbyParagens.length}</strong></span>
                </div>
                <p className="text-xs text-gray-600">
                  * Campos obrigatórios. Clique no mapa para desenhar a rota.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Via'}
                </button>
              </div>
            </form>
          </div>

          {/* Map */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Desenhar Rota no Mapa</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Clique no mapa ou numa paragem para adicionar um ponto. Arraste um ponto para o mover; clique nele para o remover.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'undo' })}
                    disabled={!drawing.past.length}
                    title="Desfazer (Ctrl+Z)"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ↶ Desfazer
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'redo' })}
                    disabled={!drawing.future.length}
                    title="Refazer (Ctrl+Y)"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ↷ Refazer
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'clear' })}
                    disabled={!drawing.points.length}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Limpar Rota
                  </button>
                </div>
              </div>
              <p className={`text-xs ${routingFailed ? 'text-red-700' : 'text-gray-600'}`} data-testid="route-status">
                {!hasRoute && 'Adicione pelo menos dois pontos.'}
                {hasRoute && !routeReady && 'A calcular o percurso pelas estradas…'}
                {routeReady && !routingFailed && `Percurso pelas estradas: ${routeKm.toFixed(1)} km`}
                {routingFailed && 'Não foi possível calcular o percurso pelas estradas (linha tracejada). '}
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
            <div ref={mapContainer} className="w-full h-[600px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
