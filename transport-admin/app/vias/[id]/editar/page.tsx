"use client";
import LoadingScreen from "../../../components/LoadingScreen";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
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
  municipio: {
    id: string;
    nome: string;
  };
  _count: {
    paragens: number;
    transportes: number;
  };
  paragens: Array<{
    paragem: {
      id: string;
      nome: string;
      codigo: string;
      geoLocation: string;
    };
    terminalBoolean: boolean;
  }>;
  transportes: Array<{
    id: string;
    matricula: string;
    modelo: string;
    marca: string;
    codigo: number;
    motorista: {
      nome: string;
    } | null;
  }>;
}

export default function EditarVia() {
  const router = useRouter();
  const params = useParams();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  
  const [via, setVia] = useState<Via | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(true); // sempre em modo de edição
  const [selectedParagemId, setSelectedParagemId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [allParagens, setAllParagens] = useState<any[]>([]);
  const [nearbyParagens, setNearbyParagens] = useState<any[]>([]);
  const [selectedParagensIds, setSelectedParagensIds] = useState<string[]>([]);
  const [showTransporteModal, setShowTransporteModal] = useState(false);
  const [availableTransportes, setAvailableTransportes] = useState<any[]>([]);
  const [selectedTransportesIds, setSelectedTransportesIds] = useState<string[]>([]);
  const [assigningTransporte, setAssigningTransporte] = useState(false);
  const [municipios, setMunicipios] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    nome: "",
    terminalPartida: "",
    terminalChegada: "",
    cor: "#3B82F6",
    municipioId: "",
  });
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Validar e corrigir códigos de cor
  const getValidColor = (color: string | undefined): string => {
    const defaultColor = '#3B82F6';
    if (!color || typeof color !== 'string' || !color.startsWith('#')) {
      return defaultColor;
    }
    
    const hexPart = color.substring(1);
    if (!/^[0-9A-Fa-f]+$/.test(hexPart)) {
      return defaultColor;
    }
    
    if (hexPart.length === 6) {
      return color;
    } else if (hexPart.length < 6) {
      return '#' + hexPart.padEnd(6, '0');
    } else {
      return '#' + hexPart.substring(0, 6);
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchVia(params.id as string);
      fetchAllParagens();
      fetchMunicipios();
    }
  }, [params.id]);

  useEffect(() => {
    if (!mapRef.current || !via) return;
    
    if (mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [32.5892, -25.9655],
      zoom: 11,
      pitch: 45,
      bearing: 0,
    });

    mapInstanceRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on('load', () => {
      console.log('Mapa carregado, via:', via);
      console.log('geoLocationPath:', via.geoLocationPath);
      
      // Ler as coordenadas da via
      if (via.geoLocationPath) {
        let coordinates: [number, number][] = [];
        
        // Try parsing as JSON first
        try {
          const parsed = JSON.parse(via.geoLocationPath);
          console.log('Lido como JSON:', parsed);
          if (Array.isArray(parsed)) {
            coordinates = parsed;
          }
        } catch (e) {
          console.log('Não é JSON, a tentar o formato com ponto e vírgula');
          // Se não for JSON, tentar o formato separado por ponto e vírgula
          coordinates = via.geoLocationPath
            .split(';')
            .map(coord => {
              const [lng, lat] = coord.split(',').map(Number);
              return [lng, lat] as [number, number];
            })
            .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
        }

        console.log('Coordenadas finais:', coordinates);
        console.log('Número de coordenadas:', coordinates.length);

        if (coordinates.length > 0) {
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

          const validColor = getValidColor(via.cor);
          console.log('Cor da via:', validColor);

          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': validColor,
              'line-width': 6,
              'line-opacity': 0.8
            }
          });

          // Contorno da via
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

          console.log('Camadas da via juntadas');

          // Paragens
          if (via.paragens && via.paragens.length > 0) {
            via.paragens.forEach((viaParagem) => {
              const stop = viaParagem.paragem;
              const [lat, lng] = stop.geoLocation.split(',').map(Number);
              
              if (!isNaN(lat) && !isNaN(lng)) {
                const isTerminal = viaParagem.terminalBoolean;
                const isSelected = selectedParagemId === stop.id;
                const markerColor = isSelected ? '#ef4444' : (isTerminal ? validColor : "#6b7280");
                const markerSize = isSelected ? "22px" : (isTerminal ? "18px" : "14px");

                const el = document.createElement("div");
                el.style.cssText = `
                  width: ${markerSize};
                  height: ${markerSize};
                  background: ${markerColor};
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                  cursor: pointer;
                  transition: all 0.2s ease;
                `;

                const marker = new maplibregl.Marker({ element: el })
                  .setLngLat([lng, lat])
                  .setPopup(
                    new maplibregl.Popup({ offset: 15 }).setHTML(
                      `<strong style="color: black;">${stop.nome}</strong>${isTerminal ? '<br><span style="color: black;">Terminal</span>' : ''}`
                    )
                  )
                  .addTo(map);

                // Guardar a referência do marcador
                markersRef.current.set(stop.id, marker);

                // Clicar no marcador
                el.addEventListener('click', () => {
                  // Fechar todos os outros balões
                  markersRef.current.forEach((m, id) => {
                    if (id !== stop.id) {
                      const p = m.getPopup();
                      if (p && p.isOpen()) {
                        m.togglePopup();
                      }
                    }
                  });
                  setSelectedParagemId(stop.id);
                });
              }
            });
          }

          // Enquadrar o mapa na via
          const bounds = new maplibregl.LngLatBounds();
          coordinates.forEach((coord) => bounds.extend(coord));
          map.fitBounds(bounds, { padding: 50 });
        }
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markersRef.current.clear();
    };
  }, [via]);

  // Actualizar o estilo dos marcadores quando a escolha muda
  useEffect(() => {
    if (!via || !mapInstanceRef.current) return;

    const validColor = getValidColor(via.cor);

    via.paragens?.forEach((viaParagem) => {
      const stop = viaParagem.paragem;
      const marker = markersRef.current.get(stop.id);
      
      if (marker) {
        const el = marker.getElement();
        const isTerminal = viaParagem.terminalBoolean;
        const isSelected = selectedParagemId === stop.id;
        const markerColor = isSelected ? '#ef4444' : (isTerminal ? validColor : "#6b7280");
        const markerSize = isSelected ? "22px" : (isTerminal ? "18px" : "14px");

        el.style.width = markerSize;
        el.style.height = markerSize;
        el.style.background = markerColor;

        // Fechar primeiro todos os balões
        const popup = marker.getPopup();
        if (popup && popup.isOpen()) {
          marker.togglePopup();
        }

        // Aproximar ao marcador escolhido e abrir o seu balão
        if (isSelected && mapInstanceRef.current) {
          const [lat, lng] = stop.geoLocation.split(',').map(Number);
          mapInstanceRef.current.flyTo({
            center: [lng, lat],
            zoom: 15,
            duration: 1000,
          });
          // Abrir o balão um pouco depois, para ficar visível
          setTimeout(() => {
            if (!popup?.isOpen()) {
              marker.togglePopup();
            }
          }, 1100);
        }
      }
    });
  }, [selectedParagemId, via]);

  const handleParagemClick = (paragemId: string) => {
    setSelectedParagemId(paragemId);
  };

  async function fetchVia(id: string) {
    try {
      setError(null);
      const response = await fetch(`/api/vias/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Garantir que os dados têm a estrutura esperada
      if (!data) {
        throw new Error('A API não devolveu dados');
      }
      
      setVia(data);
      setFormData({
        nome: data.nome || '',
        terminalPartida: data.terminalPartida || '',
        terminalChegada: data.terminalChegada || '',
        cor: data.cor || '#3B82F6',
        municipioId: data.municipio?.id || '',
      });
      
      // Paragens escolhidas no início
      if (data.paragens) {
        setSelectedParagensIds(data.paragens.map((vp: any) => vp.paragem.id));
      }

      // Calcular as paragens próximas a partir da via
      if (data.geoLocationPath && allParagens.length > 0) {
        calculateNearbyParagens(data.geoLocationPath);
      }
    } catch (error) {
      console.error('Erro ao carregar via:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(`Erro ao carregar via: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllParagens() {
    try {
      // Todas as paragens (são mais de 1000)
      const response = await fetch('/api/paragens?limit=10000');
      if (!response.ok) {
        throw new Error('Falha ao carregar paragens');
      }
      const result = await response.json();
      setAllParagens(result.data || []);
      
      // Se a via já chegou, calcular as paragens próximas
      if (via && via.geoLocationPath) {
        calculateNearbyParagens(via.geoLocationPath);
      }
    } catch (error) {
      console.error('Erro ao carregar paragens:', error);
    }
  }

  async function fetchMunicipios() {
    try {
      console.log('A carregar municípios...');
      const response = await fetch('/api/municipios?limit=1000');
      if (!response.ok) {
        throw new Error('Falha ao carregar municípios');
      }
      const result = await response.json();
      console.log('Resultado dos municípios:', result);
      console.log('Dados dos municípios:', result.data);
      setMunicipios(result.data || []);
    } catch (error) {
      console.error('Erro ao carregar municípios:', error);
    }
  }

  // Distância entre dois pontos pela fórmula de Haversine
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // raio da Terra em metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // distância em metros
  }

  // Diz se uma paragem está perto da via
  function isParagemNearRoute(paragem: any, routePath: [number, number][], threshold: number = 50): number {
    if (!paragem.geoLocation || routePath.length === 0) return Infinity;
    
    const [lat, lng] = paragem.geoLocation.split(',').map(Number);
    if (isNaN(lng) || isNaN(lat)) return Infinity;
    
    let minDistance = Infinity;
    for (const [routeLng, routeLat] of routePath) {
      const distance = calculateDistance(lat, lng, routeLat, routeLng);
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
  }

  function calculateNearbyParagens(geoLocationPath: string) {
    if (!geoLocationPath || allParagens.length === 0) return;

    // Ler as coordenadas do percurso: array JSON ou separadas por ponto e vírgula
    let coordinates: [number, number][] = [];
    
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(geoLocationPath);
      if (Array.isArray(parsed)) {
        coordinates = parsed;
      }
    } catch {
      // Se não for JSON, tentar o formato separado por ponto e vírgula
      coordinates = geoLocationPath
        .split(';')
        .map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return [lng, lat] as [number, number];
        })
        .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
    }

    if (coordinates.length === 0) return;

    // As paragens a menos de 50 m da via
    const results = allParagens.map(paragem => ({
      paragem,
      distance: isParagemNearRoute(paragem, coordinates, 50)
    })).filter(r => r.distance <= 50)
      .sort((a, b) => a.distance - b.distance);

    setNearbyParagens(results.map(r => r.paragem));
  }

  // Recalcular as paragens próximas quando allParagens chega
  useEffect(() => {
    if (via && via.geoLocationPath && allParagens.length > 0) {
      calculateNearbyParagens(via.geoLocationPath);
    }
  }, [allParagens, via]);

  const toggleParagemSelection = (paragemId: string) => {
    setSelectedParagensIds(prev =>
      prev.includes(paragemId)
        ? prev.filter(id => id !== paragemId)
        : [...prev, paragemId]
    );
  };

  async function fetchAvailableTransportes() {
    if (!via) return;

    try {
      // Pedir todos os transportes
      const response = await fetch('/api/transportes?limit=1000');
      if (!response.ok) throw new Error('Falha ao carregar transportes');
      
      const result = await response.json();
      const allTransportes = result.data || [];

      // Ler o percurso desta via
      let viaCoordinates: [number, number][] = [];
      try {
        const parsed = JSON.parse(via.geoLocationPath);
        if (Array.isArray(parsed)) {
          viaCoordinates = parsed;
        }
      } catch {
        viaCoordinates = via.geoLocationPath
          .split(';')
          .map(coord => {
            const [lng, lat] = coord.split(',').map(Number);
            return [lng, lat] as [number, number];
          })
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
      }

      // Os transportes sem via OU com uma via a menos de 50 m desta
      const available = allTransportes.filter((transporte: any) => {
        // Sem via atribuída, está livre
        if (!transporte.via || !transporte.via.geoLocationPath) {
          return true;
        }

        // Ler o percurso da via do transporte
        let transporteViaCoordinates: [number, number][] = [];
        try {
          const parsed = JSON.parse(transporte.via.geoLocationPath);
          if (Array.isArray(parsed)) {
            transporteViaCoordinates = parsed;
          }
        } catch {
          transporteViaCoordinates = transporte.via.geoLocationPath
            .split(';')
            .map((coord: string) => {
              const [lng, lat] = coord.split(',').map(Number);
              return [lng, lat] as [number, number];
            })
            .filter((coord: [number, number]) => !isNaN(coord[0]) && !isNaN(coord[1]));
        }

        // As vias estão a menos de 50 m uma da outra?
        if (transporteViaCoordinates.length === 0) return false;

        // Algum ponto da via do transporte está a menos de 50 m desta via?
        for (const [tLng, tLat] of transporteViaCoordinates) {
          for (const [vLng, vLat] of viaCoordinates) {
            const distance = calculateDistance(tLat, tLng, vLat, vLng);
            if (distance <= 50) {
              return true; // as vias estão suficientemente perto
            }
          }
        }

        return false;
      });

      setAvailableTransportes(available);
    } catch (error) {
      console.error('Erro ao carregar transportes:', error);
      showNotification('Erro ao carregar transportes', 'error');
    }
  }

  async function handleAssignTransporte() {
    if (selectedTransportesIds.length === 0 || !via) return;

    setAssigningTransporte(true);
    try {
      // Atribuir todos os transportes selecionados
      const promises = selectedTransportesIds.map(transporteId =>
        fetch(`/api/transportes/${transporteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viaId: via.id }),
        })
      );

      const results = await Promise.all(promises);
      const allSuccessful = results.every(r => r.ok);

      if (allSuccessful) {
        showNotification(
          `${selectedTransportesIds.length} transporte(s) atribuído(s) com sucesso!`,
          'success'
        );
        setShowTransporteModal(false);
        setSelectedTransportesIds([]);
        fetchVia(params.id as string); // Carregar a via outra vez
      } else {
        showNotification('Erro ao atribuir alguns transportes', 'error');
      }
    } catch (error) {
      console.error('Erro ao atribuir transportes:', error);
      showNotification('Erro ao atribuir transportes', 'error');
    } finally {
      setAssigningTransporte(false);
    }
  }

  async function handleUnassignTransporte(e: React.MouseEvent, transporteId: string) {
    e.stopPropagation(); // Não deixar o clique chegar ao cartão
    
    try {
      const response = await fetch(`/api/transportes/${transporteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viaId: null }),
      });

      if (response.ok) {
        showNotification('Transporte desassociado com sucesso!', 'success');
        fetchVia(params.id as string); // Carregar a via outra vez
      } else {
        showNotification('Erro ao desassociar transporte', 'error');
      }
    } catch (error) {
      console.error('Erro ao desassociar transporte:', error);
      showNotification('Erro ao desassociar transporte', 'error');
    }
  }

  async function handleSave() {
    try {
      const response = await fetch(`/api/vias/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          paragensIds: selectedParagensIds,
        })
      });

      if (response.ok) {
        showNotification('Via atualizada com sucesso!', 'success');
        setTimeout(() => router.push(`/vias/${params.id}`), 1500);
      } else {
        showNotification('Erro ao atualizar via', 'error');
      }
    } catch (error) {
      showNotification('Erro ao atualizar via', 'error');
    }
  }

  async function handleDelete() {
    setDeleting(true);

    try {
      const response = await fetch(`/api/vias/${params.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setShowDeleteModal(false);
        setNotification({ message: 'Via eliminada com sucesso!', type: 'success' });
        // Redireccionar depois de mostrar a notificação
        setTimeout(() => {
          router.push('/vias');
        }, 1500);
      } else {
        const errorMessage = data.details || data.error || 'Erro ao eliminar via';
        setNotification({ message: errorMessage, type: 'error' });
        setDeleting(false);
        setShowDeleteModal(false);
      }
    } catch (error) {
      console.error('Erro ao eliminar via:', error);
      setNotification({ message: 'Erro ao eliminar via', type: 'error' });
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  function calculateRouteLength(): string {
    if (!via || !via.geoLocationPath) return "0.00";
    
    let coordinates: { lng: number; lat: number }[] = [];
    
    // Try parsing as JSON first
    try {
      const parsed = JSON.parse(via.geoLocationPath);
      if (Array.isArray(parsed)) {
        coordinates = parsed.map(([lng, lat]) => ({ lng, lat }));
      }
    } catch {
      // Se não for JSON, tentar o formato separado por ponto e vírgula
      coordinates = via.geoLocationPath
        .split(';')
        .map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return { lng, lat };
        })
        .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));
    }

    if (coordinates.length < 2) return "0.00";

    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const from = coordinates[i];
      const to = coordinates[i + 1];
      
      // Fórmula de Haversine
      const R = 6371; // raio da Terra em km
      const dLat = (to.lat - from.lat) * Math.PI / 180;
      const dLon = (to.lng - from.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }
    
    return totalDistance.toFixed(2);
  }

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  if (error || !via) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-[1600px] mx-auto p-6 space-y-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/vias')}
              className="p-2 rounded-xl hover:bg-slate-100"
            >
              <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Via Não Encontrada</h2>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Erro ao Carregar Via</h3>
              <p className="text-slate-600 mb-6">{error || 'Via não encontrada'}</p>
              <button
                onClick={() => router.push('/vias')}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium"
              >
                Voltar para Vias
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const routeLength = calculateRouteLength();

  return (
    <div className="min-h-screen bg-white">
      {/* Notificação */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-xl shadow-lg p-4 min-w-[300px] ${
            notification.type === 'success' ? 'bg-slate-50 border border-slate-200' :
            notification.type === 'error' ? 'bg-slate-100 border border-slate-400' :
            'bg-slate-50 border border-slate-200'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-slate-800' :
                notification.type === 'error' ? 'text-slate-900' :
                'text-slate-800'
              }`}>
                {notification.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Janela de atribuição do transporte */}
      {showTransporteModal && (
        <div 
          className="fixed inset-0 z-50 backdrop-blur-sm min-h-screen" 
          style={{ minHeight: '100vh', height: '100%' }}
          onClick={() => {
            setShowTransporteModal(false);
            setSelectedTransportesIds([]);
          }}
        >
          <div className="flex items-center justify-center min-h-screen p-4">
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 animate-scale-in border border-slate-200 max-h-[80vh] flex flex-col my-8"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">Atribuir Transportes</h3>
              <button
                onClick={() => {
                  setShowTransporteModal(false);
                  setSelectedTransportesIds([]);
                }}
                className="p-2 hover:bg-slate-100 rounded-xl"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-2">
              Selecione um ou mais transportes disponíveis (sem via ou com via próxima)
            </p>
            
            {selectedTransportesIds.length > 0 && (
              <p className="text-sm font-medium text-slate-900 mb-4">
                {selectedTransportesIds.length} transporte(s) selecionado(s)
              </p>
            )}

            <div className="flex-1 overflow-y-auto mb-4">
              {availableTransportes.length > 0 ? (
                <div className="space-y-2">
                  {availableTransportes.map((transporte) => {
                    const isSelected = selectedTransportesIds.includes(transporte.id);
                    return (
                      <div
                        key={transporte.id}
                        onClick={() => {
                          setSelectedTransportesIds(prev =>
                            prev.includes(transporte.id)
                              ? prev.filter(id => id !== transporte.id)
                              : [...prev, transporte.id]
                          );
                        }}
                        className={`p-4 border rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'border-slate-900 bg-slate-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-5 h-5 text-slate-900 border-slate-300 rounded-lg focus:ring-slate-900"
                            />
                            <div>
                              <p className="font-bold text-slate-900">{transporte.matricula}</p>
                              <p className="text-sm text-slate-600">
                                {transporte.modelo} - {transporte.marca}
                              </p>
                              {transporte.motorista && (
                                <p className="text-xs text-slate-500">
                                  Motorista: {transporte.motorista.nome}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-1 bg-slate-100 text-slate-900 rounded-lg text-xs font-mono">
                              #{transporte.codigo}
                            </span>
                            {transporte.via && (
                              <p className="text-xs text-slate-500 mt-1">
                                Via: {transporte.via.nome}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-600">
                  <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <p className="font-medium">Nenhum transporte disponível</p>
                  <p className="text-sm mt-1">Todos os transportes já estão atribuídos a vias distantes</p>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowTransporteModal(false);
                  setSelectedTransportesIds([]);
                }}
                className="flex-1 px-4 py-3 border border-slate-300 rounded-xl font-medium text-slate-900 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignTransporte}
                disabled={selectedTransportesIds.length === 0 || assigningTransporte}
                className="flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {assigningTransporte ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Atribuindo...</span>
                  </>
                ) : (
                  <span>Atribuir {selectedTransportesIds.length > 0 ? `(${selectedTransportesIds.length})` : ''}</span>
                )}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Diálogo de confirmação do apagar */}
        {showDeleteModal && (
          <div 
            className="fixed inset-0 z-50 backdrop-blur-sm min-h-screen" 
            style={{ minHeight: '100vh', height: '100%' }}
            onClick={() => setShowDeleteModal(false)}
          >
            <div className="flex items-center justify-center min-h-screen p-4">
              <div 
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-slate-200 my-8"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex items-center justify-center w-12 h-12 bg-slate-200 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
                Eliminar Via
              </h3>
              
              <p className="text-slate-600 text-center mb-6">
                Tem certeza que deseja eliminar a via <strong className="text-slate-900">"{via?.nome}"</strong>?
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
            </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/vias')}
              className="p-2 rounded-xl hover:bg-slate-100"
              style={{ transition: 'none' }}
            >
              <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{via.nome}</h2>
              <p className="text-slate-900 mt-1">{via.codigo}{via.municipio ? ` - ${via.municipio.nome}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/vias/${params.id}`)}
              className="px-4 py-2 bg-slate-200 text-slate-900 rounded-xl font-medium"
              style={{ transition: 'none' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium flex items-center space-x-2"
              style={{ transition: 'none' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Guardar</span>
            </button>
          </div>
        </div>

        {/* Informação da via */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Informações da Via</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Nome da Via</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Município</label>
              <select
                value={formData.municipioId}
                onChange={(e) => setFormData({...formData, municipioId: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 bg-white"
              >
                <option value="">Selecione um município</option>
                {municipios.length > 0 ? (
                  municipios.map((municipio) => (
                    <option key={municipio.id} value={municipio.id}>
                      {municipio.nome}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>Carregando municípios...</option>
                )}
              </select>
              {municipios.length === 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {municipios.length} municípios carregados
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Cor da Via</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={formData.cor}
                  onChange={(e) => setFormData({...formData, cor: e.target.value})}
                  className="w-16 h-10 rounded-lg border border-slate-300"
                />
                <input
                  type="text"
                  value={formData.cor}
                  onChange={(e) => setFormData({...formData, cor: e.target.value})}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Código</label>
              <input
                type="text"
                value={via?.codigo || ''}
                disabled
                className="w-full px-4 py-2 border border-slate-300 rounded-xl bg-slate-100 text-slate-600 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Terminal de Partida</label>
              <input
                type="text"
                value={formData.terminalPartida}
                onChange={(e) => setFormData({...formData, terminalPartida: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Terminal de Chegada</label>
              <input
                type="text"
                value={formData.terminalChegada}
                onChange={(e) => setFormData({...formData, terminalChegada: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Mapa e paragens lado a lado */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de paragens, à esquerda */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-[600px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  Paragens ({selectedParagensIds.length})
                </h3>
                {nearbyParagens.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedParagensIds.length === nearbyParagens.length) {
                        setSelectedParagensIds([]);
                      } else {
                        setSelectedParagensIds(nearbyParagens.map(p => p.id));
                      }
                    }}
                    className="text-xs font-medium text-slate-900 hover:text-slate-700 px-3 py-1 border border-slate-300 rounded-xl hover:bg-slate-50"
                  >
                    {selectedParagensIds.length === nearbyParagens.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                  </button>
                )}
              </div>
              
              {nearbyParagens.length > 0 ? (
                  <div className="space-y-2 overflow-y-auto flex-1">
                    {nearbyParagens.map((paragem) => {
                      const isChecked = selectedParagensIds.includes(paragem.id);
                      return (
                        <div
                          key={paragem.id}
                          onClick={() => toggleParagemSelection(paragem.id)}
                          className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                            isChecked
                              ? 'border-slate-900 bg-slate-50'
                              : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-5 h-5 text-slate-900 border-slate-300 rounded-lg focus:ring-slate-900"
                            />
                            <div>
                              <p className={`font-medium ${isChecked ? 'text-slate-900' : 'text-slate-900'}`}>
                                {paragem.nome}
                              </p>
                              <p className={`text-xs font-mono ${isChecked ? 'text-slate-700' : 'text-slate-900'}`}>
                                {paragem.codigo}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-900 flex-1 flex flex-col items-center justify-center">
                    <p className="font-medium">Nenhuma paragem próxima da rota</p>
                    <p className="text-sm text-slate-600 mt-1">Paragens devem estar a menos de 50m da rota</p>
                  </div>
                )
              }
            </div>
          </div>

          {/* Mapa, à direita */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[600px]">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">Mapa da Rota</h3>
                <p className="text-sm text-slate-900">Visualização da rota com todas as paragens</p>
              </div>
              <div ref={mapRef} className="h-[calc(600px-73px)]" />
            </div>
          </div>
        </div>

        {/* Transportes */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Transportes Atribuídos ({via._count?.transportes || 0})</h3>
            <button 
              onClick={() => {
                setShowTransporteModal(true);
                fetchAvailableTransportes();
              }}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium text-sm hover:bg-slate-800"
            >
              Atribuir Transporte
            </button>
          </div>
          
          {via.transportes && via.transportes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {via.transportes.map((transporte) => (
                <div
                  key={transporte.id}
                  className="border border-slate-200 rounded-xl p-4 hover:shadow-md relative"
                  style={{ transition: 'none' }}
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 pr-2">
                        <h4 className="font-bold text-slate-900 text-lg">{transporte.matricula}</h4>
                        <p className="text-sm text-slate-900">{transporte.modelo} - {transporte.marca}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 bg-slate-100 text-slate-900 rounded-lg text-xs font-mono whitespace-nowrap">
                          #{transporte.codigo}
                        </span>
                      </div>
                    </div>
                    {transporte.motorista && (
                      <div className="flex items-center text-sm text-slate-900">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {transporte.motorista.nome}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-900">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <p className="font-medium">Nenhum transporte atribuído</p>
              <p className="text-sm text-slate-900 mt-1">Atribua transportes para esta via</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
