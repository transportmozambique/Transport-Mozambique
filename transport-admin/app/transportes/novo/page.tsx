"use client";
import LoadingScreen from "../../components/LoadingScreen";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Via {
  id: string;
  nome: string;
  codigo: string;
}

export default function NovoTransporte() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [vias, setVias] = useState<Via[]>([]);
  
  const [formData, setFormData] = useState({
    matricula: "",
    modelo: "",
    marca: "",
    cor: "",
    lotacao: 50,
    ano: new Date().getFullYear(),
    viaId: "",
    latitude: -25.9655,
    longitude: 32.5892,
    estado: "ativo",
    kmTotal: 0,
    dataProximaManutencao: "",
    dataProximaRevisao: "",
    numeroChasis: "",
    numeroMotor: "",
    capacidadeCombustivel: 0,
    tipoCombustivel: "diesel",
    observacoes: ""
  });

  useEffect(() => {
    fetchVias();
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [formData.longitude, formData.latitude],
      zoom: 13,
      pitch: 60,
      bearing: -17.6,
    });

    mapInstanceRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // Add 3D buildings
    map.on('load', () => {
      const layers = map.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
      )?.id;

      map.addLayer(
        {
          id: '3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
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
        },
        labelLayerId
      );
    });

    // Click to set location
    map.on('click', (e) => {
      setFormData(prev => ({
        ...prev,
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng
      }));
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker when coordinates change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (markerRef.current) {
      markerRef.current.remove();
    }

    const el = document.createElement('div');
    el.style.cssText = `
      background: #1e293b;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 4px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      cursor: default;
    `;
    el.textContent = '🚌';

    markerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([formData.longitude, formData.latitude])
      .addTo(mapInstanceRef.current);

    mapInstanceRef.current.flyTo({
      center: [formData.longitude, formData.latitude],
      zoom: 15,
      pitch: 60,
      bearing: -17.6,
    });
  }, [formData.latitude, formData.longitude]);

  async function fetchVias() {
    try {
      const response = await fetch('/api/vias?limit=1000');
      const data = await response.json();
      setVias(data.data || []);
    } catch (error) {
      console.error('Error fetching vias:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/transportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        showNotification('Transporte criado com sucesso!', 'success');
        setTimeout(() => {
          router.push(`/transportes/${data.id}`);
        }, 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao criar transporte', 'error');
      }
    } catch (error) {
      console.error('Erro ao criar transporte:', error);
      showNotification('Erro ao criar transporte', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingScreen layout="admin" />;
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

      <div className="max-w-[1600px] mx-auto px-6 pt-6 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/transportes')}
              className="p-2 rounded-lg"
              style={{ transition: 'none' }}
            >
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-black">Novo Transporte</h2>
              <p className="text-black mt-1">Adicione um novo transporte ao sistema</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form Cards - Full Width */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Informações Básicas */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Informações Básicas</h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Matrícula *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.matricula}
                      onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                      placeholder="Ex: AAA-123-MZ"
                      style={{ transition: 'none' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Modelo *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.modelo}
                        onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                        placeholder="Ex: Hiace"
                        style={{ transition: 'none' }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Marca *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.marca}
                        onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                        placeholder="Ex: Toyota"
                        style={{ transition: 'none' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Cor *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.cor}
                        onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                        placeholder="Ex: Branco"
                        style={{ transition: 'none' }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Ano *
                      </label>
                      <input
                        type="number"
                        required
                        min="1990"
                        max={new Date().getFullYear() + 1}
                        value={formData.ano}
                        onChange={(e) => setFormData({ ...formData, ano: parseInt(e.target.value) || new Date().getFullYear() })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                        placeholder="2020"
                        style={{ transition: 'none' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Lotação *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.lotacao}
                        onChange={(e) => setFormData({ ...formData, lotacao: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                        placeholder="50"
                        style={{ transition: 'none' }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Estado *
                      </label>
                      <select
                        required
                        value={formData.estado}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black bg-white"
                        style={{ transition: 'none' }}
                      >
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                        <option value="manutencao">Em Manutenção</option>
                        <option value="avariado">Avariado</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Via *
                    </label>
                    <select
                      required
                      value={formData.viaId}
                      onChange={(e) => setFormData({ ...formData, viaId: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black bg-white"
                      style={{ transition: 'none' }}
                    >
                      <option value="">Selecione uma via</option>
                      {vias.map(via => (
                        <option key={via.id} value={via.id}>{via.nome} ({via.codigo})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Informações Técnicas */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Informações Técnicas</h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Número do Chassis
                    </label>
                    <input
                      type="text"
                      value={formData.numeroChasis}
                      onChange={(e) => setFormData({ ...formData, numeroChasis: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                      placeholder="Ex: 1HGBH41JXMN109186"
                      style={{ transition: 'none' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Número do Motor
                    </label>
                    <input
                      type="text"
                      value={formData.numeroMotor}
                      onChange={(e) => setFormData({ ...formData, numeroMotor: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                      placeholder="Ex: 2TR-FE-1234567"
                      style={{ transition: 'none' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Tipo Combustível
                      </label>
                      <select
                        value={formData.tipoCombustivel}
                        onChange={(e) => setFormData({ ...formData, tipoCombustivel: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black bg-white"
                        style={{ transition: 'none' }}
                      >
                        <option value="diesel">Diesel</option>
                        <option value="gasolina">Gasolina</option>
                        <option value="hibrido">Híbrido</option>
                        <option value="eletrico">Elétrico</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">
                        Capacidade (L)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.capacidadeCombustivel}
                        onChange={(e) => setFormData({ ...formData, capacidadeCombustivel: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                        placeholder="70"
                        style={{ transition: 'none' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Quilometragem Total (km)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.kmTotal}
                      onChange={(e) => setFormData({ ...formData, kmTotal: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                      placeholder="0"
                      style={{ transition: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* Manutenção */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Manutenção</h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Próxima Manutenção
                    </label>
                    <input
                      type="date"
                      value={formData.dataProximaManutencao}
                      onChange={(e) => setFormData({ ...formData, dataProximaManutencao: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                      style={{ transition: 'none' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-black mb-2">
                      Próxima Revisão
                    </label>
                    <input
                      type="date"
                      value={formData.dataProximaRevisao}
                      onChange={(e) => setFormData({ ...formData, dataProximaRevisao: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                      style={{ transition: 'none' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Observações - Full Width */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Observações</h3>
              
              <div>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black resize-none"
                  placeholder="Adicione notas ou observações sobre o transporte..."
                  style={{ transition: 'none' }}
                />
              </div>
            </div>

            {/* Coordenadas - Full Width */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Coordenadas</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                    style={{ transition: 'none' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-black"
                    style={{ transition: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons - Full Width */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push('/transportes')}
                className="px-6 py-3 border-2 border-slate-300 text-black rounded-lg font-semibold"
                style={{ transition: 'none' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-slate-900 text-white rounded-lg font-semibold disabled:bg-slate-400"
                style={{ transition: 'none' }}
              >
                {saving ? 'Criando...' : 'Criar Transporte'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
