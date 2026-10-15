"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Bus {
  id: string;
  matricula: string;
  via: string;
  latitude: number;
  longitude: number;
  status: string;
  routePath: [number, number][];
  stops?: {
    id: string;
    nome: string;
    latitude: number;
    longitude: number;
    isTerminal: boolean;
  }[];
}

export default function LandingPage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const routeLayerIdRef = useRef<string | null>(null);
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const busMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    // Initialize simulation on startup
    fetch('/api/startup')
      .then((res) => res.json())
      .then((data) => {
        console.log('Simulation initialized:', data);
      })
      .catch((error) => {
        console.error('Error initializing simulation:', error);
      });

    // Fetch all buses from API (ONCE on load)
    fetch('/api/buses')
      .then((res) => res.json())
      .then((data) => {
        console.log('Fetched buses:', data);
        if (data.buses) {
          setBuses(data.buses);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching buses:', error);
        setLoading(false);
      });

    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLng = position.coords.longitude;
          const userLat = position.coords.latitude;
          console.log('User location:', userLat, userLng);
          setUserLocation([userLng, userLat]);
        },
        (error) => {
          console.log('Could not get user location:', error.message);
          // Default to Maputo center if geolocation fails
          setUserLocation([32.5892, -25.9655]);
        }
      );
    } else {
      // Geolocation not supported, use default
      setUserLocation([32.5892, -25.9655]);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || loading) return;

    // Initialize MapLibre map centered on Maputo, Mozambique
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [32.5892, -25.9655], // Maputo center
      zoom: 12,
      pitch: 45,
      bearing: 0,
    });

    mapInstanceRef.current = map;

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      // Add 3D buildings
      const layers = map.getStyle().layers;
      let firstSymbolId;
      for (const layer of layers) {
        if (layer.type === 'symbol') {
          firstSymbolId = layer.id;
          break;
        }
      }

      if (!map.getSource('openmaptiles')) {
        map.addSource('openmaptiles', {
          'type': 'vector',
          'url': 'https://tiles.openfreemap.org/planet'
        });
      }

      map.addLayer(
        {
          'id': '3d-buildings',
          'source': 'openmaptiles',
          'source-layer': 'building',
          'type': 'fill-extrusion',
          'minzoom': 15,
          'paint': {
            'fill-extrusion-color': '#d1d5db',
            'fill-extrusion-height': [
              'case',
              ['has', 'render_height'],
              ['get', 'render_height'],
              5
            ],
            'fill-extrusion-base': [
              'case',
              ['has', 'render_min_height'],
              ['get', 'render_min_height'],
              0
            ],
            'fill-extrusion-opacity': 0.8
          }
        },
        firstSymbolId
      );

      // Display all buses from API
      console.log('Adding', buses.length, 'buses to map');
      
      buses.forEach(bus => {
        console.log(`Bus ${bus.matricula}: lat=${bus.latitude}, lng=${bus.longitude}`);
        
        const el = document.createElement('div');
        el.innerHTML = `
          <svg width="32" height="38" viewBox="0 0 32 38" style="display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4)); cursor: pointer;">
            <defs>
              <linearGradient id="busGrad${bus.id}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#3b82f6"/>
                <stop offset="100%" style="stop-color:#1e40af"/>
              </linearGradient>
            </defs>
            <rect x="6" y="10" width="20" height="22" rx="1.5" fill="url(#busGrad${bus.id})" stroke="#0a1f5c" stroke-width="1"/>
            <rect x="8" y="8" width="16" height="3" rx="0.5" fill="#1e3a8a"/>
            <rect x="8" y="12" width="16" height="5" rx="0.5" fill="#e0f2fe" opacity="0.8"/>
            <rect x="7" y="18" width="4" height="4" rx="0.3" fill="#dbeafe" opacity="0.7"/>
            <rect x="7" y="24" width="4" height="4" rx="0.3" fill="#dbeafe" opacity="0.7"/>
            <rect x="21" y="18" width="4" height="4" rx="0.3" fill="#bfdbfe" opacity="0.6"/>
            <rect x="21" y="24" width="4" height="4" rx="0.3" fill="#bfdbfe" opacity="0.6"/>
            <circle cx="11" cy="7" r="2" fill="#fef08a" stroke="#fff" stroke-width="1"/>
            <circle cx="21" cy="7" r="2" fill="#fef08a" stroke="#fff" stroke-width="1"/>
            <circle cx="10" cy="33" r="2.5" fill="#1f2937"/>
            <circle cx="22" cy="33" r="2.5" fill="#1f2937"/>
            <circle cx="11" cy="34" r="1" fill="#ef4444"/>
            <circle cx="21" cy="34" r="1" fill="#ef4444"/>
          </svg>
        `;

        // Add click handler to show route
        el.addEventListener('click', () => {
          console.log('Bus clicked:', bus.id, bus.matricula);
          setSelectedBusId(bus.id);
          showBusRoute(bus);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([bus.longitude, bus.latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 20 }).setHTML(
              `<div style="color: #000;"><strong>${bus.matricula}</strong><br>${bus.via}<br><span style="color: #10b981;">${bus.status}</span></div>`
            )
          )
          .addTo(map);

        // Store marker reference for updates
        busMarkersRef.current.set(bus.id, marker);
      });

      // Function to show bus route
      function showBusRoute(bus: Bus) {
        if (!mapInstanceRef.current) return;

        const map = mapInstanceRef.current;

        // Remove existing route layer if any
        if (routeLayerIdRef.current) {
          try {
            if (map.getLayer(routeLayerIdRef.current)) {
              map.removeLayer(routeLayerIdRef.current);
            }
          } catch (e) {
            console.warn('Layer already removed:', routeLayerIdRef.current);
          }
          
          try {
            if (map.getSource(routeLayerIdRef.current)) {
              map.removeSource(routeLayerIdRef.current);
            }
          } catch (e) {
            console.warn('Source already removed:', routeLayerIdRef.current);
          }
          
          routeLayerIdRef.current = null;
        }

        // Remove existing stop markers
        stopMarkersRef.current.forEach(marker => marker.remove());
        stopMarkersRef.current = [];

        // Remove existing user marker
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
          userMarkerRef.current = null;
        }

        // If no route path, skip
        if (!bus.routePath || bus.routePath.length === 0) {
          console.log('No route path for bus:', bus.matricula);
          return;
        }

        console.log('Drawing route for bus:', bus.matricula, 'with', bus.routePath.length, 'waypoints');

        // Use OSRM to get road-following route
        // Limit waypoints to avoid OSRM errors (max 100 waypoints)
        const maxWaypoints = 100;
        const limitedPath = bus.routePath.length > maxWaypoints 
          ? bus.routePath.filter((_, i) => i % Math.ceil(bus.routePath.length / maxWaypoints) === 0)
          : bus.routePath;
        
        const waypointsString = limitedPath.map(w => `${w[0]},${w[1]}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson`;

        fetch(osrmUrl)
          .then(response => {
            if (!response.ok) {
              console.warn(`OSRM returned status ${response.status}, using direct route`);
              drawRoute(bus.routePath);
              return null;
            }
            return response.json();
          })
          .then(data => {
            if (!data) return; // Already handled in previous then
            
            if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
              console.warn('OSRM failed, using direct waypoints');
              drawRoute(bus.routePath);
              return;
            }

            // Use the route geometry from OSRM (follows roads)
            const routeGeometry = data.routes[0].geometry;
            console.log('✓ OSRM route received with', routeGeometry.coordinates.length, 'coordinates');
            drawRoute(routeGeometry.coordinates);
          })
          .catch(error => {
            console.warn('OSRM routing unavailable, using direct route:', error.message);
            drawRoute(bus.routePath);
          });

        // Function to draw the route on map
        function drawRoute(coordinates: [number, number][]) {
          if (!mapInstanceRef.current) return;

          const map = mapInstanceRef.current;

          // Create unique layer ID
          const layerId = `route-${bus.id}`;
          
          // Double-check source doesn't exist before adding
          if (map.getSource(layerId)) {
            console.warn('Source already exists, removing first:', layerId);
            try {
              if (map.getLayer(layerId)) {
                map.removeLayer(layerId);
              }
              map.removeSource(layerId);
            } catch (e) {
              console.error('Error removing existing source:', e);
            }
          }

          routeLayerIdRef.current = layerId;

          // Add route source
          map.addSource(layerId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: coordinates,
              },
            },
          });

          // Add route layer
          map.addLayer({
            id: layerId,
            type: 'line',
            source: layerId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#ef4444',
              'line-width': 4,
              'line-opacity': 0.8,
            },
          });

          // Add stop markers
          if (bus.stops && bus.stops.length > 0) {
            bus.stops.forEach((stop) => {
              const el = document.createElement('div');
              el.style.cssText = `
                width: ${stop.isTerminal ? '18px' : '14px'};
                height: ${stop.isTerminal ? '18px' : '14px'};
                background: ${stop.isTerminal ? '#1f2937' : '#6b7280'};
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                cursor: pointer;
              `;

              const marker = new maplibregl.Marker({ element: el })
                .setLngLat([stop.longitude, stop.latitude])
                .setPopup(
                  new maplibregl.Popup({ offset: 15 }).setHTML(
                    `<strong>${stop.nome}</strong><br><span style="color: #6b7280; font-size: 12px;">${stop.isTerminal ? 'Terminal' : 'Paragem'}</span>`
                  )
                );
              
              marker.addTo(map);
              stopMarkersRef.current.push(marker);
            });
          }

          // Add user location marker
          if (userLocation) {
            const userEl = document.createElement('div');
            userEl.className = 'user-location-marker';
            userEl.innerHTML = `
              <div style="position: relative; width: 32px; height: 32px;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: #3b82f6; border-radius: 50%; opacity: 0.3; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
              </div>
            `;

            const userMarker = new maplibregl.Marker({ element: userEl })
              .setLngLat(userLocation)
              .setPopup(
                new maplibregl.Popup({ offset: 16 }).setHTML(
                  '<strong>Sua Localização</strong>'
                )
              );
            
            userMarker.addTo(map);
            userMarkerRef.current = userMarker;
          }

          // Fit map to route bounds (including user location if available)
          const bounds = new maplibregl.LngLatBounds();
          coordinates.forEach((coord) => bounds.extend(coord as [number, number]));
          if (userLocation) {
            bounds.extend(userLocation);
          }
          map.fitBounds(bounds, { padding: 80 });
        }
      }
    });

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading, buses]);

  // Function to update bus markers with new positions
  const updateBusMarkers = (updatedBuses: Bus[]) => {
    if (!mapInstanceRef.current) return;

    updatedBuses.forEach(bus => {
      const marker = busMarkersRef.current.get(bus.id);
      if (marker) {
        // Update marker position with smooth animation
        marker.setLngLat([bus.longitude, bus.latitude]);
        
        // Update popup content
        const popup = marker.getPopup();
        if (popup) {
          popup.setHTML(
            `<div style="color: #000;"><strong>${bus.matricula}</strong><br>${bus.via}<br><span style="color: #10b981;">${bus.status}</span></div>`
          );
        }
      }
    });
  };

  return (
    <>
      <style jsx global>{`
        .maplibregl-map {
          height: 100%;
          width: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .maplibregl-popup-content {
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 12px 16px;
          font-size: 14px;
          line-height: 1.5;
        }

        .maplibregl-popup-content strong {
          color: #1f2937;
          font-weight: 600;
        }

        .maplibregl-ctrl-group {
          border-radius: 6px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
        }
      `}</style>

      <div className="relative h-screen w-screen overflow-hidden">
        {/* Loading state */}
        {loading && (
          <div className="absolute inset-0 bg-slate-900 flex items-center justify-center z-[2000]">
            <div className="text-center">
              <div className="relative mb-4">
                <div className="w-12 h-12 border-4 border-slate-700 rounded-full mx-auto"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-white rounded-full border-t-transparent animate-spin"></div>
                </div>
              </div>
              <p className="text-sm text-white font-medium">Carregando transportes...</p>
            </div>
          </div>
        )}

        {/* Full screen map */}
        <div className="absolute inset-0" ref={mapRef} />

        {/* Entrar button at bottom center */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[1000]">
          <button
            onClick={() => router.push("/auth")}
            className="px-12 py-4 bg-white text-slate-900 rounded-full font-bold text-xl hover:bg-slate-100 transition-all duration-200 shadow-2xl hover:shadow-3xl hover:scale-105 flex items-center gap-3"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
              />
            </svg>
            <span>Entrar</span>
          </button>
        </div>

        {/* Logo/Title overlay at top */}
        <div className="absolute top-6 left-6 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl px-6 py-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <svg
              className="w-8 h-8 text-slate-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Transportes Moçambique</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-600">Tempo real</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-semibold text-emerald-600">{buses.length} autocarros</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bus count indicator - REMOVED, now integrated in logo */}
      </div>
    </>
  );
}
