"use client";
import LoadingScreen from "../../../components/LoadingScreen";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Motorista {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  status: string;
}

interface Proprietario {
  id: string;
  nome: string;
  bi: string;
  contacto1: number;
  endereco: string;
}

interface Via {
  id: string;
  nome: string;
  codigo: string;
}

interface Transporte {
  id: string;
  matricula: string;
  modelo: string;
  marca: string;
  cor: string;
  lotacao: number;
  codigo: number;
  via: {
    id: string;
    nome: string;
    codigo: string;
  };
  motorista?: Motorista | null;  // Singular, pode ser null
  proprietarios: Array<{
    proprietario: Proprietario;
  }>;
}

export default function EditarTransporte() {
  const router = useRouter();
  const params = useParams();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vias, setVias] = useState<Via[]>([]);
  const [transporte, setTransporte] = useState<Transporte | null>(null);
  const [motoristasDisponiveis, setMotoristasDisponiveis] = useState<Motorista[]>([]);
  const [proprietariosDisponiveis, setProprietariosDisponiveis] = useState<Proprietario[]>([]);
  const [showMotoristaModal, setShowMotoristaModal] = useState(false);
  const [showProprietarioModal, setShowProprietarioModal] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{show: boolean, message: string, onConfirm: () => void} | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };
  
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
    if (params.id) {
      fetchTransporte(params.id as string);
    }
  }, [params.id]);

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
      const result = await response.json();
      setVias(result.data || []);
    } catch (error) {
      showNotification('Erro ao carregar vias', 'error');
    }
  }

  async function fetchMotoristasDisponiveis() {
    try {
      setLoadingModal(true);
      const response = await fetch('/api/motoristas?limit=1000');
      const data = await response.json();
      const motoristas = data.data || [];
      const disponiveis = motoristas.filter((m: any) => 
        m.status === 'ativo' && !m.transporte
      );
      setMotoristasDisponiveis(disponiveis);
    } catch (error) {
      showNotification('Erro ao carregar motoristas', 'error');
    } finally {
      setLoadingModal(false);
    }
  }

  async function fetchProprietariosDisponiveis() {
    try {
      setLoadingModal(true);
      const response = await fetch('/api/proprietarios?limit=1000');
      const data = await response.json();
      const proprietarios = data.data || [];
      setProprietariosDisponiveis(proprietarios);
    } catch (error) {
      showNotification('Erro ao carregar proprietários', 'error');
    } finally {
      setLoadingModal(false);
    }
  }

  async function handleAtribuirMotorista(motoristaId: string) {
    try {
      const response = await fetch(`/api/transportes/${params.id}/atribuir-motorista`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motoristaId })
      });

      if (response.ok) {
        showNotification('Motorista atribuído com sucesso!', 'success');
        setShowMotoristaModal(false);
        fetchTransporte(params.id as string);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao atribuir motorista', 'error');
      }
    } catch (error) {
      showNotification('Erro ao atribuir motorista', 'error');
    }
  }

  async function handleRemoverMotorista() {
    setConfirmModal({
      show: true,
      message: 'Tem certeza que deseja remover este motorista?',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/transportes/${params.id}/atribuir-motorista`, {
            method: 'DELETE'
          });

          if (response.ok) {
            showNotification('Motorista removido com sucesso!', 'success');
            fetchTransporte(params.id as string);
          } else {
            showNotification('Erro ao remover motorista', 'error');
          }
        } catch (error) {
          showNotification('Erro ao remover motorista', 'error');
        }
        setConfirmModal(null);
      }
    });
  }

  async function handleAtribuirProprietario(proprietarioId: string) {
    try {
      const response = await fetch(`/api/transportes/${params.id}/atribuir-proprietario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proprietarioId })
      });

      if (response.ok) {
        showNotification('Proprietário atribuído com sucesso!', 'success');
        setShowProprietarioModal(false);
        fetchTransporte(params.id as string);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao atribuir proprietário', 'error');
      }
    } catch (error) {
      showNotification('Erro ao atribuir proprietário', 'error');
    }
  }

  async function handleRemoverProprietario(proprietarioId: string) {
    setConfirmModal({
      show: true,
      message: 'Tem certeza que deseja remover este proprietário?',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/transportes/${params.id}/atribuir-proprietario`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proprietarioId })
          });

          if (response.ok) {
            showNotification('Proprietário removido com sucesso!', 'success');
            fetchTransporte(params.id as string);
          } else {
            showNotification('Erro ao remover proprietário', 'error');
          }
        } catch (error) {
          showNotification('Erro ao remover proprietário', 'error');
        }
        setConfirmModal(null);
      }
    });
  }

  async function fetchTransporte(id: string) {
    try {
      const response = await fetch(`/api/transportes/${id}`);
      const data = await response.json();
      
      setTransporte(data);
      setFormData({
        matricula: data.matricula || "",
        modelo: data.modelo || "",
        marca: data.marca || "",
        cor: data.cor || "",
        lotacao: data.lotacao || 50,
        ano: data.ano || new Date().getFullYear(),
        viaId: data.via?.id || "",
        latitude: data.latitude || -25.9655,
        longitude: data.longitude || 32.5892,
        estado: data.estado || "ativo",
        kmTotal: data.kmTotal || 0,
        dataProximaManutencao: data.dataProximaManutencao || "",
        dataProximaRevisao: data.dataProximaRevisao || "",
        numeroChasis: data.numeroChasis || "",
        numeroMotor: data.numeroMotor || "",
        capacidadeCombustivel: data.capacidadeCombustivel || 0,
        tipoCombustivel: data.tipoCombustivel || "diesel",
        observacoes: data.observacoes || ""
      });
    } catch (error) {
      console.error('Error fetching transporte:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/transportes/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        showNotification('Transporte atualizado com sucesso!', 'success');
        setTimeout(() => {
          router.push(`/transportes/${params.id}`);
        }, 1000);
      } else {
        showNotification('Erro ao atualizar transporte', 'error');
      }
    } catch (error) {
      showNotification('Erro ao atualizar transporte', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 pt-6 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/transportes/${params.id}`)}
              className="p-2 rounded-lg"
              style={{ transition: 'none' }}
            >
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-black">Editar Transporte</h2>
              <p className="text-black mt-1">{transporte?.matricula || 'Carregando...'}</p>
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
                      placeholder="45230"
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

            {/* Pessoas Associadas - Full Width */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Pessoas Associadas</h3>
                
                <div className="space-y-6">
                  {/* Motorista */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-semibold text-black">Motorista</h4>
                      {!transporte?.motorista && (
                        <button 
                          type="button"
                          onClick={() => {
                            setShowMotoristaModal(true);
                            fetchMotoristasDisponiveis();
                          }}
                          className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium"
                          style={{ transition: 'none' }}
                        >
                          + Atribuir
                        </button>
                      )}
                    </div>
                    {transporte?.motorista ? (
                      <div className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start space-x-3 flex-1 min-w-0">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-bold text-black text-base mb-1.5">{transporte.motorista.nome}</h5>
                              <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                (transporte.motorista as any).status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {(transporte.motorista as any).status || 'ativo'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoverMotorista}
                            className="text-slate-400 flex-shrink-0 ml-2"
                            title="Remover motorista"
                            style={{ transition: 'none' }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="space-y-2.5 text-sm text-black pl-15">
                          <p className="flex items-center">
                            <svg className="w-4 h-4 mr-2 flex-shrink-0 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="truncate">{transporte.motorista.telefone}</span>
                          </p>
                          <p className="flex items-center">
                            <svg className="w-4 h-4 mr-2 flex-shrink-0 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate">{transporte.motorista.email}</span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-black border border-slate-200 rounded-lg bg-slate-50">
                        <svg className="w-10 h-10 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <p className="text-sm font-medium">Nenhum motorista atribuído</p>
                      </div>
                    )}
                  </div>

                  {/* Proprietário */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-semibold text-black">Proprietário</h4>
                      {(!transporte?.proprietarios || transporte.proprietarios.length === 0) && (
                        <button 
                          type="button"
                          onClick={() => {
                            setShowProprietarioModal(true);
                            fetchProprietariosDisponiveis();
                          }}
                          className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium"
                          style={{ transition: 'none' }}
                        >
                          + Atribuir
                        </button>
                      )}
                    </div>
                    {transporte?.proprietarios && transporte.proprietarios.length > 0 ? (
                      <div className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start space-x-3 flex-1 min-w-0">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-bold text-black text-base">{transporte.proprietarios[0].proprietario.nome}</h5>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoverProprietario(transporte.proprietarios[0].proprietario.id)}
                            className="text-slate-400 flex-shrink-0 ml-2"
                            title="Remover proprietário"
                            style={{ transition: 'none' }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="space-y-2.5 text-sm text-black pl-15">
                          <p className="flex items-center">
                            <svg className="w-4 h-4 mr-2 flex-shrink-0 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="truncate">+258 {transporte.proprietarios[0].proprietario.contacto1}</span>
                          </p>
                          <p className="flex items-center">
                            <svg className="w-4 h-4 mr-2 flex-shrink-0 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="truncate">{transporte.proprietarios[0].proprietario.endereco}</span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-black border border-slate-200 rounded-lg bg-slate-50">
                        <svg className="w-10 h-10 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-medium">Nenhum proprietário atribuído</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Localização - Card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Coordenadas</h3>
                
                <div className="space-y-5">
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

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-xs text-black font-medium mb-2">💡 Dica</p>
                    <p className="text-xs text-black">Clique no mapa abaixo para definir a localização automaticamente.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons - Full Width */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push(`/transportes/${params.id}`)}
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
                {saving ? 'Guardando...' : 'Guardar Alterações'}
              </button>
            </div>
          </div>
        </form>

        {/* Modal Motorista */}
        {showMotoristaModal && (
          <div 
            className="fixed inset-0 z-50 backdrop-blur-sm min-h-screen" 
            style={{ minHeight: '100vh', height: '100%' }}
            onClick={() => setShowMotoristaModal(false)}
          >
            <div className="flex items-center justify-center min-h-screen p-4">
              <div 
                className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto my-8"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-black">Atribuir Motorista</h3>
                  <button
                    onClick={() => setShowMotoristaModal(false)}
                    className="text-slate-400"
                    style={{ transition: 'none' }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-3">
                {loadingModal ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                  </div>
                ) : motoristasDisponiveis.length === 0 ? (
                  <p className="text-center text-black py-8">Nenhum motorista disponível</p>
                ) : (
                  motoristasDisponiveis.map((motorista) => (
                    <div
                      key={motorista.id}
                      className="border border-slate-200 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-bold text-black">{motorista.nome}</h4>
                        <p className="text-sm text-black">{motorista.telefone}</p>
                        <p className="text-sm text-black">{motorista.email}</p>
                      </div>
                      <button
                        onClick={() => handleAtribuirMotorista(motorista.id)}
                        className="px-4 py-2 bg-black text-white rounded-lg font-medium"
                        style={{ transition: 'none' }}
                      >
                        Atribuir
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Modal Proprietário */}
        {showProprietarioModal && (
          <div 
            className="fixed inset-0 z-50 backdrop-blur-sm min-h-screen" 
            style={{ minHeight: '100vh', height: '100%' }}
            onClick={() => setShowProprietarioModal(false)}
          >
            <div className="flex items-center justify-center min-h-screen p-4">
              <div 
                className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto my-8"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-black">Atribuir Proprietário</h3>
                  <button
                    onClick={() => setShowProprietarioModal(false)}
                    className="text-slate-400"
                    style={{ transition: 'none' }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-3">
                {loadingModal ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                  </div>
                ) : proprietariosDisponiveis.length === 0 ? (
                  <p className="text-center text-black py-8">Nenhum proprietário disponível</p>
                ) : (
                  proprietariosDisponiveis.map((proprietario) => (
                    <div
                      key={proprietario.id}
                      className="border border-slate-200 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-bold text-black">{proprietario.nome}</h4>
                        <p className="text-sm text-black">BI: {proprietario.bi}</p>
                        <p className="text-sm text-black">+258 {proprietario.contacto1}</p>
                      </div>
                      <button
                        onClick={() => handleAtribuirProprietario(proprietario.id)}
                        className="px-4 py-2 bg-black text-white rounded-lg font-medium"
                        style={{ transition: 'none' }}
                      >
                        Atribuir
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className={`px-6 py-4 rounded-lg shadow-lg border-2 ${
            notification.type === 'success' ? 'bg-green-50 border-green-500 text-green-900' :
            notification.type === 'error' ? 'bg-red-50 border-red-500 text-red-900' :
            'bg-blue-50 border-blue-500 text-blue-900'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className="font-semibold">{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div 
          className="fixed inset-0 z-50 backdrop-blur-sm min-h-screen" 
          style={{ minHeight: '100vh', height: '100%' }}
          onClick={() => setConfirmModal(null)}
        >
          <div className="flex items-center justify-center min-h-screen p-4">
            <div 
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start space-x-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-black mb-2">Confirmar Ação</h3>
                  <p className="text-black">{confirmModal.message}</p>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 border-2 border-slate-300 text-black rounded-lg font-semibold"
                  style={{ transition: 'none' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold"
                  style={{ transition: 'none' }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
