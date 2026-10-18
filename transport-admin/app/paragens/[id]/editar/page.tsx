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

  // Juntar as vias quando nearbyVias muda e o mapa já carregou
  useEffect(() => {
    if (!mapInstanceRef.current || nearbyVias.length === 0) return;
    
    const map = mapInstanceRef.current;
    
    // Esperar que o mapa carregue
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
          // Se não for JSON, tentar o formato separado por ponto e vírgula
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

        // Tirar a fonte/camada existente, se houver
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
        console.error('Erro ao juntar a via ao mapa:', error);
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
      
      // Ler as coordenadas
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
      // Aceitar respostas em array e paginadas
      const data = Array.isArray(result) ? result : (result.data || []);
      setAllVias(data);
      
      // Calcular as vias próximas depois de carregar
      if (paragem) {
        calculateNearbyVias(paragem.geoLocation, data);
      }
    } catch (error) {
      console.error('Erro ao carregar vias:', error);
      showNotification('Erro ao carregar vias', 'error');
    }
  }

  // Distância entre dois pontos pela fórmula de Haversine
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // raio da Terra em metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // distância em metros
  }

  // Diz se um ponto está perto do percurso de uma via
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
        // Se não for JSON, tentar o formato separado por ponto e vírgula
        coordinates = geoLocationPath
          .split(';')
          .map(coord => {
            const [pLng, pLat] = coord.split(',').map(Number);
            return [pLng, pLat] as [number, number];
          })
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
      }

      if (coordinates.length === 0) return false;

      // Algum ponto da via está dentro do limite?
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

  // Recalcular as vias próximas quando o local muda
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
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [lng, lat],
      zoom: 15,
      pitch: 45,
      bearing: 0,
    });

    mapInstanceRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on('load', () => {
      // Juntar o marcador da paragem
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

      // Juntar as vias, se houver
      if (nearbyVias.length > 0) {
        addViaRoutes(map);
      }
    });

    // Clicar no mapa muda o local
    map.on('click', (e) => {
      const { lat, lng } = e.lngLat;
      
      setFormData(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }));

      // Actualizar o marcador
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
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Paragem Não Encontrada</h3>
            <p className="text-slate-600 mb-6">A paragem que procura não existe.</p>
            <button
              onClick={() => router.push('/paragens')}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium"
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
      {/* Notificação */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-xl shadow-lg p-4 min-w-[300px] ${
            notification.type === 'success' ? 'bg-slate-50 border border-slate-200' :
            notification.type === 'error' ? 'bg-slate-100 border border-slate-400' :
            'bg-slate-50 border border-slate-200'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-slate-800' :
                notification.type === 'error' ? 'text-slate-900' :
                'text-slate-800'
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
            className="p-2 rounded-xl hover:bg-slate-100"
          >
            <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Editar Paragem</h2>
            <p className="text-slate-600 mt-1">Atualizar informações da paragem</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Campos do formulário, à esquerda */}
            <div className="space-y-6">
              {/* Informação básica */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Informações Básicas</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Nome da Paragem *
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Código *
                    </label>
                    <input
                      type="text"
                      value={formData.codigo}
                      onChange={(e) => setFormData({...formData, codigo: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Localização</h3>
                
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-sm text-slate-800">
                      Clique no mapa para atualizar a localização da paragem
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Latitude
                      </label>
                      <input
                        type="text"
                        value={formData.latitude}
                        readOnly
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-900 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Longitude
                      </label>
                      <input
                        type="text"
                        value={formData.longitude}
                        readOnly
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-900 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Vias */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900">Vias Associadas *</h3>
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
                      className="text-xs font-medium text-slate-900 hover:text-slate-700 px-3 py-1 border border-slate-300 rounded-xl hover:bg-slate-50"
                    >
                      {formData.viaIds.length === nearbyVias.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </button>
                  )}
                </div>
                
                {nearbyVias.length > 0 ? (
                  <>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
                      <p className="text-xs text-slate-800">
                        Mostrando {nearbyVias.length} via{nearbyVias.length !== 1 ? 's' : ''} próxima{nearbyVias.length !== 1 ? 's' : ''} (raio de 100m)
                      </p>
                    </div>
                    
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {nearbyVias.map((via) => (
                        <div
                          key={via.id}
                          onClick={() => handleViaToggle(via.id)}
                          className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                            formData.viaIds.includes(via.id)
                              ? 'border-slate-900 bg-slate-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={formData.viaIds.includes(via.id)}
                              onChange={() => {}}
                              className="w-5 h-5 text-slate-900 border-slate-300 rounded-lg focus:ring-slate-900"
                            />
                            <div>
                              <p className="font-medium text-slate-900">{via.nome}</p>
                              <p className="text-xs text-slate-600 font-mono">{via.codigo}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {formData.viaIds.length > 0 && (
                      <p className="text-sm text-slate-600 mt-3">
                        {formData.viaIds.length} via{formData.viaIds.length !== 1 ? 's' : ''} selecionada{formData.viaIds.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-slate-900 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-sm text-slate-800 font-medium">Nenhuma via próxima encontrada</p>
                        <p className="text-xs text-slate-800 mt-1">
                          Clique no mapa para atualizar a localização ou verifique se existem vias nesta área.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mapa, à direita */}
            <div className="lg:sticky lg:top-6 h-fit">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900">Localização no Mapa</h3>
                  <p className="text-sm text-slate-600">Clique para atualizar a posição</p>
                </div>
                <div 
                  ref={mapRef}
                  className="h-[600px]"
                  style={{ zIndex: 0 }}
                ></div>
              </div>
            </div>
          </div>

          {/* Botões de acção */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={() => router.push(`/paragens/${params.id}`)}
              className="px-6 py-3 border border-slate-300 rounded-xl font-medium text-slate-900 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
