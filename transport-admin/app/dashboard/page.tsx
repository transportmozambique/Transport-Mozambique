"use client";
import LoadingScreen from "../components/LoadingScreen";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Stats {
  transportes: number;
  proprietarios: number;
  vias: number;
  paragens: number;
  motoristas: number;
  motoristasActivos: number;
  transportesSemMotorista: number;
  provincias: number;
  municipios: number;
}

interface MunicipioData {
  name: string;
  count: number;
  percentage: number;
}

interface MunicipioSimpleData {
  name: string;
  count: number;
}

interface ViaData {
  id: string;
  name: string;
  count: number;
  color: string;
  path: string;
  start: string;
  end: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<Stats>({
    transportes: 0,
    proprietarios: 0,
    vias: 0,
    paragens: 0,
    motoristas: 0,
    motoristasActivos: 0,
    transportesSemMotorista: 0,
    provincias: 0,
    municipios: 0,
  });
  const [municipioData, setMunicipioData] = useState<MunicipioData[]>([]);
  const [viasData, setViasData] = useState<ViaData[]>([]);
  const [viasMunicipioData, setViasMunicipioData] = useState<MunicipioSimpleData[]>([]);
  const [paragensMunicipioData, setParagensMunicipioData] = useState<MunicipioSimpleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVia, setSelectedVia] = useState<string | null>(null);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const routesProcessed = useRef<Set<string>>(new Set());

  // Helper function to validate and fix color codes
  const getValidColor = (color: string | undefined): string => {
    const defaultColor = '#3B82F6';
    if (!color || typeof color !== 'string' || !color.startsWith('#')) {
      return defaultColor;
    }
    
    const hexPart = color.substring(1);
    // Check if it contains only valid hex characters
    if (!/^[0-9A-Fa-f]+$/.test(hexPart)) {
      return defaultColor;
    }
    
    if (hexPart.length === 6) {
      return color;
    } else if (hexPart.length < 6) {
      // Pad with zeros
      return '#' + hexPart.padEnd(6, '0');
    } else {
      // Truncate to 6 characters
      return '#' + hexPart.substring(0, 6);
    }
  };

  const fetchStats = async () => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      setRefreshing(true);
      setError(null);
      
      // Add timeout to fetch request
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/api/dashboard/stats', {
        signal: controller.signal
      });
      
      if (timeoutId) clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Handle specific HTTP error codes
        if (response.status === 500) {
          setError('Erro no servidor. Por favor, verifique se o servidor está a funcionar correctamente.');
        } else if (response.status === 503) {
          setError('Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.');
        } else if (response.status === 404) {
          setError('Endpoint não encontrado. Por favor, verifique a configuração do servidor.');
        } else {
          setError(`Erro HTTP: ${response.status}. Por favor, tente novamente.`);
        }
        return;
      }
      
      const data = await response.json();
      
      // Check if response has error
      if (data.error) {
        console.error('API Error:', data.error);
        setError('Erro ao carregar dados: ' + data.error);
        return;
      }
      
      // Check if stats exist and are valid
      if (data.stats && typeof data.stats === 'object') {
        setStats(data.stats);
        setMunicipioData(data.municipioData || []);
        setViasData(data.viasData || []);
        setViasMunicipioData(data.viasMunicipioData || []);
        setParagensMunicipioData(data.paragensMunicipioData || []);
        setLastUpdated(new Date());
      } else {
        console.error('Invalid API response:', data);
        setError('Resposta inválida da API. Por favor, tente novamente.');
      }
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
      
      // Handle different types of errors
      if (error.name === 'AbortError') {
        setError('Tempo de espera excedido. Verifique a sua conexão à internet e tente novamente.');
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        setError('Sem conexão à internet. Por favor, verifique a sua conexão e tente novamente.');
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        setError('Erro de rede. Verifique se o servidor está a correr e se tem conexão à internet.');
      } else if (error.message.includes('JSON')) {
        setError('Erro ao processar resposta do servidor. Por favor, tente novamente.');
      } else {
        setError('Erro inesperado. Por favor, tente novamente ou contacte o suporte.');
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    return () => {
      setLoading(false);
      setRefreshing(false);
    };
  }, []);

  // Handle via query parameter
  useEffect(() => {
    const viaId = searchParams.get('via');
    if (viaId && viasData.length > 0) {
      // Check if the via exists in the data
      const viaExists = viasData.some(v => v.id === viaId);
      if (viaExists) {
        setSelectedVia(viaId);
      }
    }
  }, [searchParams, viasData]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || viasData.length === 0) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm'
        }]
      },
      center: [32.5892, -25.9655], // Maputo center
      zoom: 11,
      pitch: 45, // Tilt map to see buildings in 3D
      bearing: 0
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on('load', () => {
      // Add 3D buildings
      const layers = map.current!.getStyle().layers;
      let firstSymbolId: string | undefined;
      for (const layer of layers) {
        if (layer.type === 'symbol') {
          firstSymbolId = layer.id;
          break;
        }
      }

      // Add building source if it doesn't exist
      if (!map.current!.getSource('openmaptiles')) {
        map.current!.addSource('openmaptiles', {
          'type': 'vector',
          'url': 'https://tiles.openfreemap.org/planet'
        });
      }

      // Add 3D buildings layer
      map.current!.addLayer(
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

      // Process all routes with OSRM
      viasData.forEach((via) => {
        if (!via.path || !map.current || routesProcessed.current.has(via.id)) return;

        try {
          const coordinates = via.path.split(';').map(coord => {
            const [lng, lat] = coord.split(',').map(Number);
            return [lng, lat];
          });

          if (coordinates.length < 2) return;

          // Use OSRM to get road-following route
          const waypointsString = coordinates.map(w => `${w[0]},${w[1]}`).join(';');
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson`;

          fetch(osrmUrl)
            .then(response => response.json())
            .then(data => {
              if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                // Fallback to original coordinates
                addRouteToMap(via.id, coordinates, via.color);
                return;
              }

              // Use OSRM route (follows roads)
              const routeGeometry = data.routes[0].geometry;
              addRouteToMap(via.id, routeGeometry.coordinates, via.color);
              routesProcessed.current.add(via.id);
            })
            .catch(() => {
              // Fallback to original coordinates
              addRouteToMap(via.id, coordinates, via.color);
            });
        } catch (error) {
          console.error(`Error processing route ${via.name}:`, error);
        }
      });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [viasData]);

  const addRouteToMap = (viaId: string, coordinates: any[], color: string) => {
    if (!map.current) return;

    try {
      const validColor = getValidColor(color);
      console.log(`Via ${viaId}: original color="${color}", valid color="${validColor}"`);

      // Add source
      if (!map.current.getSource(`route-${viaId}`)) {
        map.current.addSource(`route-${viaId}`, {
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
      }

      // Add layer
      if (!map.current.getLayer(`route-${viaId}`)) {
        map.current.addLayer({
          id: `route-${viaId}`,
          type: 'line',
          source: `route-${viaId}`,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': validColor,
            'line-width': 4,
            'line-opacity': 0.7
          }
        });
      }
    } catch (error) {
      console.error(`Error adding route ${viaId} to map:`, error);
    }
  };

  // Handle via selection
  useEffect(() => {
    if (!map.current) return;

    if (selectedVia) {
      // Hide all routes except selected
      viasData.forEach((via) => {
        if (map.current?.getLayer(`route-${via.id}`)) {
          if (via.id === selectedVia) {
            // Show and highlight selected route
            map.current.setLayoutProperty(`route-${via.id}`, 'visibility', 'visible');
            map.current.setPaintProperty(`route-${via.id}`, 'line-width', 6);
            map.current.setPaintProperty(`route-${via.id}`, 'line-opacity', 1);
          } else {
            // Hide other routes
            map.current.setLayoutProperty(`route-${via.id}`, 'visibility', 'none');
          }
        }
      });

      // Zoom to selected route
      const via = viasData.find(v => v.id === selectedVia);
      if (via && via.path) {
        const coordinates = via.path.split(';').map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return [lng, lat] as [number, number];
        });

        if (coordinates.length > 0) {
          const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
          }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

          map.current.fitBounds(bounds, { 
            padding: 50,
            pitch: 45, // Maintain tilt when zooming
            bearing: 0
          });
        }
      }
    } else {
      // Show all routes with normal styling
      viasData.forEach((via) => {
        if (map.current?.getLayer(`route-${via.id}`)) {
          map.current.setLayoutProperty(`route-${via.id}`, 'visibility', 'visible');
          map.current.setPaintProperty(`route-${via.id}`, 'line-width', 4);
          map.current.setPaintProperty(`route-${via.id}`, 'line-opacity', 0.7);
        }
      });
    }
  }, [selectedVia, viasData]);

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erro de Conexão</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchStats}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const motoristasPercentage = stats.transportes > 0 
    ? Math.round((stats.motoristasActivos / stats.transportes) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8 space-y-6">
        {/* Alert for buses without drivers - TOP OF PAGE */}
        {stats.transportesSemMotorista > 0 && (
          <div className="bg-black text-white rounded-xl p-6 border-2 border-gray-800">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-bold text-white mb-1">
                    Atenção: {stats.transportesSemMotorista} {stats.transportesSemMotorista === 1 ? 'transporte está' : 'transportes estão'} sem motorista
                  </p>
                  <p className="text-sm text-gray-300">
                    Cada transporte deve ter um motorista único atribuído para operar. Atribua motoristas agora para garantir operação completa.
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push('/motoristas')}
                className="px-6 py-3 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Ver Motoristas</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary Stats Grid - 4 columns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Transportes */}
          <button
            onClick={() => router.push('/transportes')}
            className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-black hover:shadow-xl transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-black transition-colors">
                <svg className="w-6 h-6 text-black group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Total Transportes</p>
            <p className="text-4xl font-bold text-black mb-2">{stats.transportes}</p>
            {stats.transportesSemMotorista > 0 && (
              <p className="text-xs text-gray-600">
                {stats.transportesSemMotorista} sem motorista
              </p>
            )}
          </button>

          {/* Motoristas */}
          <button
            onClick={() => router.push('/motoristas')}
            className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-black hover:shadow-xl transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-black transition-colors">
                <svg className="w-6 h-6 text-black group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Total Motoristas</p>
            <p className="text-4xl font-bold text-black mb-2">{stats.motoristas}</p>
            <p className="text-xs text-gray-600">
              {stats.motoristasActivos} activos ({motoristasPercentage}%)
            </p>
          </button>

          {/* Vias */}
          <button
            onClick={() => router.push('/vias')}
            className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-black hover:shadow-xl transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-black transition-colors">
                <svg className="w-6 h-6 text-black group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Total Vias</p>
            <p className="text-4xl font-bold text-black mb-2">{stats.vias}</p>
            <p className="text-xs text-gray-600">Rotas de transporte</p>
          </button>

          {/* Paragens */}
          <button
            onClick={() => router.push('/paragens')}
            className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-black hover:shadow-xl transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-black transition-colors">
                <svg className="w-6 h-6 text-black group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Total Paragens</p>
            <p className="text-4xl font-bold text-black mb-2">{stats.paragens}</p>
            <p className="text-xs text-gray-600">Pontos de paragem</p>
          </button>
        </div>

        {/* Secondary Stats - Dark Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/proprietarios')}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 hover:shadow-xl transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <svg className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">Proprietários</p>
            <p className="text-4xl font-bold text-white">{stats.proprietarios}</p>
            <p className="text-xs text-gray-400 mt-2">Empresas registadas</p>
          </button>

          <button
            onClick={() => router.push('/provincias')}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 hover:shadow-xl transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <svg className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">Províncias</p>
            <p className="text-4xl font-bold text-white">{stats.provincias}</p>
            <p className="text-xs text-gray-400 mt-2">Regiões administrativas</p>
          </button>

          <button
            onClick={() => router.push('/municipios')}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 hover:shadow-xl transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <svg className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">Municípios</p>
            <p className="text-4xl font-bold text-white">{stats.municipios}</p>
            <p className="text-xs text-gray-400 mt-2">Distritos urbanos</p>
          </button>
        </div>

        {/* New Analytics Graphs - 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. Vias por Município */}
          <button
            onClick={() => router.push('/vias')}
            className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-black transition-all text-left w-full cursor-pointer"
          >
            <h3 className="text-lg font-bold text-black mb-4">Vias por Município</h3>
            <div className="flex items-center space-x-6">
              <div className="relative w-32 h-32 flex-shrink-0">
                <svg viewBox="0 0 200 200" className="transform -rotate-90">
                  {/* Background circle */}
                  <circle cx="100" cy="100" r="80" fill="none" stroke="#f3f4f6" strokeWidth="40" />
                  
                  {viasMunicipioData.length > 0 && (() => {
                    const total = viasMunicipioData.reduce((sum, m) => sum + m.count, 0);
                    let offset = 0;
                    const colors = ['#000000', '#6b7280', '#9ca3af', '#d1d5db'];
                    
                    return viasMunicipioData.map((municipio, index) => {
                      const percentage = municipio.count / total;
                      const dashArray = percentage * 502.65;
                      const dashOffset = -offset;
                      offset += dashArray;
                      
                      return (
                        <circle
                          key={municipio.name}
                          cx="100"
                          cy="100"
                          r="80"
                          fill="none"
                          stroke={colors[index % colors.length]}
                          strokeWidth="40"
                          strokeDasharray={`${dashArray} 502.65`}
                          strokeDashoffset={dashOffset}
                          strokeLinecap="round"
                          className="transition-all duration-300"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold text-black">{stats.vias}</p>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
              </div>
              
              <div className="flex-1 space-y-2">
                {viasMunicipioData.map((municipio, index) => {
                  const colors = ['bg-black', 'bg-gray-500', 'bg-gray-400', 'bg-gray-300'];
                  const percentage = stats.vias > 0 ? Math.round((municipio.count / stats.vias) * 100) : 0;
                  
                  return (
                    <div
                      key={municipio.name}
                      className="w-full flex items-center justify-between p-2"
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className={`w-3 h-3 ${colors[index % colors.length]} rounded-sm flex-shrink-0`}></div>
                        <span className="text-sm text-black truncate">{municipio.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 ml-2">
                        <span className="text-sm font-bold text-black">{municipio.count}</span>
                        <span className="text-xs text-gray-500">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </button>

          {/* 2. Paragens por Município */}
          <button
            onClick={() => router.push('/paragens')}
            className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-black transition-all text-left w-full cursor-pointer"
          >
            <h3 className="text-lg font-bold text-black mb-4">Paragens por Município</h3>
            <div className="flex items-center space-x-6">
              <div className="relative w-32 h-32 flex-shrink-0">
                <svg viewBox="0 0 200 200" className="transform -rotate-90">
                  {/* Background circle */}
                  <circle cx="100" cy="100" r="80" fill="none" stroke="#f3f4f6" strokeWidth="40" />
                  
                  {paragensMunicipioData.length > 0 && (() => {
                    const total = paragensMunicipioData.reduce((sum, m) => sum + m.count, 0);
                    let offset = 0;
                    const colors = ['#000000', '#6b7280', '#9ca3af', '#d1d5db'];
                    
                    return paragensMunicipioData.map((municipio, index) => {
                      const percentage = municipio.count / total;
                      const dashArray = percentage * 502.65;
                      const dashOffset = -offset;
                      offset += dashArray;
                      
                      return (
                        <circle
                          key={municipio.name}
                          cx="100"
                          cy="100"
                          r="80"
                          fill="none"
                          stroke={colors[index % colors.length]}
                          strokeWidth="40"
                          strokeDasharray={`${dashArray} 502.65`}
                          strokeDashoffset={dashOffset}
                          strokeLinecap="round"
                          className="transition-all duration-300"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold text-black">{stats.paragens}</p>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
              </div>
              
              <div className="flex-1 space-y-2">
                {paragensMunicipioData.map((municipio, index) => {
                  const colors = ['bg-black', 'bg-gray-500', 'bg-gray-400', 'bg-gray-300'];
                  const percentage = stats.paragens > 0 ? Math.round((municipio.count / stats.paragens) * 100) : 0;
                  
                  return (
                    <div
                      key={municipio.name}
                      className="w-full flex items-center justify-between p-2"
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className={`w-3 h-3 ${colors[index % colors.length]} rounded-sm flex-shrink-0`}></div>
                        <span className="text-sm text-black truncate">{municipio.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 ml-2">
                        <span className="text-sm font-bold text-black">{municipio.count}</span>
                        <span className="text-xs text-gray-500">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </button>

          {/* 3. Top Vias com Mais Transportes */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-black transition-all">
            <button
              onClick={() => router.push('/vias')}
              className="w-full text-left mb-4 hover:opacity-70 transition-opacity"
            >
              <h3 className="text-lg font-bold text-black">Top Vias</h3>
            </button>
            <div className="space-y-3">
              {viasData.slice(0, 3).map((via, index) => {
                const maxCount = Math.max(...viasData.map(v => v.count), 1);
                const barWidth = (via.count / maxCount) * 100;
                
                return (
                  <button
                    key={via.id}
                    onClick={() => router.push(`/vias/${via.id}`)}
                    className="w-full text-left hover:bg-gray-50 p-2 rounded transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <span className="text-xs font-bold text-gray-400 w-4">#{index + 1}</span>
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: via.color }}
                        ></div>
                        <span className="text-sm text-black truncate">{via.name}</span>
                      </div>
                      <span className="text-sm font-bold text-black ml-2">{via.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300 group-hover:opacity-80"
                        style={{ 
                          width: `${barWidth}%`,
                          backgroundColor: via.color
                        }}
                      ></div>
                    </div>
                  </button>
                );
              })}
              
              {viasData.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">Nenhuma via com transportes</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map and Vias Section */}
        {viasData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Map - Takes 3 columns */}
            <div className="lg:col-span-3 bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-black">Mapa de Vias</h2>
                {selectedVia && (
                  <button
                    onClick={() => setSelectedVia(null)}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-black rounded-lg font-medium transition-colors"
                  >
                    Mostrar Todas
                  </button>
                )}
              </div>
              <div 
                ref={mapContainer} 
                className="w-full h-[600px] rounded-xl border-2 border-gray-200"
              />
            </div>

            {/* Vias List - Takes 1 column */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <h2 className="text-xl font-bold text-black mb-4">Vias ({viasData.length})</h2>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {viasData.map((via) => (
                  <button
                    key={via.id}
                    onClick={() => setSelectedVia(via.id === selectedVia ? null : via.id)}
                    className={`w-full text-left p-4 rounded-lg transition-all ${
                      selectedVia === via.id
                        ? 'bg-black text-white shadow-lg'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0 ${selectedVia === via.id ? 'ring-2 ring-white' : ''}`}
                          style={{ backgroundColor: getValidColor(via.color) }}
                        ></div>
                        <span className={`text-sm font-bold truncate ${selectedVia === via.id ? 'text-white' : 'text-black'}`}>
                          {via.name}
                        </span>
                      </div>
                      <span className={`text-lg font-bold ml-2 ${selectedVia === via.id ? 'text-white' : 'text-black'}`}>
                        {via.count}
                      </span>
                    </div>
                    <div className={`text-xs ${selectedVia === via.id ? 'text-gray-300' : 'text-gray-600'}`}>
                      <div className="flex items-center space-x-1 mb-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="truncate">{via.start}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="truncate">{via.end}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compact Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Transportes with/without Motoristas */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-black transition-all">
            <h3 className="text-sm font-bold text-black mb-3">Estado dos Transportes</h3>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push('/transportes')}
                className="relative w-24 h-24 flex-shrink-0 group cursor-pointer"
              >
                <svg viewBox="0 0 200 200" className="transform -rotate-90">
                  <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" strokeWidth="32" />
                  <circle 
                    cx="100" cy="100" r="80" fill="none" stroke="#000000" strokeWidth="32"
                    strokeDasharray={`${((stats.transportes - stats.transportesSemMotorista) / stats.transportes) * 502.65} 502.65`} 
                    strokeLinecap="round"
                    className="transition-all duration-300 group-hover:stroke-[36]"
                  />
                  <circle 
                    cx="100" cy="100" r="80" fill="none" stroke="#d1d5db" strokeWidth="32"
                    strokeDasharray={`${(stats.transportesSemMotorista / stats.transportes) * 502.65} 502.65`}
                    strokeDashoffset={`-${((stats.transportes - stats.transportesSemMotorista) / stats.transportes) * 502.65}`} 
                    strokeLinecap="round"
                    className="transition-all duration-300 group-hover:stroke-[36]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xl font-bold text-black group-hover:text-2xl transition-all">{stats.transportes}</p>
                </div>
              </button>
              <div className="flex-1 space-y-2">
                <button
                  onClick={() => router.push('/transportes?filter=comMotorista')}
                  className="w-full flex items-center justify-between hover:bg-gray-50 p-2 rounded transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-black rounded-full"></div>
                    <span className="text-xs text-black">Com Motorista</span>
                  </div>
                  <span className="text-sm font-bold text-black">{stats.transportes - stats.transportesSemMotorista}</span>
                </button>
                <button
                  onClick={() => router.push('/transportes?filter=semMotorista')}
                  className="w-full flex items-center justify-between hover:bg-gray-50 p-2 rounded transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    <span className="text-xs text-black">Sem Motorista</span>
                  </div>
                  <span className="text-sm font-bold text-black">{stats.transportesSemMotorista}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Motoristas Active vs Available */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-black transition-all">
            <h3 className="text-sm font-bold text-black mb-3">Estado dos Motoristas</h3>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push('/motoristas')}
                className="relative w-24 h-24 flex-shrink-0 group cursor-pointer"
              >
                <svg viewBox="0 0 200 200" className="transform -rotate-90">
                  <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" strokeWidth="32" />
                  <circle 
                    cx="100" cy="100" r="80" fill="none" stroke="#000000" strokeWidth="32"
                    strokeDasharray={`${(stats.motoristasActivos / stats.motoristas) * 502.65} 502.65`} 
                    strokeLinecap="round"
                    className="transition-all duration-300 group-hover:stroke-[36]"
                  />
                  <circle 
                    cx="100" cy="100" r="80" fill="none" stroke="#9ca3af" strokeWidth="32"
                    strokeDasharray={`${((stats.motoristas - stats.motoristasActivos) / stats.motoristas) * 502.65} 502.65`}
                    strokeDashoffset={`-${(stats.motoristasActivos / stats.motoristas) * 502.65}`} 
                    strokeLinecap="round"
                    className="transition-all duration-300 group-hover:stroke-[36]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xl font-bold text-black group-hover:text-2xl transition-all">{stats.motoristas}</p>
                </div>
              </button>
              <div className="flex-1 space-y-2">
                <button
                  onClick={() => router.push('/motoristas?filter=activos')}
                  className="w-full flex items-center justify-between hover:bg-gray-50 p-2 rounded transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-black rounded-full"></div>
                    <span className="text-xs text-black">Activos</span>
                  </div>
                  <span className="text-sm font-bold text-black">{stats.motoristasActivos}</span>
                </button>
                <button
                  onClick={() => router.push('/motoristas?filter=disponiveis')}
                  className="w-full flex items-center justify-between hover:bg-gray-50 p-2 rounded transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-xs text-black">Disponíveis</span>
                  </div>
                  <span className="text-sm font-bold text-black">{stats.motoristas - stats.motoristasActivos}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Vias with/without Transportes */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-black transition-all">
            <h3 className="text-sm font-bold text-black mb-3">Distribuição de Vias</h3>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push('/vias')}
                className="relative w-24 h-24 flex-shrink-0 group cursor-pointer"
              >
                <svg viewBox="0 0 200 200" className="transform -rotate-90">
                  <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" strokeWidth="32" />
                  <circle 
                    cx="100" cy="100" r="80" fill="none" stroke="#000000" strokeWidth="32"
                    strokeDasharray={`${(viasData.length / stats.vias) * 502.65} 502.65`} 
                    strokeLinecap="round"
                    className="transition-all duration-300 group-hover:stroke-[36]"
                  />
                  <circle 
                    cx="100" cy="100" r="80" fill="none" stroke="#6b7280" strokeWidth="32"
                    strokeDasharray={`${((stats.vias - viasData.length) / stats.vias) * 502.65} 502.65`}
                    strokeDashoffset={`-${(viasData.length / stats.vias) * 502.65}`} 
                    strokeLinecap="round"
                    className="transition-all duration-300 group-hover:stroke-[36]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xl font-bold text-black group-hover:text-2xl transition-all">{stats.vias}</p>
                </div>
              </button>
              <div className="flex-1 space-y-2">
                <button
                  onClick={() => router.push('/vias?filter=comTransportes')}
                  className="w-full flex items-center justify-between hover:bg-gray-50 p-2 rounded transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-black rounded-full"></div>
                    <span className="text-xs text-black">Com Transportes</span>
                  </div>
                  <span className="text-sm font-bold text-black">{viasData.length}</span>
                </button>
                <button
                  onClick={() => router.push('/vias?filter=semTransportes')}
                  className="w-full flex items-center justify-between hover:bg-gray-50 p-2 rounded transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <span className="text-xs text-black">Sem Transportes</span>
                  </div>
                  <span className="text-sm font-bold text-black">{stats.vias - viasData.length}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<LoadingScreen layout="admin" />}>
      <DashboardContent />
    </Suspense>
  );
}
