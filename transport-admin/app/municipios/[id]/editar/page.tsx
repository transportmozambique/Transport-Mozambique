"use client";
import LoadingScreen from "../../../components/LoadingScreen";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Provincia {
  id: string;
  nome: string;
  codigo: string;
}

interface Via {
  id: string;
  nome: string;
  codigo: string;
  geoLocationPath?: string;
  cor?: string;
}

interface MunicipioData {
  id: string;
  nome: string;
  codigo: string;
  provinciaId?: string;
  geoLocation?: string;
  endereco?: string;
  contacto1?: number;
  vias: Via[];
}

export default function EditarMunicipio() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const circleLayerId = "municipio-circle";

  const [municipioData, setMunicipioData] = useState<MunicipioData | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    codigo: "",
    provinciaId: "",
    geoLocation: "-25.9655,32.5892",
    endereco: "",
    contacto1: "",
  });
  const [radius, setRadius] = useState(20);
  const [provincias, setProvincias] = useState<Provincia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Helper function to check if a point is within a circle
  const isPointInCircle = (pointLat: number, pointLng: number, centerLat: number, centerLng: number, radiusKm: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (pointLat - centerLat) * Math.PI / 180;
    const dLng = (pointLng - centerLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(centerLat * Math.PI / 180) * Math.cos(pointLat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance <= radiusKm;
  };

  // Helper function to check if a via passes through the circle
  const viaPassesThroughCircle = (geoLocationPath: string, centerLat: number, centerLng: number, radiusKm: number) => {
    try {
      const coordinates = geoLocationPath
        .trim()
        .split(';')
        .map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return { lat, lng };
        })
        .filter(coord => !isNaN(coord.lat) && !isNaN(coord.lng));

      // Check if any point of the route is within the circle
      return coordinates.some(coord => 
        isPointInCircle(coord.lat, coord.lng, centerLat, centerLng, radiusKm)
      );
    } catch (error) {
      return false;
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || loading || !municipioData) return;

    const [lat, lng] = formData.geoLocation.split(',').map(Number);

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
          },
          'openmaptiles': {
            type: 'vector',
            url: 'https://api.maptiler.com/tiles/v3/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'
          }
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [lng, lat],
      zoom: 10,
      pitch: 45,
      bearing: 0,
    });

    // Add navigation controls (zoom, rotation, pitch)
    map.addControl(new maplibregl.NavigationControl({
      visualizePitch: true,
      showZoom: true,
      showCompass: true
    }), 'top-right');

    // Click on map to set location
    map.on('click', (e) => {
      const { lat, lng } = e.lngLat;
      
      // Update center point
      const centerSource = map.getSource('center-point') as maplibregl.GeoJSONSource;
      if (centerSource) {
        centerSource.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        } as any);
      }
      
      setFormData(prev => ({
        ...prev,
        geoLocation: `${lat.toFixed(6)},${lng.toFixed(6)}`
      }));
      updateCircle(map, lat, lng, radius);
    });

    map.on('load', () => {
      // Add 3D buildings layer
      map.addLayer({
        'id': '3d-buildings',
        'source': 'openmaptiles',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      });

      // Add center point source
      map.addSource('center-point', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        } as any
      });

      // Add center point circle layer
      map.addLayer({
        id: 'center-point',
        type: 'circle',
        source: 'center-point',
        paint: {
          'circle-radius': 8,
          'circle-color': '#1f2937',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Add circle source and layer
      map.addSource(circleLayerId, {
        type: 'geojson',
        data: createCircle(lat, lng, radius)
      });

      map.addLayer({
        id: circleLayerId,
        type: 'fill',
        source: circleLayerId,
        paint: {
          'fill-color': '#1f2937',
          'fill-opacity': 0.1
        }
      });

      map.addLayer({
        id: `${circleLayerId}-outline`,
        type: 'line',
        source: circleLayerId,
        paint: {
          'line-color': '#1f2937',
          'line-width': 2
        }
      });

      // Add vias (routes) to the map - only show vias that pass through the circle
      if (municipioData && municipioData.vias && municipioData.vias.length > 0) {
        municipioData.vias.forEach((via) => {
          if (via.geoLocationPath) {
            // Check if via passes through the circle
            if (!viaPassesThroughCircle(via.geoLocationPath, lat, lng, radius)) {
              return; // Skip vias that don't pass through the circle
            }

            try {
              // Parse geoLocationPath format: "lng,lat;lng,lat;lng,lat"
              const coordinates = via.geoLocationPath
                .trim()
                .split(';')
                .map(coord => {
                  const [viaLng, viaLat] = coord.split(',').map(Number);
                  return [viaLng, viaLat];
                })
                .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
              
              // Validate coordinates array
              if (Array.isArray(coordinates) && coordinates.length > 1) {
                map.addSource(`via-${via.id}`, {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    properties: {
                      nome: via.nome,
                      codigo: via.codigo
                    },
                    geometry: {
                      type: 'LineString',
                      coordinates: coordinates
                    }
                  }
                });

                map.addLayer({
                  id: `via-${via.id}`,
                  type: 'line',
                  source: `via-${via.id}`,
                  paint: {
                    'line-color': via.cor || '#3B82F6',
                    'line-width': 3,
                    'line-opacity': 0.8
                  }
                });

                // Add click event to show via info
                map.on('click', `via-${via.id}`, (e) => {
                  if (e.features && e.features[0]) {
                    const feature = e.features[0];
                    new maplibregl.Popup()
                      .setLngLat(e.lngLat)
                      .setHTML(`
                        <div style="padding: 8px;">
                          <strong style="color: #1f2937;">${feature.properties.nome}</strong><br/>
                          <span style="color: #6b7280; font-size: 12px;">Código: ${feature.properties.codigo}</span>
                        </div>
                      `)
                      .addTo(map);
                  }
                });

                // Change cursor on hover
                map.on('mouseenter', `via-${via.id}`, () => {
                  map.getCanvas().style.cursor = 'pointer';
                });

                map.on('mouseleave', `via-${via.id}`, () => {
                  map.getCanvas().style.cursor = '';
                });
              }
            } catch (error) {
              // Skip invalid geoLocationPath
            }
          }
        });
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [loading]);

  // Update circle when radius changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const [lat, lng] = formData.geoLocation.split(',').map(Number);
    updateCircle(mapInstanceRef.current, lat, lng, radius);
  }, [radius]);

  // Create circle GeoJSON
  const createCircle = (lat: number, lng: number, radiusKm: number) => {
    const points = 64;
    const coords = [];
    const distanceX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    const distanceY = radiusKm / 110.574;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([lng + x, lat + y]);
    }
    coords.push(coords[0]);

    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [coords]
      }
    } as any;
  };

  // Update circle on map
  const updateCircle = (map: maplibregl.Map, lat: number, lng: number, radiusKm: number) => {
    const source = map.getSource(circleLayerId) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(createCircle(lat, lng, radiusKm));
    }
  };

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [municipioRes, provinciasRes] = await Promise.all([
          fetch(`/api/municipios/${id}`),
          fetch('/api/provincias?limit=1000')
        ]);

        if (municipioRes.ok) {
          const data = await municipioRes.json();
          setMunicipioData(data); // Store full data including vias
          setFormData({
            nome: data.nome || "",
            codigo: data.codigo || "",
            provinciaId: data.provinciaId || "",
            geoLocation: data.geoLocation || "-25.9655,32.5892",
            endereco: data.endereco || "",
            contacto1: data.contacto1 || "",
          });
        } else {
          showNotification('Erro ao carregar município', 'error');
        }

        if (provinciasRes.ok) {
          const result = await provinciasRes.json();
          setProvincias(result.data || []);
        }
      } catch (error) {
        showNotification('Erro ao carregar dados', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim() || !formData.codigo.trim() || !formData.provinciaId) {
      showNotification('Nome, código e província são obrigatórios', 'error');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/municipios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showNotification('Município atualizado com sucesso!', 'success');
        setTimeout(() => router.push(`/municipios/${id}`), 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao atualizar município', 'error');
      }
    } catch (error) {
      showNotification('Erro ao atualizar município', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  return (
    <div className="min-h-screen bg-white">
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

      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => router.push(`/municipios/${id}`)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Editar Município</h2>
            <p className="text-gray-600 mt-1">Atualize as informações do município</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-900">Informações Básicas</h3>
            
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Nome do Município *
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900"
                placeholder="Ex: KaMpfumo"
                required
              />
            </div>

            {/* Código */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Código *
              </label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 uppercase"
                placeholder="Ex: KMPF"
                maxLength={4}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Código único de 3-4 letras maiúsculas</p>
            </div>

            {/* Província */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Província *
              </label>
              {provincias.length === 0 ? (
                <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  Nenhuma província disponível.
                </div>
              ) : (
                <select
                  value={formData.provinciaId}
                  onChange={(e) => setFormData({ ...formData, provinciaId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900"
                  required
                >
                  <option value="">Selecione uma província</option>
                  {provincias.map((provincia) => (
                    <option key={provincia.id} value={provincia.id}>
                      {provincia.nome} ({provincia.codigo})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Endereço */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Endereço
              </label>
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900"
                placeholder="Ex: Av. Julius Nyerere, 123"
              />
            </div>

            {/* Contacto */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Contacto
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-4 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-900 font-medium">
                  +258
                </span>
                <input
                  type="tel"
                  value={formData.contacto1}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 9) {
                      setFormData({ ...formData, contacto1: value });
                    }
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  placeholder="840000000"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Número de telefone com 9 dígitos</p>
            </div>
          </div>

          {/* Map Location */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Localização e Área de Cobertura</h3>
            
            {/* GeoLocation Input */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Coordenadas do Centro (Latitude,Longitude)
              </label>
              <input
                type="text"
                value={formData.geoLocation}
                onChange={(e) => {
                  setFormData({ ...formData, geoLocation: e.target.value });
                  const [lat, lng] = e.target.value.split(',').map(Number);
                  if (!isNaN(lat) && !isNaN(lng) && mapInstanceRef.current) {
                    const centerSource = mapInstanceRef.current.getSource('center-point') as maplibregl.GeoJSONSource;
                    if (centerSource) {
                      centerSource.setData({
                        type: 'Feature',
                        properties: {},
                        geometry: {
                          type: 'Point',
                          coordinates: [lng, lat]
                        }
                      } as any);
                    }
                    mapInstanceRef.current.setCenter([lng, lat]);
                    updateCircle(mapInstanceRef.current, lat, lng, radius);
                  }
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900"
                placeholder="-25.9655,32.5892"
              />
              <p className="text-xs text-gray-500 mt-1">Clique no mapa para selecionar ou digite manualmente</p>
            </div>

            {/* Radius Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Raio de Cobertura: {radius} km
              </label>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>5 km</span>
                <span>100 km</span>
              </div>
            </div>

            {/* Map */}
            <div ref={mapRef} className="w-full h-96 rounded-lg border border-gray-300" />
            <p className="text-xs text-gray-500">
              💡 Dica: Clique no mapa para definir o centro do município
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => router.push(`/municipios/${id}`)}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
