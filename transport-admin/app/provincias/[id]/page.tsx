"use client";
import LoadingScreen from "../../components/LoadingScreen";

import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Municipio {
  id: string;
  nome: string;
  codigo: string;
  _count: {
    vias: number;
    paragens: number;
  };
}

interface Via {
  id: string;
  nome: string;
  codigo: string;
  geoLocationPath?: string;
  cor?: string;
}

interface ProvinciaDetails {
  id: string;
  nome: string;
  codigo: string;
  geoLocation?: string;
  municipios: Municipio[];
  vias: Via[];
}

export default function ProvinciaDetails() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [provincia, setProvincia] = useState<ProvinciaDetails | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hasAssociations, setHasAssociations] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    setHasAssociations(false);
    
    try {
      const response = await fetch(`/api/provincias/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Província eliminada com sucesso!', 'success');
        setTimeout(() => {
          router.push('/provincias');
        }, 1500);
      } else {
        const error = await response.json();
        
        // Check if error is about associations
        if (error.error && (error.error.includes('municípios') || error.error.includes('municipios') || error.error.includes('associa'))) {
          setDeleteError(error.details || error.error);
          setHasAssociations(true);
        } else {
          showNotification(error.details || error.error || 'Erro ao eliminar província', 'error');
          setShowDeleteModal(false);
        }
      }
    } catch (error) {
      console.error('Erro ao eliminar província:', error);
      showNotification('Erro ao eliminar província', 'error');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveAssociationsAndDelete = async () => {
    setDeleting(true);
    
    try {
      // Force delete with associations removal
      const response = await fetch(`/api/provincias/${id}?force=true`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Província eliminada com sucesso!', 'success');
        setTimeout(() => {
          router.push('/provincias');
        }, 1500);
      } else {
        const error = await response.json();
        showNotification(error.details || error.error || 'Erro ao eliminar província', 'error');
      }
    } catch (error) {
      console.error('Erro ao eliminar província:', error);
      showNotification('Erro ao eliminar província', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Helper function to check if a point is within a circle
  const isPointInCircle = (pointLat: number, pointLng: number, centerLat: number, centerLng: number, radiusKm: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (pointLat - centerLat) * Math.PI / 180;
    const dLng = (pointLng - centerLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(centerLat * Math.PI / 180) * Math.cos(pointLat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance <= radiusKm;
  };

  // Helper function to check if a via passes through the circle
  const viaPassesThroughCircle = (geoLocationPath: string, centerLat: number, centerLng: number, radiusKm: number) => {
    try {
      const coordinates = geoLocationPath
        .trim()
        .split(';')
        .map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return { lat, lng };
        })
        .filter(coord => !isNaN(coord.lat) && !isNaN(coord.lng));

      // Check if any point of the route is within the circle
      return coordinates.some(coord => 
        isPointInCircle(coord.lat, coord.lng, centerLat, centerLng, radiusKm)
      );
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    const fetchProvincia = async () => {
      try {
        const response = await fetch(`/api/provincias/${id}`);
        if (response.ok) {
          const data = await response.json();
          setProvincia(data);
        } else {
          setProvincia(null);
        }
      } catch (error) {
        showNotification('Erro ao carregar província', 'error');
        setProvincia(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProvincia();
  }, [id]);

  // Initialize map when província data is loaded
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !provincia) return;

    // Use província geoLocation or default to Maputo
    const geoLocation = provincia.geoLocation || "-25.9655,32.5892";
    const [lat, lng] = geoLocation.split(',').map(Number);
    if (isNaN(lat) || isNaN(lng)) return;

    const radius = 50; // Default 50km radius

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
          },
          'openmaptiles': {
            type: 'vector',
            url: 'https://api.maptiler.com/tiles/v3/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'
          }
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [lng, lat],
      zoom: 9,
      pitch: 45,
      bearing: 0,
    });

    map.addControl(new maplibregl.NavigationControl({
      visualizePitch: true,
      showZoom: true,
      showCompass: true
    }), 'top-right');

    map.on('load', () => {
      // Add 3D buildings layer
      map.addLayer({
        'id': '3d-buildings',
        'source': 'openmaptiles',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
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
      });

      // Add center point marker
      map.addSource('center-point', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          properties: {}
        }
      });

      map.addLayer({
        id: 'center-point',
        type: 'circle',
        source: 'center-point',
        paint: {
          'circle-radius': 10,
          'circle-color': '#1f2937',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Add radius circle
      const createCircle = (lat: number, lng: number, radiusKm: number) => {
        const points = 64;
        const coords = [];
        const distanceX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
        const distanceY = radiusKm / 110.574;

        for (let i = 0; i < points; i++) {
          const theta = (i / points) * (2 * Math.PI);
          const x = distanceX * Math.cos(theta);
          const y = distanceY * Math.sin(theta);
          coords.push([lng + x, lat + y]);
        }
        coords.push(coords[0]);

        return {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [coords]
          }
        } as any;
      };

      map.addSource('provincia-circle', {
        type: 'geojson',
        data: createCircle(lat, lng, radius)
      });

      map.addLayer({
        id: 'provincia-circle',
        type: 'fill',
        source: 'provincia-circle',
        paint: {
          'fill-color': '#1f2937',
          'fill-opacity': 0.1
        }
      });

      map.addLayer({
        id: 'provincia-circle-outline',
        type: 'line',
        source: 'provincia-circle',
        paint: {
          'line-color': '#1f2937',
          'line-width': 2
        }
      });

      // Add vias (routes) to the map
      if (provincia.vias && provincia.vias.length > 0) {
        let viasRendered = 0;
        provincia.vias.forEach((via) => {
          if (via.geoLocationPath) {
            try {
              // Parse geoLocationPath format: "lng,lat;lng,lat;lng,lat"
              const coordinates = via.geoLocationPath
                .trim()
                .split(';')
                .map(coord => {
                  const [viaLng, viaLat] = coord.split(',').map(Number);
                  return [viaLng, viaLat];
                })
                .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
              
              // Validate coordinates array
              if (Array.isArray(coordinates) && coordinates.length > 1) {
                // Check if via passes through the circle (optional filter)
                const passesThrough = viaPassesThroughCircle(via.geoLocationPath, lat, lng, radius);
                
                map.addSource(`via-${via.id}`, {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    properties: {
                      nome: via.nome,
                      codigo: via.codigo
                    },
                    geometry: {
                      type: 'LineString',
                      coordinates: coordinates
                    }
                  }
                });

                map.addLayer({
                  id: `via-${via.id}`,
                  type: 'line',
                  source: `via-${via.id}`,
                  paint: {
                    'line-color': via.cor || '#3B82F6',
                    'line-width': passesThrough ? 3 : 2,
                    'line-opacity': passesThrough ? 0.8 : 0.3
                  }
                });

                // Add click event to show via info
                map.on('click', `via-${via.id}`, (e) => {
                  if (e.features && e.features[0]) {
                    const feature = e.features[0];
                    new maplibregl.Popup()
                      .setLngLat(e.lngLat)
                      .setHTML(`
                        <div style="padding: 8px;">
                          <strong style="color: #1f2937;">${feature.properties.nome}</strong><br/>
                          <span style="color: #6b7280; font-size: 12px;">Código: ${feature.properties.codigo}</span>
                        </div>
                      `)
                      .addTo(map);
                  }
                });

                // Change cursor on hover
                map.on('mouseenter', `via-${via.id}`, () => {
                  map.getCanvas().style.cursor = 'pointer';
                });

                map.on('mouseleave', `via-${via.id}`, () => {
                  map.getCanvas().style.cursor = '';
                });

                viasRendered++;
              }
            } catch (error) {
              // Skip invalid geoLocationPath
            }
          }
        });
      }
    });

    mapInstanceRef.current = map;

    return () => {
      if (map) {
        map.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [provincia]);

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  if (!provincia) {
    return (
      <div className="bg-white min-h-screen">
        {notification && (
          <div className="fixed top-4 right-4 z-50 animate-slide-in">
            <div className="rounded-lg shadow-lg p-4 min-w-[300px] bg-red-50 border border-red-200">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <p className="text-sm font-medium text-red-800">{notification.message}</p>
              </div>
            </div>
          </div>
        )}
        <div className="max-w-[1600px] mx-auto p-6 space-y-6">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push('/provincias')} className="p-2 rounded-lg hover:bg-gray-100">
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Província Não Encontrada</h2>
              <p className="text-gray-600 mt-1">A província solicitada não existe no sistema</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalMunicipios = provincia.municipios?.length || 0;
  const totalVias = provincia.municipios?.reduce((sum, m) => sum + (m._count?.vias || 0), 0) || 0;
  const totalParagens = provincia.municipios?.reduce((sum, m) => sum + (m._count?.paragens || 0), 0) || 0;

  // Filter vias that pass through the circle (50km radius)
  const geoLocation = provincia.geoLocation || "-25.9655,32.5892";
  const [centerLat, centerLng] = geoLocation.split(',').map(Number);
  const radius = 50; // 50km radius for província
  
  const viasInCircle = provincia.vias?.filter(via => 
    via.geoLocationPath && viaPassesThroughCircle(via.geoLocationPath, centerLat, centerLng, radius)
  ) || [];
  
  const totalViasInCircle = viasInCircle.length;

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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && provincia && (
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
                {hasAssociations ? 'Remover Associações' : 'Eliminar Província'}
              </h3>
              
              {hasAssociations ? (
                <div className="space-y-4">
                  <p className="text-gray-600 text-center">
                    {deleteError}
                  </p>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-red-600 text-center font-medium">
                      Clique em <strong>"Remover e Eliminar"</strong> para remover as associações e eliminar a província.
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
                    Tem certeza que deseja eliminar a província <strong className="text-gray-900">"{provincia.nome}"</strong>?
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
      
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push('/provincias')} className="p-2 rounded-lg hover:bg-gray-100">
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{provincia.nome}</h2>
              <p className="text-gray-600 mt-1">Código: {provincia.codigo}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => router.push(`/provincias/${id}/editar`)}
              className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Editar</span>
            </button>
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/municipios')}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-gray-900 transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Municípios</p>
                <p className="text-3xl font-bold text-gray-900">{totalMunicipios}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-900 transition-colors">
                <svg className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/vias')}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-gray-900 transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Vias</p>
                <p className="text-3xl font-bold text-gray-900">{totalViasInCircle}</p>
                {totalViasInCircle !== totalVias && (
                  <p className="text-xs text-gray-500 mt-1">{totalVias} total, {totalViasInCircle} no raio</p>
                )}
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-900 transition-colors">
                <svg className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/paragens')}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-gray-900 transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Paragens</p>
                <p className="text-3xl font-bold text-gray-900">{totalParagens}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-900 transition-colors">
                <svg className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Municípios List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Municípios ({totalMunicipios})</h3>
          </div>
          <div className="overflow-x-auto">
            {totalMunicipios === 0 ? (
              <div className="p-12 text-center">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-lg font-medium">Nenhum município encontrado</p>
                  <p className="text-sm mt-1">Esta província ainda não tem municípios cadastrados</p>
                </div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Vias
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Paragens
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Acções
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {provincia.municipios.map((municipio) => (
                    <tr 
                      key={municipio.id}
                      onClick={() => router.push(`/municipios/${municipio.id}`)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{municipio.codigo}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{municipio.nome}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{municipio._count?.vias || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{municipio._count?.paragens || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/municipios/${municipio.id}`);
                          }}
                          className="text-gray-600 hover:text-gray-900"
                          title="Ver detalhes"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Map Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Localização da Província</h3>
          <div ref={mapRef} className="w-full h-96 rounded-lg border border-gray-300" />
          <p className="text-xs text-gray-500 mt-3 text-center">
            💡 Use os controles para inclinar e rotar o mapa • Zoom in para ver edifícios em 3D
          </p>
        </div>
      </div>
    </div>
  );
}
