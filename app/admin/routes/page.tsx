"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Via {
  id: string;
  nome: string;
  codigo: string;
  cor: string;
  terminalPartida: string;
  terminalChegada: string;
  geoLocationPath: string;
  municipio: string;
  municipioId: string;
  _count?: {
    paragens: number;
    transportes: number;
  };
}

interface Municipality {
  id: string;
  nome: string;
  codigo: string;
}

interface Stop {
  id: string;
  nome: string;
  codigo: string;
  geoLocation: string;
}

export default function AdminRoutesPage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  
  const [vias, setVias] = useState<Via[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVia, setEditingVia] = useState<Via | null>(null);
  const [selectedViaOnMap, setSelectedViaOnMap] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    terminalPartida: "",
    terminalChegada: "",
    cor: "#3B82F6",
    municipioId: "",
  });

  const routeLayersRef = useRef<Map<string, string>>(new Map());

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

  useEffect(() => {
    // Check authentication
    const adminData = localStorage.getItem("admin");
    if (!adminData) {
      router.push("/admin/login");
      return;
    }

    // Fetch data
    fetchVias();
    fetchMunicipalities();
    fetchStops();
  }, [router]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [32.5892, -25.9655],
      zoom: 11,
      antialias: false,
    });

    mapInstanceRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update route layers on map
  useEffect(() => {
    if (!mapInstanceRef.current || !Array.isArray(vias) || vias.length === 0) return;

    const map = mapInstanceRef.current;

    if (!map.loaded()) {
      const loadHandler = () => {
        updateRouteLines();
      };
      map.once('load', loadHandler);
      return () => {
        map.off('load', loadHandler);
      };
    }

    updateRouteLines();

    function updateRouteLines() {
      if (!mapInstanceRef.current) return;

      console.log('Updating route lines for', vias.length, 'vias');

      // Clear existing route layers
      routeLayersRef.current.forEach((layerId) => {
        if (mapInstanceRef.current!.getLayer(layerId)) {
          mapInstanceRef.current!.removeLayer(layerId);
        }
        if (mapInstanceRef.current!.getSource(layerId)) {
          mapInstanceRef.current!.removeSource(layerId);
        }
      });
      routeLayersRef.current.clear();

      let addedCount = 0;

      // Add route lines for each via
      vias.forEach(via => {
        if (!via.geoLocationPath) {
          console.log('Via', via.codigo, 'has no path');
          return;
        }

        const layerId = `route-${via.id}`;
        
        // Parse the path
        const coordinates = via.geoLocationPath
          .split(';')
          .map(coord => {
            const [lon, lat] = coord.split(',').map(Number);
            return [lon, lat];
          })
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

        if (coordinates.length < 2) {
          console.log('Via', via.codigo, 'has insufficient coordinates:', coordinates.length);
          return;
        }

        try {
          const validColor = getValidColor(via.cor);
          console.log(`Via ${via.codigo}: original color="${via.cor}", valid color="${validColor}"`);

          mapInstanceRef.current!.addSource(layerId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: { viaId: via.id },
              geometry: {
                type: 'LineString',
                coordinates: coordinates,
              },
            },
          });

          mapInstanceRef.current!.addLayer({
            id: layerId,
            type: 'line',
            source: layerId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': selectedViaOnMap === via.id ? '#ef4444' : validColor,
              'line-width': selectedViaOnMap === via.id ? 5 : 3,
              'line-opacity': selectedViaOnMap === via.id ? 1 : 0.6,
            },
          });

          routeLayersRef.current.set(via.id, layerId);
          addedCount++;

          // Add click handler to route line
          mapInstanceRef.current!.on('click', layerId, () => {
            console.log('Clicked via:', via.nome);
            handleViaClick(via);
          });

          // Change cursor on hover
          mapInstanceRef.current!.on('mouseenter', layerId, () => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.getCanvas().style.cursor = 'pointer';
            }
          });

          mapInstanceRef.current!.on('mouseleave', layerId, () => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.getCanvas().style.cursor = '';
            }
          });
        } catch (error) {
          console.error(`Error adding route ${via.codigo}:`, error);
        }
      });

      console.log('Added', addedCount, 'route layers to map');
    }
  }, [vias, selectedViaOnMap, handleViaClick]);

  const fetchVias = async () => {
    try {
      console.log('Fetching vias...');
      const response = await fetch('/api/locations/vias');
      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error('Failed to fetch vias');
      }
      const data = await response.json();
      console.log('Vias data:', data);
      console.log('Number of vias:', data.vias?.length);
      if (data.vias && data.vias.length > 0) {
        console.log('First via:', data.vias[0]);
        console.log('First via _count:', data.vias[0]._count);
      }
      setVias(Array.isArray(data.vias) ? data.vias : []);
    } catch (error) {
      console.error('Error fetching vias:', error);
      setVias([]); // Ensure vias is always an array
    } finally {
      setLoading(false);
    }
  };

  const fetchMunicipalities = async () => {
    try {
      const response = await fetch('/api/admin/seed');
      const data = await response.json();
      if (data.municipalities) {
        setMunicipalities(data.municipalities);
      }
    } catch (error) {
      console.error('Error fetching municipalities:', error);
    }
  };

  const fetchStops = async () => {
    try {
      const response = await fetch('/api/locations/paragens');
      const data = await response.json();
      setStops(data.paragens || []);
    } catch (error) {
      console.error('Error fetching stops:', error);
    }
  };

  const handleViaClick = useCallback((via: Via) => {
    console.log('handleViaClick called for:', via.nome);
    setSelectedViaOnMap(via.id);
    setEditingVia(via);
    setShowForm(true);
    setFormData({
      nome: via.nome,
      terminalPartida: via.terminalPartida,
      terminalChegada: via.terminalChegada,
      cor: via.cor,
      municipioId: via.municipioId,
    });

    // Zoom to route
    if (mapInstanceRef.current && via.geoLocationPath) {
      const coordinates = via.geoLocationPath
        .split(';')
        .map(coord => {
          const [lon, lat] = coord.split(',').map(Number);
          return [lon, lat] as [number, number];
        })
        .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

      if (coordinates.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord));
        mapInstanceRef.current.fitBounds(bounds, { padding: 80 });
      }
    }
  }, []);

  const handleCancel = () => {
    setShowForm(false);
    setEditingVia(null);
    setSelectedViaOnMap(null);
    setFormData({
      nome: "",
      terminalPartida: "",
      terminalChegada: "",
      cor: "#3B82F6",
      municipioId: "",
    });
  };

  const filteredVias = Array.isArray(vias) ? vias.filter(via => 
    via.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    via.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    via.terminalPartida.toLowerCase().includes(searchTerm.toLowerCase()) ||
    via.terminalChegada.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-black">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center space-x-2 text-black hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium text-lg">Voltar ao Painel</span>
            </button>

            <h1 className="text-2xl font-bold text-gray-900">Gerir Vias</h1>

            <div className="w-32"></div> {/* Spacer to match buses page layout */}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Map */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Mapa de Vias</h2>
              <p className="text-sm text-black">Clique numa via para ver detalhes</p>
            </div>
            <div ref={mapRef} className="h-[600px]" />
          </div>

          {/* Form or List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            {showForm && editingVia ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    Detalhes da Via
                  </h2>
                  <button
                    onClick={handleCancel}
                    className="text-black hover:text-black"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Nome da Via
                    </label>
                    <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                      <p className="text-gray-900 font-medium">{editingVia.nome}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Código
                    </label>
                    <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                      <p className="text-gray-900 font-mono">{editingVia.codigo}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Terminal Partida
                      </label>
                      <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                        <p className="text-gray-900 text-sm">{editingVia.terminalPartida}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Terminal Chegada
                      </label>
                      <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                        <p className="text-gray-900 text-sm">{editingVia.terminalChegada}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Município
                    </label>
                    <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                      <p className="text-gray-900">{editingVia.municipio}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Cor da Via
                    </label>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-xl border-2 border-gray-300"
                        style={{ backgroundColor: getValidColor(editingVia.cor) }}
                      />
                      <span className="text-black font-mono">{editingVia.cor}</span>
                    </div>
                  </div>

                  {editingVia._count && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                      <div className="text-center p-4 bg-gray-50 rounded-xl">
                        <p className="text-3xl font-bold text-black">{editingVia._count.paragens}</p>
                        <p className="text-sm text-black mt-1">Paragens</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-xl">
                        <p className="text-3xl font-bold text-green-600">{editingVia._count.transportes}</p>
                        <p className="text-sm text-black mt-1">Autocarros</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 text-black rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    Lista de Vias ({filteredVias.length})
                  </h2>
                </div>

                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Pesquisar vias..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <svg 
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-black"
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {filteredVias.map(via => (
                    <div
                      key={via.id}
                      onClick={() => handleViaClick(via)}
                      className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div 
                              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                              style={{ backgroundColor: getValidColor(via.cor) }}
                            />
                            <h3 className="font-bold text-gray-900">{via.nome}</h3>
                          </div>
                          <p className="text-xs text-black mb-2">{via.codigo}</p>
                          <div className="flex items-center gap-2 text-sm text-black">
                            <span>{via.terminalPartida}</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                            <span>{via.terminalChegada}</span>
                          </div>
                          <p className="text-xs text-black mt-2">
                            {via.municipio}
                          </p>
                          {via._count && (
                            <div className="flex gap-4 mt-2">
                              <span className="text-xs text-black font-semibold">
                                Paragens: {via._count.paragens}
                              </span>
                              <span className="text-xs text-green-600 font-semibold">
                                Transportes: {via._count.transportes}
                              </span>
                            </div>
                          )}
                        </div>
                        <svg className="w-5 h-5 text-black flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

