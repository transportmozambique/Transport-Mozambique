"use client";
import LoadingScreen from "../../components/LoadingScreen";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

  // Verificar se o transporte foi criado hoje (é novo)
  const isNewTransport = (createdAt: string) => {
    const created = new Date(createdAt);
    const today = new Date();
    return created.toDateString() === today.toDateString();
  };

  // Dados simulados para gráficos (em produção viriam do banco de dados)
  // Se o transporte for novo, todos os valores começam em 0
  const consumoSemanalData = transporte && isNewTransport(transporte.createdAt) ? [
    { dia: 'Seg', litros: 0 },
    { dia: 'Ter', litros: 0 },
    { dia: 'Qua', litros: 0 },
    { dia: 'Qui', litros: 0 },
    { dia: 'Sex', litros: 0 },
    { dia: 'Sáb', litros: 0 },
    { dia: 'Dom', litros: 0 },
  ] : [
    { dia: 'Seg', litros: 42 },
    { dia: 'Ter', litros: 48 },
    { dia: 'Qua', litros: 45 },
    { dia: 'Qui', litros: 50 },
    { dia: 'Sex', litros: 47 },
    { dia: 'Sáb', litros: 38 },
    { dia: 'Dom', litros: 35 },
  ];

  const quilometrosDiariosData = transporte && isNewTransport(transporte.createdAt) ? [
    { hora: '06:00', km: 0 },
    { hora: '08:00', km: 0 },
    { hora: '10:00', km: 0 },
    { hora: '12:00', km: 0 },
    { hora: '14:00', km: 0 },
    { hora: '16:00', km: 0 },
    { hora: '18:00', km: 0 },
  ] : [
    { hora: '06:00', km: 0 },
    { hora: '08:00', km: 45 },
    { hora: '10:00', km: 92 },
    { hora: '12:00', km: 138 },
    { hora: '14:00', km: 185 },
    { hora: '16:00', km: 220 },
    { hora: '18:00', km: 247 },
  ];

  const zonasFrequentesData = transporte && isNewTransport(transporte.createdAt) ? [
    { nome: 'Baixa de Maputo', tempo: 0, cor: '#1e293b' },
    { nome: 'Costa do Sol', tempo: 0, cor: '#475569' },
    { nome: 'Matola', tempo: 0, cor: '#64748b' },
    { nome: 'Sommerschield', tempo: 0, cor: '#94a3b8' },
    { nome: 'Outras', tempo: 0, cor: '#cbd5e1' },
  ] : [
    { nome: 'Baixa de Maputo', tempo: 35, cor: '#1e293b' },
    { nome: 'Costa do Sol', tempo: 25, cor: '#475569' },
    { nome: 'Matola', tempo: 20, cor: '#64748b' },
    { nome: 'Sommerschield', tempo: 12, cor: '#94a3b8' },
    { nome: 'Outras', tempo: 8, cor: '#cbd5e1' },
  ];

  useEffect(() => {
    if (params.id) {
      fetchTransporte(params.id as string);
    }
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
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [transporte.longitude || 32.5892, transporte.latitude || -25.9655],
      zoom: 15,
      pitch: 60,
      bearing: -17.6,
    });

    mapInstanceRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on('load', () => {
      // Add 3D buildings
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

      // Add route line if available from database
      if (transporte.routeCoords && transporte.routeCoords.length > 0) {
        // Use OSRM to get road-following route
        const waypointsString = transporte.routeCoords.map(w => `${w[0]},${w[1]}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson&steps=true`;

        fetch(osrmUrl)
          .then(response => response.json())
          .then(data => {
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
              const routeGeometry = data.routes[0].geometry;
              drawRoute(routeGeometry.coordinates);
            } else {
              drawRoute(transporte.routeCoords!);
            }
          })
          .catch(error => {
            drawRoute(transporte.routeCoords!);
          });
      } else {
        // If no route data, just show the bus marker
        addBusMarker();
      }

      // Function to draw route
      function drawRoute(coordinates: [number, number][]) {
        // Add route line
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

        // Add animated route outline
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
        });

        // Add stops if available
        if (transporte && transporte.stops && transporte.stops.length > 0) {
          transporte.stops.forEach((stop) => {
            // Determine marker style based on stop type
            let markerColor = "#6b7280"; // Default gray
            let markerSize = "14px";
            let borderColor = "white";
            let markerIcon = "";

            if (stop.isTerminal) {
              markerColor = "#1e293b"; // Black for terminals
              markerSize = "18px";
              borderColor = "#ffffff";
              markerIcon = "T";
            }

            const el = document.createElement("div");
            el.style.cssText = `
              width: ${markerSize};
              height: ${markerSize};
              background: ${markerColor};
              border: 3px solid ${borderColor};
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

            if (markerIcon) {
              el.textContent = markerIcon;
            }

            let popupContent = `<strong>${stop.nome}</strong>`;
            if (stop.isTerminal) {
              popupContent += `<br><span style="color: #6b7280;">🏁 Terminal</span>`;
            }

            new maplibregl.Marker({ element: el })
              .setLngLat([stop.longitude, stop.latitude])
              .setPopup(
                new maplibregl.Popup({ offset: 15 }).setHTML(popupContent)
              )
              .addTo(map);
          });
        }

        // Add bus marker
        addBusMarker();

        // Fit map to show entire route
        const bounds = new maplibregl.LngLatBounds();
        coordinates.forEach((coord) => bounds.extend(coord));
        map.fitBounds(bounds, { padding: 50 });
      }

      // Function to add bus marker
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
          el.textContent = '🚌';

          new maplibregl.Marker({ element: el })
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
      // Filter only available motoristas (active and without transport)
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
        
        // Check if error is about motorista or proprietarios association
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
      // First remove motorista association
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

      // Then remove all proprietario associations
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

      // Finally delete the transporte
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
        <p className="text-black">Transporte não encontrado</p>
        <button onClick={() => router.push('/transportes')} className="mt-4 text-black" style={{ transition: 'none' }}>
          Voltar para lista
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
              <h2 className="text-3xl font-bold text-black">{transporte.matricula}</h2>
              <p className="text-black mt-1">{transporte.modelo} - {transporte.marca}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/transportes/${transporte.id}/editar`)}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium flex items-center space-x-2"
              style={{ transition: 'none' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Editar</span>
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center space-x-2"
              style={{ transition: 'none' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && transporte && (
          <div 
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm min-h-screen" 
            style={{ minHeight: '100vh', height: '100%' }}
            onClick={() => !deleting && setShowDeleteModal(false)}
          >
            <div className="flex items-center justify-center min-h-screen p-4">
              <div 
                className="relative z-[101] bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-gray-200 my-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4 ${
                  hasAssociations ? 'bg-gradient-to-br from-red-50 to-red-100/30' : 'bg-red-100'
                }`}>
                  <svg className={`w-6 h-6 ${hasAssociations ? 'text-red-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {hasAssociations ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    )}
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                  {hasAssociations ? 'Remover Associações' : 'Eliminar Transporte'}
                </h3>
                
                {hasAssociations ? (
                  <div className="space-y-4">
                    <p className="text-gray-600 text-center">
                      {deleteError}
                    </p>
                    <div className="bg-white rounded-lg p-4">
                      <p className="text-sm text-red-600 text-center font-medium">
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
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleRemoveAssociationsAndDelete}
                        disabled={deleting}
                        className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <p className="text-gray-600 text-center mb-6">
                      Tem certeza que deseja eliminar o transporte <strong className="text-gray-900">"{transporte.matricula}"</strong>?
                      <br />
                      <span className="text-sm text-red-600 font-medium">Esta ação não pode ser desfeita.</span>
                    </p>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setShowDeleteModal(false)}
                        disabled={deleting}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black font-medium mb-1">Quilômetros Percorridos</p>
                <p className="text-3xl font-bold text-black">{transporte && isNewTransport(transporte.createdAt) ? '0' : '247'} km</p>
                <div className="mt-2 flex items-center text-xs text-gray-600">
                  {transporte && isNewTransport(transporte.createdAt) ? (
                    <span>Transporte novo</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      <span>+12% vs ontem</span>
                    </>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black font-medium mb-1">Tempo de Operação</p>
                <p className="text-3xl font-bold text-black">{transporte && isNewTransport(transporte.createdAt) ? '0' : '8.5'}h</p>
                <div className="mt-2 flex items-center text-xs text-gray-600">
                  {transporte && isNewTransport(transporte.createdAt) ? (
                    <span>Transporte novo</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Normal</span>
                    </>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black font-medium mb-1">Consumo de Combustível</p>
                <p className="text-3xl font-bold text-black">{transporte && isNewTransport(transporte.createdAt) ? '0' : '45'} L</p>
                <div className="mt-2 flex items-center text-xs text-gray-600">
                  {transporte && isNewTransport(transporte.createdAt) ? (
                    <span>Transporte novo</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      <span>-5% vs ontem</span>
                    </>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black font-medium mb-1">Passageiros Transportados</p>
                <p className="text-3xl font-bold text-black">{transporte && isNewTransport(transporte.createdAt) ? '0' : '342'}</p>
                <div className="mt-2 flex items-center text-xs text-gray-600">
                  {transporte && isNewTransport(transporte.createdAt) ? (
                    <span>Transporte novo</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      <span>+8% vs ontem</span>
                    </>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Map - Full Width */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-black">Localização e Rota</h3>
                <p className="text-sm text-black">Posição em tempo real com visualização 3D</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-slate-100 text-black rounded-full text-xs font-semibold flex items-center">
                  <span className="w-2 h-2 bg-slate-600 rounded-full mr-2 animate-pulse"></span>
                  Em Movimento
                </span>
              </div>
            </div>
          </div>
          <div ref={mapRef} className="h-[600px]" />
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-black mb-1 font-medium">Velocidade Atual</p>
                <p className="text-lg font-bold text-black">45 km/h</p>
              </div>
              <div>
                <p className="text-xs text-black mb-1 font-medium">Próxima Paragem</p>
                <p className="text-lg font-bold text-black">Costa do Sol</p>
              </div>
              <div>
                <p className="text-xs text-black mb-1 font-medium">Tempo Estimado</p>
                <p className="text-lg font-bold text-black">5 min</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pessoas Associadas - Motorista e Proprietário lado a lado */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6" style={{ transition: 'none' }}>
          <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Pessoas Associadas</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ transition: 'none' }}>
            {/* Motorista */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-black">Motorista</h4>
                {!transporte.motorista && (
                  <button 
                    onClick={() => {
                      setShowMotoristaModal(true);
                      fetchMotoristasDisponiveis();
                    }}
                    className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium"
                  >
                    + Atribuir
                  </button>
                )}
              </div>
              {transporte.motorista ? (
                <div 
                  onClick={() => router.push(`/motoristas/${transporte.motorista!.id}`)}
                  className="border border-slate-200 rounded-lg p-4 cursor-pointer hover:border-slate-400 hover:shadow-md transition-all"
                >
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoverMotorista();
                      }}
                      className="text-slate-400 hover:text-red-600 flex-shrink-0 ml-2 transition-colors"
                      title="Remover motorista"
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
                {(!transporte.proprietarios || transporte.proprietarios.length === 0) && (
                  <button 
                    onClick={() => {
                      setShowProprietarioModal(true);
                      fetchProprietariosDisponiveis();
                    }}
                    className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium"
                  >
                    + Atribuir
                  </button>
                )}
              </div>
              {transporte.proprietarios && transporte.proprietarios.length > 0 ? (
                <div 
                  onClick={() => router.push(`/proprietarios/${transporte.proprietarios[0].proprietario.id}`)}
                  className="border border-slate-200 rounded-lg p-4 cursor-pointer hover:border-slate-400 hover:shadow-md transition-all"
                >
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoverProprietario(transporte.proprietarios[0].proprietario.id);
                      }}
                      className="text-slate-400 hover:text-red-600 flex-shrink-0 ml-2 transition-colors"
                      title="Remover proprietário"
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
                      <span className="truncate">+258 {(transporte.proprietarios[0].proprietario as any).contacto1}</span>
                    </p>
                    <p className="flex items-center">
                      <svg className="w-4 h-4 mr-2 flex-shrink-0 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span className="truncate">{(transporte.proprietarios[0].proprietario as any).endereco}</span>
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

        {/* Informações do Transporte - Full Width */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Informações do Transporte</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Matrícula</p>
              <p className="text-sm font-bold text-black">{transporte.matricula}</p>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Código</p>
              <p className="text-sm font-semibold text-black">{transporte.codigo}</p>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Modelo</p>
              <p className="text-sm font-semibold text-black">{transporte.modelo}</p>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Marca</p>
              <p className="text-sm font-semibold text-black">{transporte.marca}</p>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Cor</p>
              <p className="text-sm font-semibold text-black">{transporte.cor}</p>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Lotação</p>
              <p className="text-sm font-semibold text-black">{transporte.lotacao} lugares</p>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Via</p>
              <p className="text-sm font-semibold text-black">{transporte.via?.nome || 'Não atribuída'}</p>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Código Via</p>
              <p className="text-sm font-semibold text-black">{transporte.via?.codigo || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Estado</p>
              <span className="px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold inline-block">
                Ativo
              </span>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Manutenção</p>
              <p className="text-sm font-semibold text-black">15/04/2026</p>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Revisão</p>
              <p className="text-sm font-semibold text-black">15/07/2026</p>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Km Total</p>
              <p className="text-sm font-semibold text-black">45,230 km</p>
            </div>
            <div>
              <p className="text-xs text-black uppercase tracking-wide font-medium mb-2">Ano</p>
              <p className="text-sm font-semibold text-black">2020</p>
            </div>
          </div>
        </div>

        {/* Charts and Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quilômetros Diários */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-black">Quilômetros Percorridos</h3>
                <p className="text-sm text-black">Evolução durante o dia</p>
              </div>
              <div className="px-3 py-1 bg-slate-100 text-black rounded-lg text-xs font-semibold">
                Hoje
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={quilometrosDiariosData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hora" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="km" 
                  stroke="#1e293b" 
                  strokeWidth={3}
                  dot={{ fill: '#1e293b', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Consumo Semanal */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-black">Consumo de Combustível</h3>
                <p className="text-sm text-black">Litros por dia (última semana)</p>
              </div>
              <div className="px-3 py-1 bg-slate-100 text-black rounded-lg text-xs font-semibold">
                7 dias
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={consumoSemanalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dia" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="litros" fill="#475569" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Zonas Mais Frequentadas - Single Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-black">Zonas Mais Frequentadas</h3>
            <p className="text-sm text-black">Tempo médio gasto em cada zona (% do dia)</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Progress Bars */}
            <div className="lg:col-span-2 space-y-4">
              {zonasFrequentesData.map((zona, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: zona.cor }}
                      />
                      <span className="text-sm font-semibold text-black">{zona.nome}</span>
                    </div>
                    <span className="text-sm font-bold text-black">{zona.tempo}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${zona.tempo}%`,
                        backgroundColor: zona.cor
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Pie Chart */}
            <div className="flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={zonasFrequentesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => `${entry.tempo}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="tempo"
                  >
                    {zonasFrequentesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

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
                      className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-slate-400 transition-colors"
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
                      className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-slate-400 transition-colors"
                    >
                      <div>
                        <h4 className="font-bold text-black">{proprietario.nome}</h4>
                        <p className="text-sm text-black">{proprietario.telefone}</p>
                        <p className="text-sm text-black">{proprietario.email}</p>
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
  );
}
