"use client";
import LoadingScreen from "../../components/LoadingScreen";
import GpsTrackerCard from "../../components/GpsTrackerCard";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
  telefone: string;
  email: string;
}

interface Stop {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  isTerminal: boolean;
}

interface Posicao {
  latitude: number;
  longitude: number;
  fonte: "gps" | "horario";
  emMovimento: boolean;
  foraDeServico: boolean;
  velocidadeKmh: number;
  atualizadoEm: string;
  proximaParagem: string | null;
  minutosAteProxima: number | null;
}

// A viagem em curso do veículo, desde que o motorista a iniciou (GET /api/transportes/[id]/operacao)
interface Operacao {
  comprimentoKm: number;
  minutosPorSentido: number;
  paragens: number;
  horasHoje: number;
  kmHoje: number;
  viagensHoje: number;
  porHora: { hora: string; km: number; kmAcumulado: number; viagens: number }[];
  passagens: { nome: string; km: number; ida: string | null; volta: string | null }[];
  emViagem: boolean;
  iniciadaEm: string | null;
  ida: string;
  volta: string;
}

// "HH:MM" em Maputo, com "amanhã" quando não é hoje
function horaMaputo(iso: string): string {
  const at = new Date(iso);
  const day = (d: Date) => d.toLocaleDateString('pt-PT', { timeZone: 'Africa/Maputo' });
  const clock = at.toLocaleTimeString('pt-PT', { timeZone: 'Africa/Maputo', hour: '2-digit', minute: '2-digit' });
  return day(at) === day(new Date()) ? clock : `amanhã ${clock}`;
}

// Esperas curtas em minutos; as longas (de noite o primeiro autocarro é às 05:00) como a hora de Maputo
function formatMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const at = new Date(Date.now() + minutos * 60000);
  const day = (d: Date) => d.toLocaleDateString('pt-PT', { timeZone: 'Africa/Maputo' });
  const clock = at.toLocaleTimeString('pt-PT', { timeZone: 'Africa/Maputo', hour: '2-digit', minute: '2-digit' });
  return `${day(at) !== day(new Date()) ? 'amanhã às' : 'às'} ${clock}`;
}

interface Transporte {
  id: string;
  matricula: string;
  modelo: string;
  marca: string;
  cor: string;
  lotacao: number;
  codigo: number;
  createdAt: string;
  latitude?: number;
  longitude?: number;
  routeCoords?: [number, number][];
  stops?: Stop[];
  posicao?: Posicao | null;
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

export default function TransporteDetalhes() {
  const router = useRouter();
  const params = useParams();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  
  const [transporte, setTransporte] = useState<Transporte | null>(null);
  // Posição ao vivo (GPS real ou horário), actualizada enquanto a página está aberta
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const busMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showMotoristaModal, setShowMotoristaModal] = useState(false);
  const [showProprietarioModal, setShowProprietarioModal] = useState(false);
  const [motoristasDisponiveis, setMotoristasDisponiveis] = useState<Motorista[]>([]);
  const [proprietariosDisponiveis, setProprietariosDisponiveis] = useState<Proprietario[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hasAssociations, setHasAssociations] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Quilómetros, viagens e horas nas paragens do dia (horário), actualizados a cada minuto
  const [operacao, setOperacao] = useState<Operacao | null>(null);
  useEffect(() => {
    if (!params.id) return;
    let alive = true;
    const load = () =>
      fetch(`/api/transportes/${params.id}/operacao`)
        .then((r) => (r.ok ? r.json() : null))
        .then((o: Operacao | null) => { if (alive) setOperacao(o); })
        .catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      fetchTransporte(params.id as string);
    }
  }, [params.id]);

  useEffect(() => {
    if (!params.id) return;
    const load = async () => {
      const r = await fetch(`/api/transportes/${params.id}/posicao`);
      if (!r.ok) return;
      const p: Posicao | null = await r.json();
      setPosicao(p);
      if (p) busMarkerRef.current?.setLngLat([p.longitude, p.latitude]);
    };
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [params.id]);

  useEffect(() => {
    if (!mapRef.current || !transporte) {
      return;
    }
    
    if (mapInstanceRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [transporte.longitude || 32.5892, transporte.latitude || -25.9655],
      zoom: 15,
      pitch: 60,
      bearing: -17.6,
    });

    mapInstanceRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on('load', () => {
      // Edifícios em 3D
      const layers = map.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
      )?.id;

      map.addLayer(
        {
          id: '3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          filter: ['!=', ['get', 'hide_3d'], true],
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
              ['get', 'render_height']
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'render_min_height']
            ],
            'fill-extrusion-opacity': 0.6
          }
        },
        labelLayerId
      );

      // Linha da via vinda da base de dados: o percurso guardado já segue as estradas
      if (transporte.routeCoords && transporte.routeCoords.length > 0) {
        drawRoute(transporte.routeCoords);
      } else {
        // Sem percurso da via, as paragens e o marcador do autocarro
        addStops();
        addBusMarker();
      }

      // As paragens da via: cinzentas, os terminais pretos com um T; o nome ao clicar
      function addStops() {
        transporte?.stops?.forEach((stop) => {
          const size = stop.isTerminal ? "18px" : "14px";
          const el = document.createElement("div");
          el.style.cssText = `
            width: ${size};
            height: ${size};
            background: ${stop.isTerminal ? "#1e293b" : "#6b7280"};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            color: white;
          `;
          if (stop.isTerminal) el.textContent = "T";

          const popup = document.createElement("div");
          popup.style.color = "#000";
          const nome = document.createElement("strong");
          nome.textContent = stop.nome;
          popup.appendChild(nome);
          if (stop.isTerminal) popup.append(document.createElement("br"), "Terminal");

          new maplibregl.Marker({ element: el })
            .setLngLat([stop.longitude, stop.latitude])
            .setPopup(new maplibregl.Popup({ offset: 15 }).setDOMContent(popup))
            .addTo(map);
        });
      }

      // Desenhar a via
      function drawRoute(coordinates: [number, number][]) {
        // Linha da via
        map.addSource('route', {
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
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#1e293b',
            'line-width': 6,
            'line-opacity': 0.8
          }
        });

        // Contorno animado da via
        map.addLayer({
          id: 'route-outline',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': 8,
            'line-opacity': 0.4
          }
        }, 'route');

        // As paragens da via
        addStops();

        // Marcador do autocarro
        addBusMarker();

        // Enquadrar o mapa na via inteira
        const bounds = new maplibregl.LngLatBounds();
        coordinates.forEach((coord) => bounds.extend(coord));
        map.fitBounds(bounds, { padding: 50 });
      }

      // Juntar o marcador do autocarro
      function addBusMarker() {
        if (transporte && transporte.latitude && transporte.longitude) {
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
          el.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 10h16M8 17v3M16 17v3"/></svg>';

          busMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([transporte.longitude, transporte.latitude])
            .setPopup(
              new maplibregl.Popup({ offset: 30 }).setHTML(
                `<div style="color: #000;"><strong>${transporte.matricula}</strong><br>${transporte.via?.nome || 'Sem via'}</div>`
              )
            )
            .addTo(map);
        }
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [transporte]);

  async function fetchTransporte(id: string) {
    try {
      const response = await fetch(`/api/transportes/${id}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        showNotification(`Erro ${response.status}: ${errorText}`, 'error');
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      setTransporte(data);
    } catch (error: any) {
      showNotification(error?.message || 'Erro ao carregar transporte', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchMotoristasDisponiveis() {
    try {
      setLoadingModal(true);
      const response = await fetch('/api/motoristas?limit=1000');
      const data = await response.json();
      const motoristas = data.data || [];
      // Só os motoristas livres (activos e sem transporte)
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
    try {
      const response = await fetch(`/api/transportes/${params.id}/atribuir-motorista`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showNotification('Motorista removido com sucesso!', 'success');
        fetchTransporte(params.id as string);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao remover motorista', 'error');
      }
    } catch (error) {
      showNotification('Erro ao remover motorista', 'error');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    setHasAssociations(false);
    
    try {
      const response = await fetch(`/api/transportes/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Transporte eliminado com sucesso!', 'success');
        setTimeout(() => {
          router.push('/transportes');
        }, 1500);
      } else {
        const error = await response.json();
        
        // O erro é sobre a ligação a um motorista ou a proprietários?
        if (error.error && (error.error.includes('motorista') || error.error.includes('proprietários'))) {
          setDeleteError(error.details || error.error);
          setHasAssociations(true);
        } else {
          showNotification(error.details || error.error || 'Erro ao eliminar transporte', 'error');
          setShowDeleteModal(false);
        }
      }
    } catch (error) {
      console.error('Erro ao eliminar transporte:', error);
      showNotification('Erro ao eliminar transporte', 'error');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemoveAssociationsAndDelete() {
    setDeleting(true);
    
    try {
      // Primeiro tirar a ligação ao motorista
      if (transporte?.motorista) {
        const removeMotoristaResponse = await fetch(`/api/transportes/${params.id}/atribuir-motorista`, {
          method: 'DELETE'
        });

        if (!removeMotoristaResponse.ok) {
          showNotification('Erro ao remover motorista', 'error');
          setDeleting(false);
          return;
        }
      }

      // Depois tirar todas as ligações a proprietários
      if (transporte?.proprietarios && transporte.proprietarios.length > 0) {
        for (const prop of transporte.proprietarios) {
          const removeProprietarioResponse = await fetch(`/api/transportes/${params.id}/atribuir-proprietario`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proprietarioId: prop.proprietario.id })
          });

          if (!removeProprietarioResponse.ok) {
            showNotification('Erro ao remover proprietário', 'error');
            setDeleting(false);
            return;
          }
        }
      }

      // Por fim, apagar o transporte
      const deleteResponse = await fetch(`/api/transportes/${params.id}`, {
        method: 'DELETE',
      });

      if (deleteResponse.ok) {
        showNotification('Transporte eliminado com sucesso!', 'success');
        setTimeout(() => {
          router.push('/transportes');
        }, 1500);
      } else {
        const error = await deleteResponse.json();
        showNotification(error.details || error.error || 'Erro ao eliminar transporte', 'error');
      }
    } catch (error) {
      console.error('Erro ao eliminar transporte:', error);
      showNotification('Erro ao eliminar transporte', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
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
  }

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  if (!transporte) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-900">Transporte não encontrado</p>
        <button onClick={() => router.push('/transportes')} className="mt-4 text-slate-900" style={{ transition: 'none' }}>
          Voltar para lista
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/transportes')}
              className="p-2 rounded-xl"
              style={{ transition: 'none' }}
            >
              <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{transporte.matricula}</h2>
              <p className="text-slate-900 mt-1">{transporte.modelo} - {transporte.marca}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/transportes/${transporte.id}/editar`)}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium flex items-center space-x-2"
              style={{ transition: 'none' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Editar</span>
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium flex items-center space-x-2"
              style={{ transition: 'none' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        {/* Diálogo de confirmação do apagar */}
        {showDeleteModal && transporte && (
          <div 
            className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm min-h-screen" 
            style={{ minHeight: '100vh', height: '100%' }}
            onClick={() => !deleting && setShowDeleteModal(false)}
          >
            <div className="flex items-center justify-center min-h-screen p-4">
              <div 
                className="relative z-[101] bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-slate-200 my-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4 ${
                  hasAssociations ? 'bg-gradient-to-br from-slate-100 to-slate-200/30' : 'bg-slate-200'
                }`}>
                  <svg className={`w-6 h-6 ${hasAssociations ? 'text-slate-900' : 'text-slate-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {hasAssociations ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    )}
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
                  {hasAssociations ? 'Remover Associações' : 'Eliminar Transporte'}
                </h3>
                
                {hasAssociations ? (
                  <div className="space-y-4">
                    <p className="text-slate-600 text-center">
                      {deleteError}
                    </p>
                    <div className="bg-white rounded-xl p-4">
                      <p className="text-sm text-slate-900 text-center font-medium">
                        Clique em <strong>"Remover e Eliminar"</strong> para remover as associações e eliminar o transporte.
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          setShowDeleteModal(false);
                          setDeleteError(null);
                          setHasAssociations(false);
                        }}
                        disabled={deleting}
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleRemoveAssociationsAndDelete}
                        disabled={deleting}
                        className="flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleting ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>Processando...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Remover e Eliminar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-slate-600 text-center mb-6">
                      Tem certeza que deseja eliminar o transporte <strong className="text-slate-900">"{transporte.matricula}"</strong>?
                      <br />
                      <span className="text-sm text-slate-900 font-medium">Esta ação não pode ser desfeita.</span>
                    </p>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setShowDeleteModal(false)}
                        disabled={deleting}
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleting ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>Eliminando...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Eliminar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cartões de estatísticas: a viagem em curso, desde que o motorista a iniciou */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="operacao-cards">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-900 font-medium mb-1">Quilómetros na Viagem</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">{operacao ? `${operacao.kmHoje} km` : '—'}</p>
                <p className="mt-2 text-xs text-slate-600">{!operacao ? 'Sem rota atribuída' : operacao.emViagem ? 'desde o início da viagem' : 'O motorista não iniciou a viagem'}</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-900 font-medium mb-1">Tempo de Operação</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">{operacao ? `${operacao.horasHoje.toLocaleString('pt-PT')} h` : '—'}</p>
                <p className="mt-2 text-xs text-slate-600">{operacao?.iniciadaEm ? `Viagem iniciada às ${horaMaputo(operacao.iniciadaEm)}` : 'Sem viagem em curso'}</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-900 font-medium mb-1">Chegadas a um Terminal</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">{operacao ? operacao.viagensHoje : '—'}</p>
                <p className="mt-2 text-xs text-slate-600">{operacao ? `nesta viagem · ${operacao.minutosPorSentido} min por sentido` : 'Sem rota atribuída'}</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-900 font-medium mb-1">Rota</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">{operacao ? `${operacao.comprimentoKm.toLocaleString('pt-PT')} km` : '—'}</p>
                <p className="mt-2 text-xs text-slate-600">{operacao ? `${operacao.paragens} paragens` : 'Sem rota atribuída'}</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Mapa, largura inteira */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Localização e Rota</h3>
                <p className="text-sm text-slate-900">Posição em tempo real com visualização 3D</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-slate-100 text-slate-900 rounded-full text-xs font-semibold flex items-center" data-testid="position-status">
                  <span className={`w-2 h-2 rounded-full mr-2 ${posicao?.emMovimento ? 'bg-slate-900 animate-pulse' : 'bg-slate-500'}`}></span>
                  {!posicao
                    ? 'Sem localização'
                    : posicao.foraDeServico
                      ? 'Fora de serviço (viagem não iniciada)'
                      : posicao.emMovimento
                        ? 'Em movimento'
                        : 'Parado no terminal'}
                  {posicao && ` · ${posicao.fonte === 'gps' ? 'GPS real' : posicao.foraDeServico ? 'onde parou' : 'estimado pela viagem'}`}
                </span>
              </div>
            </div>
          </div>
          <div ref={mapRef} className="h-[600px]" />
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="grid grid-cols-3 gap-4 text-center" data-testid="position-footer">
              <div>
                <p className="text-xs text-slate-900 mb-1 font-medium">Velocidade Atual</p>
                <p className="text-lg font-bold text-slate-900">{posicao ? `${Math.round(posicao.velocidadeKmh)} km/h` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-900 mb-1 font-medium">Próxima Paragem</p>
                <p className="text-lg font-bold text-slate-900">{posicao?.proximaParagem ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-900 mb-1 font-medium">Tempo Estimado</p>
                <p className="text-lg font-bold text-slate-900">{posicao?.minutosAteProxima != null ? formatMinutos(posicao.minutosAteProxima) : '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <GpsTrackerCard transporteId={transporte.id} />

        {/* Pessoas Associadas - Motorista e Proprietário lado a lado */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6" style={{ transition: 'none' }}>
          <h3 className="text-lg font-bold text-slate-900 mb-6 pb-3 border-b border-slate-200">Pessoas Associadas</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ transition: 'none' }}>
            {/* Motorista */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-slate-900">Motorista</h4>
                {!transporte.motorista && (
                  <button 
                    onClick={() => {
                      setShowMotoristaModal(true);
                      fetchMotoristasDisponiveis();
                    }}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-medium"
                  >
                    + Atribuir
                  </button>
                )}
              </div>
              {transporte.motorista ? (
                <div 
                  onClick={() => router.push(`/motoristas/${transporte.motorista!.id}`)}
                  className="border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-400 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-slate-900 text-base mb-1.5">{transporte.motorista.nome}</h5>
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          (transporte.motorista as any).status === 'ativo' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {(transporte.motorista as any).status || 'ativo'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoverMotorista();
                      }}
                      className="text-slate-400 hover:text-slate-900 flex-shrink-0 ml-2 transition-colors"
                      title="Remover motorista"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-2.5 text-sm text-slate-900 pl-15">
                    <p className="flex items-center">
                      <svg className="w-4 h-4 mr-2 flex-shrink-0 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="truncate">{transporte.motorista.telefone}</span>
                    </p>
                    <p className="flex items-center">
                      <svg className="w-4 h-4 mr-2 flex-shrink-0 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{transporte.motorista.email}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-900 border border-slate-200 rounded-xl bg-slate-50">
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
                <h4 className="text-base font-semibold text-slate-900">Proprietário</h4>
                {(!transporte.proprietarios || transporte.proprietarios.length === 0) && (
                  <button 
                    onClick={() => {
                      setShowProprietarioModal(true);
                      fetchProprietariosDisponiveis();
                    }}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-medium"
                  >
                    + Atribuir
                  </button>
                )}
              </div>
              {transporte.proprietarios && transporte.proprietarios.length > 0 ? (
                <div 
                  onClick={() => router.push(`/proprietarios/${transporte.proprietarios[0].proprietario.id}`)}
                  className="border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-400 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-slate-900 text-base">{transporte.proprietarios[0].proprietario.nome}</h5>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoverProprietario(transporte.proprietarios[0].proprietario.id);
                      }}
                      className="text-slate-400 hover:text-slate-900 flex-shrink-0 ml-2 transition-colors"
                      title="Remover proprietário"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-2.5 text-sm text-slate-900 pl-15">
                    <p className="flex items-center">
                      <svg className="w-4 h-4 mr-2 flex-shrink-0 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="truncate">+258 {(transporte.proprietarios[0].proprietario as any).contacto1}</span>
                    </p>
                    <p className="flex items-center">
                      <svg className="w-4 h-4 mr-2 flex-shrink-0 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span className="truncate">{(transporte.proprietarios[0].proprietario as any).endereco}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-900 border border-slate-200 rounded-xl bg-slate-50">
                  <svg className="w-10 h-10 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-medium">Nenhum proprietário atribuído</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Informações do Transporte - Full Width */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6 pb-3 border-b border-slate-200">Informações do Transporte</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            <div>
              <p className="text-xs text-slate-900 uppercase tracking-wide font-medium mb-2">Matrícula</p>
              <p className="text-sm font-bold text-slate-900">{transporte.matricula}</p>
            </div>
            <div>
              <p className="text-xs text-slate-900 uppercase tracking-wide font-medium mb-2">Código</p>
              <p className="text-sm font-semibold text-slate-900">{transporte.codigo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-900 uppercase tracking-wide font-medium mb-2">Modelo</p>
              <p className="text-sm font-semibold text-slate-900">{transporte.modelo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-900 uppercase tracking-wide font-medium mb-2">Marca</p>
              <p className="text-sm font-semibold text-slate-900">{transporte.marca}</p>
            </div>
            <div>
              <p className="text-xs text-slate-900 uppercase tracking-wide font-medium mb-2">Cor</p>
              <p className="text-sm font-semibold text-slate-900">{transporte.cor}</p>
            </div>
            <div>
              <p className="text-xs text-slate-900 uppercase tracking-wide font-medium mb-2">Lotação</p>
              <p className="text-sm font-semibold text-slate-900">{transporte.lotacao} lugares</p>
            </div>
            <div>
              <p className="text-xs text-slate-900 uppercase tracking-wide font-medium mb-2">Via</p>
              <p className="text-sm font-semibold text-slate-900">{transporte.via?.nome || 'Não atribuída'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-900 uppercase tracking-wide font-medium mb-2">Código Via</p>
              <p className="text-sm font-semibold text-slate-900">{transporte.via?.codigo || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-900 uppercase tracking-wide font-medium mb-2">Estado</p>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-block ${
                !transporte.via ? 'bg-slate-100 text-slate-600' : posicao?.foraDeServico ? 'bg-slate-200 text-slate-800' : 'bg-slate-900 text-white'
              }`}>
                {!transporte.via ? 'Sem rota' : posicao?.foraDeServico ? 'Fora de serviço' : 'Em serviço'}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-900 uppercase tracking-wide font-medium mb-2">Registado em</p>
              <p className="text-sm font-semibold text-slate-900">{new Date(transporte.createdAt).toLocaleDateString('pt-PT')}</p>
            </div>
          </div>
        </div>

        {/* Gráficos: a viagem em curso, por hora */}
        {operacao && operacao.porHora.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Quilómetros na Viagem</h3>
                  <p className="text-sm text-slate-900">Acumulado por hora, desde o início da viagem</p>
                </div>
                <div className="px-3 py-1 bg-slate-100 text-slate-900 rounded-xl text-xs font-semibold">Hoje</div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={operacao.porHora}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hora" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} unit=" km" width={70} />
                  <Tooltip
                    formatter={(v) => [`${v} km`, 'Acumulado']}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Line type="monotone" dataKey="kmAcumulado" stroke="#1e293b" strokeWidth={3} dot={{ fill: '#1e293b', r: 3 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Chegadas por Hora</h3>
                  <p className="text-sm text-slate-900">Chegadas a um terminal, desde o início da viagem</p>
                </div>
                <div className="px-3 py-1 bg-slate-100 text-slate-900 rounded-xl text-xs font-semibold">Hoje</div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={operacao.porHora}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hora" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v) => [v, 'Viagens']}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Bar dataKey="viagens" fill="#475569" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Próxima passagem em cada paragem, nos dois sentidos */}
        {operacao && operacao.passagens.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6" data-testid="passagens">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900">Próximas Passagens nas Paragens</h3>
              <p className="text-sm text-slate-900">
                {operacao.emViagem
                  ? 'Pela viagem em curso; com GPS ativo o autocarro pode estar adiantado ou atrasado'
                  : 'Sem passagens: o motorista não iniciou a viagem'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">
                    <th className="hidden py-2 pr-4 font-medium sm:table-cell">#</th>
                    <th className="py-2 pr-4 font-medium">Paragem</th>
                    <th className="hidden py-2 pr-4 font-medium sm:table-cell">Km</th>
                    <th className="py-2 pr-4 font-medium">Sentido {operacao.ida}</th>
                    <th className="py-2 font-medium">Sentido {operacao.volta}</th>
                  </tr>
                </thead>
                <tbody>
                  {operacao.passagens.map((p, i) => (
                    <tr key={`${p.nome}-${i}`} className="border-b border-slate-100 last:border-0">
                      <td className="hidden py-2 pr-4 text-slate-500 sm:table-cell">{i + 1}</td>
                      <td className="py-2 pr-4 font-medium text-slate-900">{p.nome}</td>
                      <td className="hidden py-2 pr-4 text-slate-600 sm:table-cell">{p.km.toLocaleString('pt-PT')}</td>
                      <td className="py-2 pr-4 text-slate-900">{p.ida ? horaMaputo(p.ida) : '—'}</td>
                      <td className="py-2 text-slate-900">{p.volta ? horaMaputo(p.volta) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Notificação */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className={`px-6 py-4 rounded-xl shadow-lg border-2 ${
            notification.type === 'success' ? 'bg-slate-50 border-slate-600 text-slate-900' :
            notification.type === 'error' ? 'bg-slate-100 border-slate-700 text-slate-900' :
            'bg-slate-50 border-slate-600 text-slate-900'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className="font-semibold">{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Motorista */}
      {showMotoristaModal && (
        <div 
          className="fixed inset-0 z-50 backdrop-blur-sm min-h-screen" 
          style={{ minHeight: '100vh', height: '100%' }}
          onClick={() => setShowMotoristaModal(false)}
        >
          <div className="flex items-center justify-center min-h-screen p-4">
            <div 
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">Atribuir Motorista</h3>
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
                  <p className="text-center text-slate-900 py-8">Nenhum motorista disponível</p>
                ) : (
                  motoristasDisponiveis.map((motorista) => (
                    <div
                      key={motorista.id}
                      className="border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-slate-400 transition-colors"
                    >
                      <div>
                        <h4 className="font-bold text-slate-900">{motorista.nome}</h4>
                        <p className="text-sm text-slate-900">{motorista.telefone}</p>
                        <p className="text-sm text-slate-900">{motorista.email}</p>
                      </div>
                      <button
                        onClick={() => handleAtribuirMotorista(motorista.id)}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium"
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
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">Atribuir Proprietário</h3>
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
                  <p className="text-center text-slate-900 py-8">Nenhum proprietário disponível</p>
                ) : (
                  proprietariosDisponiveis.map((proprietario) => (
                    <div
                      key={proprietario.id}
                      className="border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-slate-400 transition-colors"
                    >
                      <div>
                        <h4 className="font-bold text-slate-900">{proprietario.nome}</h4>
                        <p className="text-sm text-slate-900">{proprietario.telefone}</p>
                        <p className="text-sm text-slate-900">{proprietario.email}</p>
                      </div>
                      <button
                        onClick={() => handleAtribuirProprietario(proprietario.id)}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium"
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
  );
}
