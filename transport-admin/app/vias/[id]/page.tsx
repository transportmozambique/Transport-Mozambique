"use client";
import LoadingScreen from "../../components/LoadingScreen";

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

export default function ViaDetalhes() {
  const router = useRouter();
  const params = useParams();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  
  const [via, setVia] = useState<Via | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
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
  const [formData, setFormData] = useState({
    nome: "",
    terminalPartida: "",
    terminalChegada: "",
    cor: "#3B82F6",
  });
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Helper function to validate and fix color codes
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
    }
  }, [params.id]);

  useEffect(() => {
    if (!mapRef.current || !via) return;
    
    if (mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [32.5892, -25.9655],
      zoom: 11,
      pitch: 45,
      bearing: 0,
    });

    mapInstanceRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on('load', () => {
      console.log('Map loaded, via:', via);
      console.log('geoLocationPath:', via.geoLocationPath);
      
      // Parse route coordinates
      if (via.geoLocationPath) {
        let coordinates: [number, number][] = [];
        
        // Try parsing as JSON first
        try {
          const parsed = JSON.parse(via.geoLocationPath);
          console.log('Parsed as JSON:', parsed);
          if (Array.isArray(parsed)) {
            coordinates = parsed;
          }
        } catch (e) {
          console.log('Not JSON, trying semicolon format');
          // If not JSON, try semicolon-separated format
          coordinates = via.geoLocationPath
            .split(';')
            .map(coord => {
              const [lng, lat] = coord.split(',').map(Number);
              return [lng, lat] as [number, number];
            })
            .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
        }

        console.log('Final coordinates:', coordinates);
        console.log('Coordinates count:', coordinates.length);

        if (coordinates.length > 0) {
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

          const validColor = getValidColor(via.cor);
          console.log('Route color:', validColor);

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

          // Add route outline
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

          console.log('Route layers added successfully');

          // Add stops
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
                      `<strong style="color: black;">${stop.nome}</strong>${isTerminal ? '<br><span style="color: black;">🏁 Terminal</span>' : ''}`
                    )
                  )
                  .addTo(map);

                // Store marker reference
                markersRef.current.set(stop.id, marker);

                // Add click handler to marker
                el.addEventListener('click', () => {
                  // Close all other popups
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

          // Fit map to route
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

  // Update marker styles when selection changes
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

        // Close all popups first
        const popup = marker.getPopup();
        if (popup && popup.isOpen()) {
          marker.togglePopup();
        }

        // Zoom to selected marker and open its popup
        if (isSelected && mapInstanceRef.current) {
          const [lat, lng] = stop.geoLocation.split(',').map(Number);
          mapInstanceRef.current.flyTo({
            center: [lng, lat],
            zoom: 15,
            duration: 1000,
          });
          // Open popup after a short delay to ensure it's visible
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
      // Add cache-busting parameter to force fresh data
      const response = await fetch(`/api/vias/${id}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Debug: Log the data
      console.log('Via data received:', data);
      console.log('Transportes count:', data._count?.transportes);
      console.log('Transportes array:', data.transportes);
      console.log('Transportes length:', data.transportes?.length);
      
      // Ensure data has required structure
      if (!data) {
        throw new Error('No data received from API');
      }
      
      setVia(data);
      setFormData({
        nome: data.nome || '',
        terminalPartida: data.terminalPartida || '',
        terminalChegada: data.terminalChegada || '',
        cor: data.cor || '#3B82F6',
      });
      
      // Initialize selected paragens
      if (data.paragens) {
        setSelectedParagensIds(data.paragens.map((vp: any) => vp.paragem.id));
      }

      // Calculate nearby paragens from the route
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
      const response = await fetch('/api/paragens?limit=1000');
      if (!response.ok) {
        throw new Error('Failed to fetch paragens');
      }
      const result = await response.json();
      setAllParagens(result.data || []);
      
      // If via is already loaded, calculate nearby paragens
      if (via && via.geoLocationPath) {
        calculateNearbyParagens(via.geoLocationPath);
      }
    } catch (error) {
      console.error('Erro ao carregar paragens:', error);
    }
  }

  // Calculate distance between two points using Haversine formula
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Check if a paragem is near the route
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

    // Parse route coordinates - handle both JSON array and semicolon-separated formats
    let coordinates: [number, number][] = [];
    
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(geoLocationPath);
      if (Array.isArray(parsed)) {
        coordinates = parsed;
      }
    } catch {
      // If not JSON, try semicolon-separated format
      coordinates = geoLocationPath
        .split(';')
        .map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return [lng, lat] as [number, number];
        })
        .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
    }

    if (coordinates.length === 0) return;

    // Find paragens within 50m of the route
    const results = allParagens.map(paragem => ({
      paragem,
      distance: isParagemNearRoute(paragem, coordinates, 50)
    })).filter(r => r.distance <= 50)
      .sort((a, b) => a.distance - b.distance);

    setNearbyParagens(results.map(r => r.paragem));
  }

  // Recalculate nearby paragens when allParagens loads
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
      // Fetch all transportes
      const response = await fetch('/api/transportes?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch transportes');
      
      const result = await response.json();
      const allTransportes = result.data || [];

      // Parse this via's route
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

      // Filter transportes: no via OR via within 50m of this via
      const available = allTransportes.filter((transporte: any) => {
        // If no via assigned, it's available
        if (!transporte.via || !transporte.via.geoLocationPath) {
          return true;
        }

        // Parse transporte's via route
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

        // Check if routes are within 50m of each other
        if (transporteViaCoordinates.length === 0) return false;

        // Check if any point of transporte's via is within 50m of this via
        for (const [tLng, tLat] of transporteViaCoordinates) {
          for (const [vLng, vLat] of viaCoordinates) {
            const distance = calculateDistance(tLat, tLng, vLat, vLng);
            if (distance <= 50) {
              return true; // Routes are close enough
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
        fetchVia(params.id as string); // Refresh via data
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
    e.stopPropagation(); // Prevent card click event
    
    try {
      const response = await fetch(`/api/transportes/${transporteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viaId: null }),
      });

      if (response.ok) {
        showNotification('Transporte desassociado com sucesso!', 'success');
        fetchVia(params.id as string); // Refresh via data
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
        setEditMode(false);
        fetchVia(params.id as string);
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
        // Redirect after showing notification
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
      // If not JSON, try semicolon-separated format
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
      
      // Haversine formula
      const R = 6371; // Earth radius in km
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

  function calculateAverageTime(): number {
    const distance = parseFloat(calculateRouteLength());
    if (distance === 0) return 0;
    
    // Calculate time at 45 km/h
    // Time = Distance / Speed
    // Convert to minutes: (distance / 45) * 60
    const timeInMinutes = (distance / 45) * 60;
    
    return Math.round(timeInMinutes);
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
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Via Não Encontrada</h2>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Erro ao Carregar Via</h3>
              <p className="text-gray-600 mb-6">{error || 'Via não encontrada'}</p>
              <button
                onClick={() => router.push('/vias')}
                className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-lg font-medium"
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

      {/* Transporte Assignment Modal */}
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
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-scale-in border border-gray-200 max-h-[80vh] flex flex-col my-8"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Atribuir Transportes</h3>
              <button
                onClick={() => {
                  setShowTransporteModal(false);
                  setSelectedTransportesIds([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              Selecione um ou mais transportes disponíveis (sem via ou com via próxima)
            </p>
            
            {selectedTransportesIds.length > 0 && (
              <p className="text-sm font-medium text-gray-900 mb-4">
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
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-gray-900 bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-5 h-5 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                            />
                            <div>
                              <p className="font-bold text-gray-900">{transporte.matricula}</p>
                              <p className="text-sm text-gray-600">
                                {transporte.modelo} - {transporte.marca}
                              </p>
                              {transporte.motorista && (
                                <p className="text-xs text-gray-500">
                                  Motorista: {transporte.motorista.nome}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-1 bg-gray-100 text-gray-900 rounded text-xs font-mono">
                              #{transporte.codigo}
                            </span>
                            {transporte.via && (
                              <p className="text-xs text-gray-500 mt-1">
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
                <div className="text-center py-8 text-gray-600">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignTransporte}
                disabled={selectedTransportesIds.length === 0 || assigningTransporte}
                className="flex-1 px-4 py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div 
            className="fixed inset-0 z-50 backdrop-blur-sm min-h-screen" 
            style={{ minHeight: '100vh', height: '100%' }}
            onClick={() => setShowDeleteModal(false)}
          >
            <div className="flex items-center justify-center min-h-screen p-4">
              <div 
                className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-gray-200 my-8"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Eliminar Via
              </h3>
              
              <p className="text-gray-600 text-center mb-6">
                Tem certeza que deseja eliminar a via <strong className="text-gray-900">"{via?.nome}"</strong>?
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
            </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/vias')}
              className="p-2 rounded-lg hover:bg-slate-100"
              style={{ transition: 'none' }}
            >
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-black">{via.nome}</h2>
              <p className="text-black mt-1">{via.codigo}{via.municipio ? ` - ${via.municipio.nome}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3" style={{ position: 'relative', zIndex: 10 }}>
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Editar button clicked, navigating to:', `/vias/${params.id}/editar`);
                  router.push(`/vias/${params.id}/editar`);
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium flex items-center space-x-2"
                style={{ transition: 'none', cursor: 'pointer', pointerEvents: 'auto' }}
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
            </>
          </div>
        </div>

        {/* Statistics Cards */}
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black font-medium mb-1">Comprimento</p>
                <p className="text-3xl font-bold text-black">{routeLength} km</p>
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
                <p className="text-sm text-black font-medium mb-1">Paragens</p>
                <p className="text-3xl font-bold text-black">{via._count?.paragens || 0}</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black font-medium mb-1">Transportes</p>
                <p className="text-3xl font-bold text-black">{via._count?.transportes || 0}</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black font-medium mb-1">Tempo Médio</p>
                <p className="text-3xl font-bold text-black">{calculateAverageTime()} min</p>
                <p className="text-xs text-gray-600 mt-1">a 45 km/h</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Via Information */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-black mb-4">Informações da Via</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-black font-medium mb-1">Código</p>
                <p className="text-lg text-black font-mono">{via.codigo}</p>
              </div>
              <div>
                <p className="text-sm text-black font-medium mb-1">Município</p>
                <p className="text-lg text-black">{via.municipio?.nome || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-black font-medium mb-1">Terminal de Partida</p>
                <p className="text-lg text-black">{via.terminalPartida || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-black font-medium mb-1">Terminal de Chegada</p>
                <p className="text-lg text-black">{via.terminalChegada || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-black font-medium mb-1">Cor da Via</p>
                <div className="flex items-center space-x-3">
                  <div
                    className="w-8 h-8 rounded border-2 border-white shadow-sm"
                    style={{ backgroundColor: getValidColor(via.cor) }}
                  ></div>
                  <span className="text-lg text-black font-mono">{via.cor}</span>
                </div>
              </div>
            </div>
        </div>

        {/* Map and Paragens Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Paragens List - Left Side */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-[600px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-black">
                  Paragens ({via._count?.paragens || 0})
                </h3>
              </div>
              
              {via.paragens && via.paragens.length > 0 ? (
                  <div className="space-y-2 overflow-y-auto flex-1">
                    {via.paragens.map((viaParagem, index) => {
                      const isSelected = selectedParagemId === viaParagem.paragem.id;
                      return (
                        <div
                          key={viaParagem.paragem.id}
                          onClick={() => handleParagemClick(viaParagem.paragem.id)}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-red-500 bg-red-50 shadow-md' 
                              : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              isSelected ? 'bg-red-500 text-white' : 'bg-slate-100 text-black'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className={`font-medium ${isSelected ? 'text-red-900' : 'text-black'}`}>
                                {viaParagem.paragem.nome}
                              </p>
                              <p className={`text-xs font-mono ${isSelected ? 'text-red-700' : 'text-black'}`}>
                                {viaParagem.paragem.codigo}
                              </p>
                            </div>
                          </div>
                          {viaParagem.terminalBoolean && (
                            <span className="px-2 py-1 bg-slate-900 text-white rounded text-xs font-semibold">
                              Terminal
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-black flex-1 flex flex-col items-center justify-center">
                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="font-medium">Nenhuma paragem atribuída</p>
                  </div>
                )
              }
            </div>
          </div>

          {/* Map - Right Side */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[600px]">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-black">Mapa da Rota</h3>
                <p className="text-sm text-black">Visualização da rota com todas as paragens</p>
              </div>
              <div ref={mapRef} className="h-[calc(600px-73px)]" />
            </div>
          </div>
        </div>

        {/* Transportes */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-black">Transportes Atribuídos ({via._count?.transportes || 0})</h3>
          </div>
          
          {via.transportes && via.transportes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {via.transportes.map((transporte) => (
                <div
                  key={transporte.id}
                  onClick={() => router.push(`/transportes/${transporte.id}`)}
                  className="border border-slate-200 rounded-lg p-4 hover:shadow-md cursor-pointer"
                  style={{ transition: 'none' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 pr-2">
                      <h4 className="font-bold text-black text-lg">{transporte.matricula}</h4>
                      <p className="text-sm text-black">{transporte.modelo} - {transporte.marca}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 bg-slate-100 text-black rounded text-xs font-mono whitespace-nowrap">
                        #{transporte.codigo}
                      </span>
                    </div>
                  </div>
                  {transporte.motorista && (
                    <div className="flex items-center text-sm text-black">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {transporte.motorista.nome}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-black">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <p className="font-medium">Nenhum transporte atribuído</p>
              <p className="text-sm text-black mt-1">Edite a via para atribuir transportes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
