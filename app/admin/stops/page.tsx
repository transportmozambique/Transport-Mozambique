"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Stop {
  id: string;
  nome: string;
  codigo: string;
  geoLocation: string;
  latitude: number;
  longitude: number;
  viaIds: string[];
  isTerminal?: boolean;
}

interface Via {
  id: string;
  nome: string;
  codigo: string;
}

export default function AdminStopsPage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  
  const [stops, setStops] = useState<Stop[]>([]);
  const [vias, setVias] = useState<Via[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [selectedStopOnMap, setSelectedStopOnMap] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    codigo: "",
    latitude: -25.9655,
    longitude: 32.5892,
    viaIds: [] as string[],
    isTerminal: false
  });

  const stopMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    // Check authentication
    const adminData = localStorage.getItem("admin");
    if (!adminData) {
      router.push("/admin/login");
      return;
    }

    // Fetch data
    fetchStops();
    fetchVias();
  }, [router]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [32.5892, -25.9655],
      zoom: 12,
      antialias: false, // Better performance
    });

    mapInstanceRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // Click on map to set stop location
    map.on('click', (e) => {
      if (showForm) {
        setFormData(prev => ({
          ...prev,
          latitude: e.lngLat.lat,
          longitude: e.lngLat.lng
        }));
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [showForm]);

  // Update stop markers on map
  useEffect(() => {
    if (!mapInstanceRef.current || stops.length === 0) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    stopMarkersRef.current.forEach(marker => marker.remove());
    stopMarkersRef.current.clear();

    // Add markers for each stop
    stops.forEach(stop => {
      const el = document.createElement('div');
      el.style.cssText = `
        background: ${selectedStopOnMap === stop.id ? '#ef4444' : stop.isTerminal ? '#1f2937' : '#6b7280'};
        width: ${stop.isTerminal ? '20px' : '16px'};
        height: ${stop.isTerminal ? '20px' : '16px'};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      `;

      const clickHandler = () => {
        setSelectedStopOnMap(stop.id);
        setEditingStop(stop);
        setShowForm(true);
        setFormData({
          nome: stop.nome,
          codigo: stop.codigo,
          latitude: stop.latitude,
          longitude: stop.longitude,
          viaIds: stop.viaIds,
          isTerminal: stop.isTerminal || false
        });
      };
      
      el.addEventListener('click', clickHandler);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([stop.longitude, stop.latitude])
        .addTo(map);

      stopMarkersRef.current.set(stop.id, marker);
    });
  }, [stops, selectedStopOnMap]);

  const fetchStops = async () => {
    try {
      const response = await fetch('/api/locations/paragens');
      const data = await response.json();
      const parsedStops = (data.paragens || []).map((stop: any) => {
        const [lng, lat] = stop.geoLocation.split(',').map(Number);
        return {
          ...stop,
          latitude: lat,
          longitude: lng
        };
      });
      setStops(parsedStops);
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  };

  const fetchVias = async () => {
    try {
      const response = await fetch('/api/locations/vias');
      const data = await response.json();
      setVias(data.vias || []);
    } catch (error) {
      // Silent error handling
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const stopData = {
      ...formData,
      geoLocation: `${formData.longitude},${formData.latitude}`,
      id: editingStop?.id
    };

    try {
      if (editingStop) {
        const response = await fetch(`/api/locations/paragens`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stopData)
        });
        
        if (response.ok) {
          alert('Paragem atualizada com sucesso!');
          fetchStops();
          handleCancel();
        }
      } else {
        const response = await fetch('/api/locations/paragens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stopData)
        });
        
        if (response.ok) {
          alert('Paragem criada com sucesso!');
          fetchStops();
          handleCancel();
        }
      }
    } catch (error) {
      alert('Erro ao guardar paragem');
    }
  };

  const handleDelete = async (stopId: string) => {
    try {
      const response = await fetch(`/api/locations/paragens?id=${stopId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        alert('Paragem eliminada com sucesso!');
        fetchStops();
        handleCancel();
      }
    } catch (error) {
      alert('Erro ao eliminar paragem');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingStop(null);
    setSelectedStopOnMap(null);
    setFormData({
      nome: "",
      codigo: "",
      latitude: -25.9655,
      longitude: 32.5892,
      viaIds: [],
      isTerminal: false
    });
  };

  const toggleVia = (viaId: string) => {
    setFormData(prev => ({
      ...prev,
      viaIds: prev.viaIds.includes(viaId)
        ? prev.viaIds.filter(id => id !== viaId)
        : [...prev.viaIds, viaId]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center space-x-2 text-gray-700 hover:text-black transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Voltar</span>
            </button>

            <h1 className="text-xl font-semibold text-gray-900">Gerir Paragens</h1>

            <button
              onClick={() => {
                setShowForm(true);
                setEditingStop(null);
              }}
              className="px-4 py-2 bg-black hover:bg-gray-900 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Nova Paragem</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Map */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Mapa de Paragens</h2>
              <p className="text-sm text-gray-600 mt-1">Clique no mapa para definir localização ou numa paragem para editar</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-600 rounded-full border-2 border-white"></div>
                  <span>Paragem</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-black rounded-full border-2 border-white"></div>
                  <span>Terminal</span>
                </div>
              </div>
            </div>
            <div ref={mapRef} className="h-[600px]" />
          </div>

          {/* Form or List */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {showForm ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingStop ? 'Editar Paragem' : 'Nova Paragem'}
                </h2>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Ex: Praça dos Heróis"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Código *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Ex: PH001"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Latitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Longitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isTerminal}
                      onChange={(e) => setFormData({ ...formData, isTerminal: e.target.checked })}
                      className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black"
                    />
                    <span className="text-sm font-semibold text-gray-700">É um terminal?</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vias Associadas *
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-xl p-3 space-y-2">
                    {vias.map(via => (
                      <label key={via.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={formData.viaIds.includes(via.id)}
                          onChange={() => toggleVia(via.id)}
                          className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                        />
                        <span className="text-sm text-gray-700">{via.nome}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.viaIds.length} via(s) selecionada(s)
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  {editingStop && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingStop.id)}
                      className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-black hover:bg-gray-900 text-white rounded-xl font-semibold transition-colors"
                  >
                    {editingStop ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Lista de Paragens ({stops.length})
                </h2>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {stops.map(stop => (
                    <div
                      key={stop.id}
                      onClick={() => {
                        setEditingStop(stop);
                        setShowForm(true);
                        setSelectedStopOnMap(stop.id);
                        setFormData({
                          nome: stop.nome,
                          codigo: stop.codigo,
                          latitude: stop.latitude,
                          longitude: stop.longitude,
                          viaIds: stop.viaIds,
                          isTerminal: stop.isTerminal || false
                        });
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.flyTo({
                            center: [stop.longitude, stop.latitude],
                            zoom: 15
                          });
                        }
                      }}
                      className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900">{stop.nome}</h3>
                            {stop.isTerminal && (
                              <span className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">Terminal</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">Código: {stop.codigo}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {stop.viaIds.length} via(s) associada(s)
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
