"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function NovaVia() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routedPath, setRoutedPath] = useState<[number, number][]>([]); // Road-following path
  const [municipios, setMunicipios] = useState<any[]>([]);
  const [allParagens, setAllParagens] = useState<any[]>([]);
  const [nearbyParagens, setNearbyParagens] = useState<any[]>([]);
  const [selectedParagensIds, setSelectedParagensIds] = useState<string[]>([]);
  const [useParagens, setUseParagens] = useState(false); // Toggle between manual and paragens mode - default to Manual
  const paragensMarkersRef = useRef<maplibregl.Marker[]>([]);
  
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    cor: '#3B82F6',
    terminalPartida: '',
    terminalChegada: '',
    municipioId: '',
  });

  useEffect(() => {
    fetchMunicipios();
    fetchParagens();
  }, []);

  // Fetch road-following route when coordinates change
  useEffect(() => {
    if (routeCoordinates.length < 2) {
      setRoutedPath([]);
      return;
    }

    async function fetchRoute() {
      try {
        // Build OSRM API URL with all coordinates
        const coords = routeCoordinates.map(c => `${c[0]},${c[1]}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          const routeGeometry = data.routes[0].geometry.coordinates;
          setRoutedPath(routeGeometry);
        } else {
          // Fallback to straight lines if routing fails
          setRoutedPath(routeCoordinates);
        }
      } catch (error) {
        console.error('Error fetching route:', error);
        // Fallback to straight lines if routing fails
        setRoutedPath(routeCoordinates);
      }
    }

    fetchRoute();
  }, [routeCoordinates]);

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
        // Suppress tile loading errors from console
        if (e.error?.message?.includes('Failed to fetch') || e.error?.message?.includes('tile')) {
          // Silently ignore tile loading errors
          return;
        }
        console.error('Map error:', e);
      });

      // Add 3D buildings
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

        // Add paragens to map after it's loaded
        if (allParagens.length > 0) {
          addParagensToMap(allParagens);
        }
      });

      // Click to add route points
      map.current.on('click', (e) => {
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setRouteCoordinates(prev => [...prev, coords]);
        
        // Create custom marker element
        const el = document.createElement("div");
        el.style.cssText = `
          width: 14px;
          height: 14px;
          background: ${formData.cor};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        `;
        
        // Add marker
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(coords)
          .addTo(map.current!);
        
        // Store marker reference
        markersRef.current.push(marker);
      });
    };

    // Delay map initialization to ensure container is rendered
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(initMap);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      map.current?.remove();
    };
  }, []);

  // Update route line when routed path changes
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    if (routedPath.length < 2) {
      // Remove route if no path
      if (map.current.getLayer('route')) {
        map.current.removeLayer('route');
        map.current.removeSource('route');
      }
      return;
    }

    if (map.current.getSource('route')) {
      (map.current.getSource('route') as maplibregl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routedPath,
        },
      });
    } else {
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routedPath,
          },
        },
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': formData.cor,
          'line-width': 4,
        },
      });
    }
  }, [routedPath, formData.cor]);

  // Update marker colors when color changes
  useEffect(() => {
    markersRef.current.forEach(marker => {
      const el = marker.getElement();
      if (el) {
        el.style.background = formData.cor;
      }
    });
  }, [formData.cor]);

  async function fetchMunicipios() {
    try {
      console.log('Fetching municipios from /api/municipios');
      // Fetch all municipios for the dropdown (no pagination needed)
      const response = await fetch('/api/municipios?limit=1000');
      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          console.error('Parsed error data:', errorData);
          throw new Error(errorData.details || errorData.error || 'Failed to fetch municipios');
        } catch (parseError) {
          throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        }
      }
      
      const result = await response.json();
      console.log('Municipios result:', result);
      setMunicipios(result.data || []);
    } catch (error) {
      console.error('Erro ao carregar municípios:', error);
      showNotification(
        error instanceof Error ? error.message : 'Erro ao carregar municípios',
        'error'
      );
    }
  }

  async function fetchParagens() {
    try {
      const response = await fetch('/api/paragens?limit=1000');
      if (!response.ok) {
        throw new Error('Failed to fetch paragens');
      }
      const result = await response.json();
      const paragens = result.data || [];
      setAllParagens(paragens);
      
      // Add paragens to map if map is ready
      if (map.current && map.current.isStyleLoaded()) {
        addParagensToMap(paragens);
      }
    } catch (error) {
      console.error('Erro ao carregar paragens:', error);
    }
  }

  function addParagensToMap(paragens: any[]) {
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    // Clear existing paragens markers
    paragensMarkersRef.current.forEach(marker => marker.remove());
    paragensMarkersRef.current = [];
    
    paragens.forEach(paragem => {
      if (!paragem.geoLocation) return;
      
      const [lat, lng] = paragem.geoLocation.split(',').map(Number);
      if (isNaN(lng) || isNaN(lat)) return;
      
      // Create custom marker element for paragem
      const el = document.createElement("div");
      el.style.cssText = `
        width: 10px;
        height: 10px;
        background: #6b7280;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 10 }).setHTML(
            `<div style="color: black; font-size: 12px;"><strong>${paragem.nome}</strong><br/><span style="font-family: monospace; font-size: 10px;">${paragem.codigo}</span></div>`
          )
        )
        .addTo(map.current!);
      
      paragensMarkersRef.current.push(marker);
    });
  }

  // Calculate distance between two points using Haversine formula
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Check if a paragem is near the route
  function isParagemNearRoute(paragem: any, routePath: [number, number][], threshold: number = 50): number {
    if (!paragem.geoLocation || routePath.length === 0) return Infinity;
    
    const [lat, lng] = paragem.geoLocation.split(',').map(Number);
    if (isNaN(lng) || isNaN(lat)) return Infinity;
    
    let minDistance = Infinity;
    for (const [routeLng, routeLat] of routePath) {
      const distance = calculateDistance(lat, lng, routeLat, routeLng);
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
  }

  // Add paragens to map when they're loaded and map is ready
  useEffect(() => {
    if (allParagens.length > 0 && map.current && map.current.isStyleLoaded()) {
      addParagensToMap(allParagens);
    }
  }, [allParagens]);

  // Update nearby paragens when route changes
  useEffect(() => {
    if (routedPath.length < 2) {
      setNearbyParagens([]);
      setSelectedParagensIds([]);
      return;
    }
    
    console.log('Checking nearby paragens for route with', routedPath.length, 'points');
    console.log('Total paragens to check:', allParagens.length);
    
    const results = allParagens.map(paragem => ({
      paragem,
      distance: isParagemNearRoute(paragem, routedPath, 50)
    })).filter(r => r.distance <= 50)
      .sort((a, b) => a.distance - b.distance);
    
    console.log('Found', results.length, 'nearby paragens');
    if (results.length > 0) {
      console.log('Closest paragem:', results[0].paragem.nome, 'at', results[0].distance.toFixed(1), 'm');
    }
    
    const nearbyParagensList = results.map(r => r.paragem);
    setNearbyParagens(nearbyParagensList);
    
    // Auto-select all nearby paragens
    setSelectedParagensIds(nearbyParagensList.map(p => p.id));
    
    // Highlight nearby paragens on map
    paragensMarkersRef.current.forEach((marker, index) => {
      const paragem = allParagens[index];
      if (!paragem) return;
      
      const el = marker.getElement();
      const isNearby = results.some(r => r.paragem.id === paragem.id);
      
      if (isNearby) {
        el.style.background = formData.cor;
        el.style.width = '12px';
        el.style.height = '12px';
        el.style.border = '3px solid white';
      } else {
        el.style.background = '#6b7280';
        el.style.width = '10px';
        el.style.height = '10px';
        el.style.border = '2px solid white';
      }
    });
  }, [routedPath, allParagens, formData.cor]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleClearRoute = () => {
    setRouteCoordinates([]);
    
    // Remove all markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    if (map.current) {
      // Remove route layer
      if (map.current.getLayer('route')) {
        map.current.removeLayer('route');
        map.current.removeSource('route');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.codigo || !formData.municipioId) {
      showNotification('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    if (routeCoordinates.length < 2) {
      showNotification('Desenhe a rota no mapa (clique para adicionar pontos)', 'error');
      return;
    }

    setLoading(true);
    try {
      // Save the routed path (follows roads) instead of just the clicked points
      const geoLocationPath = JSON.stringify(routedPath.length > 0 ? routedPath : routeCoordinates);
      
      console.log('Creating via with data:', {
        ...formData,
        geoLocationPath: geoLocationPath.substring(0, 100) + '...',
        routePointsCount: routedPath.length || routeCoordinates.length,
        paragensIds: selectedParagensIds,
      });
      
      const response = await fetch('/api/vias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          geoLocationPath,
          paragensIds: selectedParagensIds,
        }),
      });

      console.log('Response status:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('Via created successfully:', result);
        showNotification('Via criada com sucesso!', 'success');
        setTimeout(() => router.push('/vias'), 1500);
      } else {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        try {
          const error = JSON.parse(errorText);
          console.error('Parsed error:', error);
          showNotification(error.details || error.error || 'Erro ao criar via', 'error');
        } catch (parseError) {
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Informações da Via</h3>
              <div className="flex items-center space-x-2">
                <span className={`text-xs font-medium ${!useParagens ? 'text-gray-900' : 'text-gray-500'}`}>
                  Manual
                </span>
                <button
                  type="button"
                  onClick={() => setUseParagens(!useParagens)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useParagens ? 'bg-gray-900' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useParagens ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-xs font-medium ${useParagens ? 'text-gray-900' : 'text-gray-500'}`}>
                  Paragens
                </span>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Show basic fields only in Manual mode */}
              {!useParagens && (
                <>
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
                </>
              )}

              {/* Terminal Fields or Paragens List */}
              {!useParagens ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Terminal de Partida *
                    </label>
                    <input
                      type="text"
                      value={formData.terminalPartida}
                      onChange={(e) => setFormData({ ...formData, terminalPartida: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: Terminal Central"
                      required
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
                      placeholder="Ex: Terminal Norte"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Paragens List - Only show in Paragens mode when there are nearby paragens */}
                  {nearbyParagens.length > 0 && (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900">
                          Paragens da Rota ({nearbyParagens.length})
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedParagensIds.length === nearbyParagens.length) {
                              setSelectedParagensIds([]);
                            } else {
                              setSelectedParagensIds(nearbyParagens.map(p => p.id));
                            }
                          }}
                          className="text-xs font-medium text-gray-900 hover:text-gray-700 px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          {selectedParagensIds.length === nearbyParagens.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {nearbyParagens.map((paragem) => (
                          <div
                            key={paragem.id}
                            onClick={() => {
                              setSelectedParagensIds(prev =>
                                prev.includes(paragem.id)
                                  ? prev.filter(id => id !== paragem.id)
                                  : [...prev, paragem.id]
                              );
                            }}
                            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                              selectedParagensIds.includes(paragem.id)
                                ? 'border-gray-900 bg-gray-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={selectedParagensIds.includes(paragem.id)}
                                onChange={() => {}}
                                className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                              />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{paragem.nome}</p>
                                <p className="text-xs text-gray-600 font-mono">{paragem.codigo}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedParagensIds.length > 0 && (
                        <p className="text-xs text-gray-600 mt-3">
                          {selectedParagensIds.length} paragem{selectedParagensIds.length !== 1 ? 'ns' : ''} selecionada{selectedParagensIds.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  )}
                </>
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

              <div className="pt-4 space-y-3">
                <button
                  type="button"
                  onClick={handleClearRoute}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-900"
                >
                  Limpar Rota
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Via'}
                </button>
              </div>

              <p className="text-xs text-gray-600">
                * Campos obrigatórios. Clique no mapa para desenhar a rota.
              </p>
              <p className="text-xs text-gray-600">
                Pontos na rota: {routeCoordinates.length}
              </p>
              {nearbyParagens.length > 0 && (
                <p className="text-xs text-gray-600">
                  Paragens próximas: {nearbyParagens.length}
                </p>
              )}
            </form>
          </div>

          {/* Map */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Desenhar Rota no Mapa</h3>
              <p className="text-sm text-gray-600 mt-1">Clique no mapa para adicionar pontos à rota</p>
            </div>
            <div ref={mapContainer} className="w-full h-[600px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
