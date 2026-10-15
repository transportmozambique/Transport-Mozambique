"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Provincia {
  id: string;
  nome: string;
  codigo: string;
}

export default function NovoMunicipio() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const circleLayerId = "municipio-circle";

  const [formData, setFormData] = useState({
    nome: "",
    codigo: "",
    provinciaId: "",
    geoLocation: "-25.9655,32.5892", // Default: Maputo
    endereco: "",
    contacto1: "",
  });
  const [radius, setRadius] = useState(20); // Default 20km radius for município
  const [provincias, setProvincias] = useState<Provincia[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProvincias, setLoadingProvincias] = useState(true);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

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
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

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

  // Fetch províncias
  useEffect(() => {
    const fetchProvincias = async () => {
      try {
        const response = await fetch('/api/provincias?limit=1000');
        if (response.ok) {
          const result = await response.json();
          setProvincias(result.data || []);
        }
      } catch (error) {
        showNotification('Erro ao carregar províncias', 'error');
      } finally {
        setLoadingProvincias(false);
      }
    };

    fetchProvincias();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim() || !formData.codigo.trim() || !formData.provinciaId) {
      showNotification('Nome, código e província são obrigatórios', 'error');
      return;
    }

    if (formData.codigo.length < 3 || formData.codigo.length > 4) {
      showNotification('Código deve ter 3-4 letras', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        contacto1: formData.contacto1 ? parseInt(formData.contacto1) : null,
      };

      const response = await fetch('/api/municipios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const municipio = await response.json();
        showNotification('Município criado com sucesso!', 'success');
        setTimeout(() => router.push(`/municipios/${municipio.id}`), 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao criar município', 'error');
      }
    } catch (error) {
      showNotification('Erro ao criar município', 'error');
    } finally {
      setLoading(false);
    }
  };

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
            onClick={() => router.push('/municipios')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Novo Município</h2>
            <p className="text-gray-600 mt-1">Crie um novo município no sistema</p>
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
              {loadingProvincias ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                </div>
              ) : provincias.length === 0 ? (
                <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  Nenhuma província disponível.
                  <button
                    type="button"
                    onClick={() => router.push('/provincias/novo')}
                    className="text-gray-900 font-semibold ml-1 underline"
                  >
                    Criar província primeiro
                  </button>
                </div>
              ) : (
                <select
                  value={formData.provinciaId}
                  onChange={(e) => setFormData({ ...formData, provinciaId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900"
                  required
                >
                  <option value="">Selecione uma província</option>
                  {provincias.map(provincia => (
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
              onClick={() => router.push('/municipios')}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Criar Município</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
