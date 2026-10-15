"use client";
import LoadingScreen from "../../../components/LoadingScreen";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Via {
  id: string;
  nome: string;
  codigo: string;
  geoLocationPath: string;
  cor?: string;
}

interface Paragem {
  id: string;
  nome: string;
  codigo: string;
  geoLocation: string;
  vias: Array<{
    via: Via;
    terminalBoolean: boolean;
  }>;
}

export default function EditarParagem() {
  const router = useRouter();
  const params = useParams();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  
  const [paragem, setParagem] = useState<Paragem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [allVias, setAllVias] = useState<Via[]>([]);
  const [nearbyVias, setNearbyVias] = useState<Via[]>([]);
  const [formData, setFormData] = useState({
    nome: "",
    codigo: "",
    latitude: "",
    longitude: "",
    viaIds: [] as string[],
  });

  useEffect(() => {
    if (params.id) {
      fetchParagem(params.id as string);
      fetchVias();
    }
  }, [params.id]);

  useEffect(() => {
    if (paragem && !mapInstanceRef.current && mapRef.current) {
      initializeMap();
    }
  }, [paragem, nearbyVias]);

  // Add via routes when nearbyVias changes and map is already loaded
  useEffect(() => {
    if (!mapInstanceRef.current || nearbyVias.length === 0) return;
    
    const map = mapInstanceRef.current;
    
    // Wait for map to be loaded
    if (!map.loaded()) {
      map.once('load', () => addViaRoutes(map));
    } else {
      addViaRoutes(map);
    }
  }, [nearbyVias]);

  function addViaRoutes(map: maplibregl.Map) {
    nearbyVias.forEach((via) => {
      if (!via.geoLocationPath) return;

      try {
        let coordinates: [number, number][] = [];
        
        // Try parsing as JSON first
        try {
          const parsed = JSON.parse(via.geoLocationPath);
          if (Array.isArray(parsed)) {
            coordinates = parsed;
          }
        } catch {
          // If not JSON, try semicolon-separated format
          coordinates = via.geoLocationPath
            .split(';')
            .map(coord => {
              const [lng, lat] = coord.split(',').map(Number);
              return [lng, lat] as [number, number];
            })
            .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
        }

        if (coordinates.length < 2) return;

        const sourceId = `route-${via.id}`;
        const layerId = `route-layer-${via.id}`;

        // Remove existing source/layer if present
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }

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
            'line-width': 4,
            'line-opacity': 0.7
          }
        });
      } catch (error) {
        console.error('Error adding via route:', error);
      }
    });
  }

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  async function fetchParagem(id: string) {
    try {
      const response = await fetch(`/api/paragens/${id}`);
      
      if (!response.ok) {
        throw new Error('Paragem não encontrada');
      }
      
      const data = await response.json();
      setParagem(data);
      
      // Parse coordinates
      const coords = data.geoLocation.split(',');
      
      setFormData({
        nome: data.nome,
        codigo: data.codigo,
        latitude: coords[0]?.trim() || '',
        longitude: coords[1]?.trim() || '',
        viaIds: data.vias.map((v: any) => v.via.id),
      });
    } catch (error) {
      console.error('Erro ao carregar paragem:', error);
      showNotification('Erro ao carregar paragem', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchVias() {
    try {
      const response = await fetch('/api/vias?limit=1000');
      const result = await response.json();
      // Handle both array and paginated response formats
      const data = Array.isArray(result) ? result : (result.data || []);
      setAllVias(data);
      
      // Calculate nearby vias after loading
      if (paragem) {
        calculateNearbyVias(paragem.geoLocation, data);
      }
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
  function isPointNearRoute(lat: number, lng: number, geoLocationPath: string, threshold: number = 100): boolean {
    if (!geoLocationPath) return false;

    try {
      let coordinates: [number, number][] = [];
      
      // Try parsing as JSON first
      try {
        const parsed = JSON.parse(geoLocationPath);
        if (Array.isArray(parsed)) {
          coordinates = parsed;
        }
      } catch {
        // If not JSON, try semicolon-separated format
        coordinates = geoLocationPath
          .split(';')
          .map(coord => {
            const [pLng, pLat] = coord.split(',').map(Number);
            return [pLng, pLat] as [number, number];
          })
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
      }

      if (coordinates.length === 0) return false;

      // Check if any point on the route is within threshold
      for (const [routeLng, routeLat] of coordinates) {
        const distance = calculateDistance(lat, lng, routeLat, routeLng);
        if (distance <= threshold) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  function calculateNearbyVias(geoLocation: string, vias: Via[]) {
    const coords = geoLocation.split(',');
    const lat = parseFloat(coords[0]?.trim());
    const lng = parseFloat(coords[1]?.trim());

    if (isNaN(lat) || isNaN(lng)) {
      setNearbyVias([]);
      return;
    }

    const nearby = vias.filter(via => 
      via.geoLocationPath && isPointNearRoute(lat, lng, via.geoLocationPath, 100)
    );

    setNearbyVias(nearby);
  }

  // Recalculate nearby vias when location changes
  useEffect(() => {
    if (formData.latitude && formData.longitude && allVias.length > 0) {
      const geoLocation = `${formData.latitude},${formData.longitude}`;
      calculateNearbyVias(geoLocation, allVias);
    }
  }, [formData.latitude, formData.longitude, allVias]);

  function initializeMap() {
    if (!mapRef.current || !paragem) return;

    const coords = paragem.geoLocation.split(',');
    const lat = parseFloat(coords[0]?.trim());
    const lng = parseFloat(coords[1]?.trim());

    if (isNaN(lat) || isNaN(lng)) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [lng, lat],
      zoom: 15,
      pitch: 45,
      bearing: 0,
    });

    mapInstanceRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on('load', () => {
      // Add marker for paragem
      const el = document.createElement("div");
      el.style.cssText = `
        width: 18px;
        height: 18px;
        background: #6b7280;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 15 }).setHTML(
            `<strong style="color: black;">${paragem.nome}</strong>`
          )
        )
        .addTo(map);

      marker.togglePopup();
      markerRef.current = marker;

      // Add via routes if available
      if (nearbyVias.length > 0) {
        addViaRoutes(map);
      }
    });

    // Allow clicking map to update location
    map.on('click', (e) => {
      const { lat, lng } = e.lngLat;
      
      setFormData(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }));

      // Update marker
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
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
    
    if (!formData.nome.trim()) {
      showNotification('Por favor, insira o nome da paragem', 'error');
      return;
    }
    
    if (!formData.codigo.trim()) {
      showNotification('Por favor, insira o código da paragem', 'error');
      return;
    }
    
    if (!formData.latitude || !formData.longitude) {
      showNotification('Por favor, selecione a localização no mapa', 'error');
      return;
    }

    if (formData.viaIds.length === 0) {
      showNotification('Por favor, selecione pelo menos uma via', 'error');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/paragens/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          codigo: formData.codigo.trim(),
          geoLocation: `${formData.latitude},${formData.longitude}`,
          viaIds: formData.viaIds,
        }),
      });

      if (response.ok) {
        showNotification('Paragem atualizada com sucesso!', 'success');
        setTimeout(() => {
          router.push(`/paragens/${params.id}`);
        }, 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao atualizar paragem', 'error');
      }
    } catch (error) {
      console.error('Erro ao atualizar paragem:', error);
      showNotification('Erro ao atualizar paragem', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  if (!paragem) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-[1600px] mx-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Paragem Não Encontrada</h3>
            <p className="text-gray-600 mb-6">A paragem que procura não existe.</p>
            <button
              onClick={() => router.push('/paragens')}
              className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-lg font-medium"
            >
              Voltar para Paragens
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            onClick={() => router.push(`/paragens/${params.id}`)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-900">Editar Paragem</h2>
            <p className="text-gray-600 mt-1">Atualizar informações da paragem</p>
          </div>
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
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Localização</h3>
                
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Clique no mapa para atualizar a localização da paragem
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Latitude
                      </label>
                      <input
                        type="text"
                        value={formData.latitude}
                        readOnly
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Longitude
                      </label>
                      <input
                        type="text"
                        value={formData.longitude}
                        readOnly
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Vias */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Vias Associadas *</h3>
                  {nearbyVias.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.viaIds.length === nearbyVias.length) {
                          setFormData(prev => ({ ...prev, viaIds: [] }));
                        } else {
                          setFormData(prev => ({ ...prev, viaIds: nearbyVias.map(v => v.id) }));
                        }
                      }}
                      className="text-xs font-medium text-gray-900 hover:text-gray-700 px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {formData.viaIds.length === nearbyVias.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </button>
                  )}
                </div>
                
                {nearbyVias.length > 0 ? (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-blue-800">
                        Mostrando {nearbyVias.length} via{nearbyVias.length !== 1 ? 's' : ''} próxima{nearbyVias.length !== 1 ? 's' : ''} (raio de 100m)
                      </p>
                    </div>
                    
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {nearbyVias.map((via) => (
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
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-sm text-yellow-800 font-medium">Nenhuma via próxima encontrada</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Clique no mapa para atualizar a localização ou verifique se existem vias nesta área.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Map - Right Side */}
            <div className="lg:sticky lg:top-6 h-fit">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Localização no Mapa</h3>
                  <p className="text-sm text-gray-600">Clique para atualizar a posição</p>
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
              onClick={() => router.push(`/paragens/${params.id}`)}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Guardar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
