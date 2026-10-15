"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Bus {
  id: string;
  matricula: string;
  via: string;
  viaId: string;
  latitude: number;
  longitude: number;
  status: string;
  capacidade?: number;
}

interface Via {
  id: string;
  nome: string;
  codigo: string;
}

export default function AdminBusesPage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  
  const [buses, setBuses] = useState<Bus[]>([]);
  const [vias, setVias] = useState<Via[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [selectedBusOnMap, setSelectedBusOnMap] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    matricula: "",
    viaId: "",
    latitude: -25.9655,
    longitude: 32.5892,
    status: "ativo",
    capacidade: 50
  });

  const busMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    // Check authentication
    const adminData = localStorage.getItem("admin");
    if (!adminData) {
      router.push("/admin/login");
      return;
    }

    // Fetch data
    fetchBuses();
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

    // Click on map to set bus location
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

  // Update bus markers on map
  useEffect(() => {
    if (!mapInstanceRef.current || buses.length === 0) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    busMarkersRef.current.forEach(marker => marker.remove());
    busMarkersRef.current.clear();

    // Add markers for each bus
    buses.forEach(bus => {
      const el = document.createElement('div');
      el.style.cssText = `
        background: ${selectedBusOnMap === bus.id ? '#ef4444' : '#3b82f6'};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 14px;
      `;
      el.textContent = '🚌';

      const clickHandler = () => {
        setSelectedBusOnMap(bus.id);
        setEditingBus(bus);
        setShowForm(true);
        setFormData({
          matricula: bus.matricula,
          viaId: bus.viaId,
          latitude: bus.latitude,
          longitude: bus.longitude,
          status: bus.status,
          capacidade: bus.capacidade || 50
        });
      };
      
      el.addEventListener('click', clickHandler);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([bus.longitude, bus.latitude])
        .addTo(map);

      busMarkersRef.current.set(bus.id, marker);
    });
  }, [buses, selectedBusOnMap]);

  const fetchBuses = async () => {
    try {
      const response = await fetch('/api/buses');
      const data = await response.json();
      setBuses(data.buses || []);
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
    
    const via = vias.find(v => v.id === formData.viaId);
    if (!via) {
      alert('Por favor selecione uma via válida');
      return;
    }

    const busData = {
      ...formData,
      via: via.nome,
      id: editingBus?.id
    };

    try {
      if (editingBus) {
        const response = await fetch(`/api/bus/${editingBus.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(busData)
        });
        
        if (response.ok) {
          alert('Autocarro atualizado com sucesso!');
          fetchBuses();
          handleCancel();
        }
      } else {
        const response = await fetch('/api/buses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(busData)
        });
        
        if (response.ok) {
          alert('Autocarro criado com sucesso!');
          fetchBuses();
          handleCancel();
        }
      }
    } catch (error) {
      alert('Erro ao guardar autocarro');
    }
  };

  const handleDelete = async (busId: string) => {
    try {
      const response = await fetch(`/api/bus/${busId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        alert('Autocarro eliminado com sucesso!');
        fetchBuses();
        handleCancel();
      }
    } catch (error) {
      alert('Erro ao eliminar autocarro');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBus(null);
    setSelectedBusOnMap(null);
    setFormData({
      matricula: "",
      viaId: "",
      latitude: -25.9655,
      longitude: 32.5892,
      status: "ativo",
      capacidade: 50
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
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
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium text-lg">Voltar ao Painel</span>
            </button>

            <h1 className="text-2xl font-bold text-gray-900">Gerir Autocarros</h1>

            <button
              onClick={() => {
                setShowForm(true);
                setEditingBus(null);
              }}
              className="px-4 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Novo Autocarro</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Map */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Mapa de Autocarros</h2>
              <p className="text-sm text-gray-600">Clique no mapa para definir localização ou clique num autocarro para editar</p>
            </div>
            <div ref={mapRef} className="h-[600px]" />
          </div>

          {/* Form or List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            {showForm ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingBus ? 'Editar Autocarro' : 'Novo Autocarro'}
                </h2>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Matrícula *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.matricula}
                    onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Ex: AAA-123-MZ"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Via *
                  </label>
                  <select
                    required
                    value={formData.viaId}
                    onChange={(e) => setFormData({ ...formData, viaId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">Selecione uma via</option>
                    {vias.map(via => (
                      <option key={via.id} value={via.id}>{via.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Latitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Longitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Status *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="manutencao">Manutenção</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Capacidade
                  </label>
                  <input
                    type="number"
                    value={formData.capacidade}
                    onChange={(e) => setFormData({ ...formData, capacidade: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="50"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 text-slate-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  {editingBus && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingBus.id)}
                      className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-black hover:bg-gray-900 text-white rounded-xl font-semibold transition-colors"
                  >
                    {editingBus ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Lista de Autocarros ({buses.length})
                </h2>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {buses.map(bus => (
                    <div
                      key={bus.id}
                      onClick={() => {
                        setEditingBus(bus);
                        setShowForm(true);
                        setSelectedBusOnMap(bus.id);
                        setFormData({
                          matricula: bus.matricula,
                          viaId: bus.viaId,
                          latitude: bus.latitude,
                          longitude: bus.longitude,
                          status: bus.status,
                          capacidade: bus.capacidade || 50
                        });
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.flyTo({
                            center: [bus.longitude, bus.latitude],
                            zoom: 15
                          });
                        }
                      }}
                      className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900">{bus.matricula}</h3>
                          <p className="text-sm text-gray-600">{bus.via}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Status: <span className={`font-semibold ${
                              bus.status === 'ativo' ? 'text-green-600' : 
                              bus.status === 'inativo' ? 'text-red-600' : 
                              'text-yellow-600'
                            }`}>{bus.status}</span>
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

