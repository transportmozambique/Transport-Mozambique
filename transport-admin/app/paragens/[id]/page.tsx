"use client";
import LoadingScreen from "../../components/LoadingScreen";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import ConfirmDialog from "@/app/components/ConfirmDialog";

interface Paragem {
  id: string;
  nome: string;
  codigo: string;
  geoLocation: string;
  vias: Array<{
    via: {
      id: string;
      nome: string;
      codigo: string;
    };
    terminalBoolean: boolean;
  }>;
  createdAt?: string;
}

export default function ParagemDetalhes() {
  const router = useRouter();
  const params = useParams();
  const [paragem, setParagem] = useState<Paragem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (params.id) {
      fetchParagem(params.id as string);
    }
  }, [params.id]);

  useEffect(() => {
    if (paragem && mapRef.current && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [paragem]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  async function fetchParagem(id: string) {
    try {
      // Fetch specific paragem by ID instead of all paragens
      const response = await fetch(`/api/paragens/${id}`);
      
      if (!response.ok) {
        throw new Error('Paragem não encontrada');
      }
      
      const data = await response.json();
      setParagem(data);
    } catch (error) {
      console.error('Erro ao carregar paragem:', error);
      showNotification('Erro ao carregar paragem', 'error');
      setParagem(null);
    } finally {
      setLoading(false);
    }
  }

  async function initializeMap() {
    if (!paragem) return;

    const coords = paragem.geoLocation.split(',');
    const lat = parseFloat(coords[0]?.trim());
    const lng = parseFloat(coords[1]?.trim());

    if (isNaN(lat) || isNaN(lng)) return;

    // Dynamically import Leaflet
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    // Initialize map
    const map = L.map(mapRef.current).setView([lat, lng], 15);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Create custom marker icon
    const isTerminal = paragem.vias.some(v => v.terminalBoolean);
    const markerColor = isTerminal ? '#1f2937' : '#6b7280'; // Black for terminal, gray for regular
    const markerSize = '14px'; // Same size for both

    const customIcon = L.divIcon({
      className: 'custom-stop-marker',
      html: `
        <div style="
          width: ${markerSize};
          height: ${markerSize};
          background: ${markerColor};
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${markerColor};
          opacity: 0.6;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          z-index: -1;
        "></div>
      `,
      iconSize: [parseInt(markerSize), parseInt(markerSize)],
      iconAnchor: [parseInt(markerSize) / 2, parseInt(markerSize) / 2],
    });

    // Add marker for the paragem
    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    marker.bindPopup(`<b>${paragem.nome}</b><br>${paragem.codigo}<br>${isTerminal ? 'Terminal' : 'Paragem'}`).openPopup();

    mapInstanceRef.current = map;
  }

  async function handleDelete() {
    try {
      const response = await fetch(`/api/paragens/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Paragem eliminada com sucesso!', 'success');
        setTimeout(() => router.push('/paragens'), 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao eliminar paragem', 'error');
      }
    } catch (error) {
      console.error('Erro ao eliminar paragem:', error);
      showNotification('Erro ao eliminar paragem', 'error');
    }
  }

  function confirmDelete() {
    setShowDeleteDialog(true);
  }

  function handleConfirmDelete() {
    setShowDeleteDialog(false);
    handleDelete();
  }

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  if (!paragem) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-[1600px] mx-auto p-6 space-y-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/paragens')}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Paragem Não Encontrada</h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isTerminal = paragem.vias.some(v => v.terminalBoolean);
  const coords = paragem.geoLocation.split(',');

  return (
    <div className="bg-white min-h-screen">
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.8);
            opacity: 0;
          }
        }
        
        .custom-stop-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
      
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
              {notification.type === 'info' && (
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/paragens')}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{paragem.nome}</h2>
              <p className="text-gray-600 mt-1">Código: {paragem.codigo}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/paragens/${params.id}/editar`)}
              className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Editar</span>
            </button>
            <button 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          title="Eliminar Paragem"
          message={`Tem certeza que deseja eliminar a paragem "${paragem.nome}"? Esta ação não pode ser desfeita.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          type="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteDialog(false)}
        />

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tipo</p>
                <p className="text-2xl font-bold text-gray-900">{isTerminal ? 'Terminal' : 'Paragem'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Vias</p>
                <p className="text-2xl font-bold text-gray-900">{paragem.vias.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Código</p>
                <p className="text-2xl font-bold text-gray-900">{paragem.codigo}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Location Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">Localização</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coordinates Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Coordenadas GPS</label>
                <p className="text-gray-600 font-mono">{coords[0]?.trim()}, {coords[1]?.trim()}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Latitude</label>
                <p className="text-gray-600 font-mono">{coords[0]?.trim()}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Longitude</label>
                <p className="text-gray-600 font-mono">{coords[1]?.trim()}</p>
              </div>
            </div>

            {/* Map */}
            <div 
              ref={mapRef}
              className="h-[300px] rounded-lg overflow-hidden border border-gray-200"
              style={{ zIndex: 0 }}
            ></div>
          </div>
        </div>

        {/* Vias */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">Vias Associadas</h3>
          
          {paragem.vias && paragem.vias.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paragem.vias.map((v, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-gray-900 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{v.via.nome}</h4>
                        <p className="text-sm text-gray-600">Código: {v.via.codigo}</p>
                      </div>
                    </div>
                  </div>
                  {v.terminalBoolean && (
                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-900 text-white">
                      Terminal
                    </span>
                  )}
                  <button
                    onClick={() => router.push(`/vias/${v.via.id}`)}
                    className="mt-3 w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200"
                  >
                    Ver Via
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
              <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-sm font-medium">Nenhuma via associada</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
