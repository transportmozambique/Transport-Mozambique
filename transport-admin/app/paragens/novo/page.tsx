"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Via {
  id: string;
  nome: string;
  codigo: string;
  geoLocationPath: string;
  cor?: string;
}

export default function NovaParagem() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const viasRef = useRef<Via[]>([]); // Store vias in a ref to avoid closure issues
  
  const [formData, setFormData] = useState({
    nome: "",
    codigo: "",
    latitude: "",
    longitude: "",
    viaIds: [] as string[],
    isTerminal: false,
  });
  
  const [allVias, setAllVias] = useState<Via[]>([]);
  const [filteredVias, setFilteredVias] = useState<Via[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    fetchVias();
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    
    initializeMap();
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Add routes to map when vias are loaded
  useEffect(() => {
    if (!mapInstanceRef.current || allVias.length === 0) return;
    
    const map = mapInstanceRef.current;
    
    // Wait for map to be loaded
    if (!map.isStyleLoaded()) {
      map.once('load', () => addRoutesToMap(map));
    } else {
      addRoutesToMap(map);
    }
  }, [allVias]);

  function addRoutesToMap(map: maplibregl.Map) {
    const vias = viasRef.current;
    vias.forEach((via) => {
      if (!via.geoLocationPath) return;

      try {
        const sourceId = `route-${via.id}`;
        const layerId = `route-layer-${via.id}`;

        if (map.getSource(sourceId)) return;

        const coordinates = via.geoLocationPath.split(';').map(point => {
          const [lng, lat] = point.trim().split(',').map(Number);
          return [lng, lat];
        }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

        if (coordinates.length < 2) return;

        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            }
          }
        });

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': via.cor || '#3B82F6',
            'line-width': 3,
            'line-opacity': 0.6
          }
        });
      } catch (error) {
        // Silent error
      }
    });
  }

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  async function fetchVias() {
    try {
      const response = await fetch('/api/vias?limit=1000');
      const result = await response.json();
      
      // Handle both array and paginated response formats
      const data = Array.isArray(result) ? result : (result.data || []);
      
      setAllVias(data);
      viasRef.current = data;
      setFilteredVias([]);
      
      const viasWithPath = data.filter((v: Via) => v.geoLocationPath).length;
      const debugMsg = `Carregadas ${data.length} vias, ${viasWithPath} com geoLocationPath`;
      setDebugInfo(debugMsg);
    } catch (error) {
      console.error('Erro ao carregar vias:', error);
      showNotification('Erro ao carregar vias', 'error');
    }
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

  // Check if a point is near a route path
  function isPointNearRoute(lat: number, lng: number, geoLocationPath: string, threshold: number = 7): boolean {
    if (!geoLocationPath) {
      return false;
    }

    try {
      const points = geoLocationPath.split(';').map(point => {
        const coords = point.trim().split(',');
        if (coords.length !== 2) return null;
        const [pLng, pLat] = coords.map(Number);
        if (isNaN(pLat) || isNaN(pLng)) return null;
        return { lat: pLat, lng: pLng };
      }).filter(p => p !== null);

      if (points.length === 0) {
        return false;
      }

      let minDistance = Infinity;
      for (const point of points) {
        if (!point) continue;
        const distance = calculateDistance(lat, lng, point.lat, point.lng);
        minDistance = Math.min(minDistance, distance);
        if (distance <= threshold) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // Filter vias based on clicked location
  function filterViasByLocation(lat: number, lng: number) {
    const vias = viasRef.current;
    
    if (vias.length === 0) {
      showNotification('Erro: Nenhuma via carregada. Recarregue a página.', 'error');
      return;
    }

    const results: Array<{via: Via, minDistance: number}> = [];

    vias.forEach(via => {
      if (!via.geoLocationPath) {
        return;
      }

      try {
        const points = via.geoLocationPath.split(';').map(point => {
          const coords = point.trim().split(',');
          if (coords.length !== 2) return null;
          const [pLng, pLat] = coords.map(Number);
          if (isNaN(pLat) || isNaN(pLng)) return null;
          return { lat: pLat, lng: pLng };
        }).filter(p => p !== null);

        if (points.length === 0) {
          return;
        }

        let minDistance = Infinity;
        for (const point of points) {
          if (!point) continue;
          const distance = calculateDistance(lat, lng, point.lat, point.lng);
          minDistance = Math.min(minDistance, distance);
        }

        results.push({ via, minDistance });
      } catch (error) {
        // Silent error
      }
    });

    results.sort((a, b) => a.minDistance - b.minDistance);
    
    const nearby = results.filter(r => r.minDistance <= 100).map(r => r.via);
    
    setFilteredVias(nearby);
    
    if (nearby.length === 0) {
      const closest = results[0];
      showNotification(
        `Nenhuma via encontrada (raio de 100m). Via mais próxima: ${closest.via.nome} (${closest.minDistance.toFixed(0)}m)`, 
        'info'
      );
    } else {
      showNotification(
        `${nearby.length} via${nearby.length !== 1 ? 's' : ''} encontrada${nearby.length !== 1 ? 's' : ''} (mais próxima: ${results[0].minDistance.toFixed(1)}m)`, 
        'success'
      );
    }
  }

  function initializeMap() {
    if (!mapRef.current) return;

    // Initialize MapLibre map
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [32.83, -26.85], // Ponta do Ouro area where we know there are vias
      zoom: 12,
      pitch: 60,
      bearing: 0,
    });

    mapInstanceRef.current = map;

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      // Add 3D buildings
      const layers = map.getStyle().layers;
      let firstSymbolId;
      for (const layer of layers) {
        if (layer.type === 'symbol') {
          firstSymbolId = layer.id;
          break;
        }
      }

      if (!map.getSource('openmaptiles')) {
        map.addSource('openmaptiles', {
          'type': 'vector',
          'url': 'https://tiles.openfreemap.org/planet'
        });
      }

      // Add 3D buildings layer
      if (!map.getLayer('3d-buildings')) {
        map.addLayer(
          {
            'id': '3d-buildings',
            'source': 'openmaptiles',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
              'fill-extrusion-color': '#d1d5db',
              'fill-extrusion-height': [
                'case',
                ['has', 'render_height'],
                ['get', 'render_height'],
                5
              ],
              'fill-extrusion-base': [
                'case',
                ['has', 'render_min_height'],
                ['get', 'render_min_height'],
                0
              ],
              'fill-extrusion-opacity': 0.8
            }
          },
          firstSymbolId
        );
      }
    });

    // Add click handler to place marker
    map.on('click', (e) => {
      const { lat, lng } = e.lngLat;
      
      // Update form data
      setFormData(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
        viaIds: [], // Reset selected vias when location changes
      }));

      // Filter vias by location
      filterViasByLocation(lat, lng);

      // Remove existing marker if any
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // Create custom marker element
      const el = document.createElement("div");
      el.style.cssText = `
        width: 14px;
        height: 14px;
        background: #6b7280;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      `;

      // Add new marker
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 15 }).setHTML(
            '<strong style="color: black;">Nova Paragem</strong>'
          )
        )
        .addTo(map);

      marker.togglePopup();
      markerRef.current = marker;
    });
  }

  const handleViaToggle = (viaId: string) => {
    setFormData(prev => ({
      ...prev,
      viaIds: prev.viaIds.includes(viaId)
        ? prev.viaIds.filter(id => id !== viaId)
        : [...prev.viaIds, viaId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.nome.trim()) {
      showNotification('Por favor, insira o nome da paragem', 'error');
      return;
    }
    
    if (!formData.codigo.trim()) {
      showNotification('Por favor, insira o código da paragem', 'error');
      return;
    }
    
    if (!formData.latitude || !formData.longitude) {
      showNotification('Por favor, clique no mapa para selecionar a localização', 'error');
      return;
    }

    if (formData.viaIds.length === 0) {
      showNotification('Por favor, selecione pelo menos uma via', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/paragens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          codigo: formData.codigo.trim(),
          geoLocation: `${formData.latitude},${formData.longitude}`,
          viaIds: formData.viaIds,
          isTerminal: formData.isTerminal,
        }),
      });

      if (response.ok) {
        showNotification('Paragem criada com sucesso!', 'success');
        setTimeout(() => {
          router.push('/paragens');
        }, 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao criar paragem', 'error');
      }
    } catch (error) {
      console.error('Erro ao criar paragem:', error);
      showNotification('Erro ao criar paragem', 'error');
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
              {notification.type === 'info' && (
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            onClick={() => router.push('/paragens')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-900">Nova Paragem</h2>
            <p className="text-gray-600 mt-1">Criar uma nova paragem no sistema</p>
          </div>
          {debugInfo && (
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <p className="text-xs text-gray-600 font-mono">{debugInfo}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form Fields - Left Side */}
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Informações Básicas</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Nome da Paragem *
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: Praça dos Heróis"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Código *
                    </label>
                    <input
                      type="text"
                      value={formData.codigo}
                      onChange={(e) => setFormData({...formData, codigo: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-mono"
                      placeholder="Ex: PAR-001"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="isTerminal"
                      checked={formData.isTerminal}
                      onChange={(e) => setFormData({...formData, isTerminal: e.target.checked})}
                      className="w-5 h-5 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                    <label htmlFor="isTerminal" className="text-sm font-medium text-gray-900">
                      Esta paragem é um terminal
                    </label>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Localização</h3>
                
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-blue-800">
                        Clique no mapa à direita para selecionar a localização da paragem
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Latitude
                      </label>
                      <input
                        type="text"
                        value={formData.latitude}
                        onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-mono"
                        placeholder="-25.9655"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Longitude
                      </label>
                      <input
                        type="text"
                        value={formData.longitude}
                        onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-mono"
                        placeholder="32.5892"
                        readOnly
                      />
                    </div>
                  </div>

                  {formData.latitude && formData.longitude && (
                    <button
                      type="button"
                      onClick={() => filterViasByLocation(parseFloat(formData.latitude), parseFloat(formData.longitude))}
                      className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-sm font-medium"
                    >
                      🔍 Testar Filtro de Vias (ver console)
                    </button>
                  )}
                </div>
              </div>

              {/* Vias */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Vias Associadas *</h3>
                  {filteredVias.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.viaIds.length === filteredVias.length) {
                          // Deselect all
                          setFormData(prev => ({ ...prev, viaIds: [] }));
                        } else {
                          // Select all
                          setFormData(prev => ({ ...prev, viaIds: filteredVias.map(v => v.id) }));
                        }
                      }}
                      className="text-xs font-medium text-gray-900 hover:text-gray-700 px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {formData.viaIds.length === filteredVias.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </button>
                  )}
                </div>
                
                {!formData.latitude || !formData.longitude ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-gray-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-sm text-gray-600">
                        Clique no mapa para selecionar uma localização. As vias disponíveis nessa área serão mostradas aqui.
                      </p>
                    </div>
                  </div>
                ) : filteredVias.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-sm text-yellow-800">
                        Nenhuma via encontrada nesta localização. Tente clicar mais perto de uma rota existente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {filteredVias.map((via) => (
                        <div
                          key={via.id}
                          onClick={() => handleViaToggle(via.id)}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                            formData.viaIds.includes(via.id)
                              ? 'border-gray-900 bg-gray-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={formData.viaIds.includes(via.id)}
                              onChange={() => {}}
                              className="w-5 h-5 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                            />
                            <div>
                              <p className="font-medium text-gray-900">{via.nome}</p>
                              <p className="text-xs text-gray-600 font-mono">{via.codigo}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {formData.viaIds.length > 0 && (
                      <p className="text-sm text-gray-600 mt-3">
                        {formData.viaIds.length} via{formData.viaIds.length !== 1 ? 's' : ''} selecionada{formData.viaIds.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Map - Right Side */}
            <div className="lg:sticky lg:top-6 h-fit">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Selecionar Localização</h3>
                  <p className="text-sm text-gray-600">Clique no mapa para marcar a posição da paragem</p>
                </div>
                <div 
                  ref={mapRef}
                  className="h-[600px]"
                  style={{ zIndex: 0 }}
                ></div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.push('/paragens')}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Criar Paragem</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
