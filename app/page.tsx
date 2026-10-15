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
    let isMounted = true;

    // Initialize simulation on startup
    fetch('/api/startup')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.buses) {
          setBuses(data.buses);
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (isMounted) {
            setUserLocation([position.coords.longitude, position.coords.latitude]);
          }
        },
        () => {
          if (isMounted) {
            setUserLocation([32.5892, -25.9655]);
          }
        }
      );
    } else {
      if (isMounted) {
        setUserLocation([32.5892, -25.9655]);
      }
    }

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize MapLibre map centered on Maputo, Mozambique
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [32.5892, -25.9655],
      zoom: 12,
      pitch: 45,
      bearing: 0,
      maxPitch: 60,
      antialias: false, // Disable for better performance
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
    });

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Function to show bus route (defined outside useEffect to avoid recreation)
  const showBusRoute = (bus: Bus) => {
    if (!mapInstanceRef.current) return;

    // Remove existing route layer if any
    if (routeLayerIdRef.current) {
      if (mapInstanceRef.current.getLayer(routeLayerIdRef.current)) {
        mapInstanceRef.current.removeLayer(routeLayerIdRef.current);
      }
      if (mapInstanceRef.current.getSource(routeLayerIdRef.current)) {
        mapInstanceRef.current.removeSource(routeLayerIdRef.current);
      }
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
      return;
    }

    // Use OSRM to get road-following route
    const waypointsString = bus.routePath.map(w => `${w[0]},${w[1]}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (data?.code === 'Ok' && data.routes?.[0]?.geometry) {
          drawRoute(data.routes[0].geometry.coordinates);
        } else {
          drawRoute(bus.routePath);
        }
      })
      .catch(() => {
        drawRoute(bus.routePath);
      });

    // Function to draw the route on map
    function drawRoute(coordinates: [number, number][]) {
      if (!mapInstanceRef.current) return;

      // Create unique layer ID
      const layerId = `route-${bus.id}`;
      routeLayerIdRef.current = layerId;

      // Add route source
      mapInstanceRef.current.addSource(layerId, {
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
      mapInstanceRef.current.addLayer({
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

      // Add stop markers - SIMPLIFIED
      if (bus.stops && bus.stops.length > 0) {
        bus.stops.forEach((stop) => {
          const el = document.createElement('div');
          el.style.cssText = `
            width: ${stop.isTerminal ? '16px' : '12px'};
            height: ${stop.isTerminal ? '16px' : '12px'};
            background: ${stop.isTerminal ? '#1f2937' : '#6b7280'};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          `;

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([stop.longitude, stop.latitude]);
          
          if (mapInstanceRef.current) {
            marker.addTo(mapInstanceRef.current);
          }

          stopMarkersRef.current.push(marker);
        });
      }

      // Add user location marker - SIMPLIFIED
      if (userLocation) {
        const userEl = document.createElement('div');
        userEl.style.cssText = `
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        `;

        const userMarker = new maplibregl.Marker({ element: userEl })
          .setLngLat(userLocation);
        
        if (mapInstanceRef.current) {
          userMarker.addTo(mapInstanceRef.current);
        }

        userMarkerRef.current = userMarker;
      }

      // Fit map to route bounds (including user location if available)
      const bounds = new maplibregl.LngLatBounds();
      coordinates.forEach((coord) => bounds.extend(coord as [number, number]));
      if (userLocation) {
        bounds.extend(userLocation);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(bounds, { padding: 80 });
      }
    }
  };

  // Separate effect to add/update bus markers when buses change
  useEffect(() => {
    if (!mapInstanceRef.current || buses.length === 0) return;

    const map = mapInstanceRef.current;

    // Wait for map to be loaded
    if (!map.loaded()) {
      const loadHandler = () => {
        updateBusMarkers();
      };
      map.once('load', loadHandler);
      return () => {
        map.off('load', loadHandler);
      };
    }

    updateBusMarkers();

    function updateBusMarkers() {
      if (!mapInstanceRef.current) return;

      // Track which buses are in the current data
      const currentBusIds = new Set(buses.map(b => b.id));

      // Remove markers for buses that no longer exist
      busMarkersRef.current.forEach((marker, busId) => {
        if (!currentBusIds.has(busId)) {
          const el = marker.getElement();
          if (el) {
            // Remove event listeners to prevent memory leaks
            const newEl = el.cloneNode(true);
            el.parentNode?.replaceChild(newEl, el);
          }
          marker.remove();
          busMarkersRef.current.delete(busId);
        }
      });

      // Update or create markers
      buses.forEach(bus => {
        const existingMarker = busMarkersRef.current.get(bus.id);

        if (existingMarker) {
          // Update existing marker position smoothly (no flickering)
          const currentLngLat = existingMarker.getLngLat();
          const newLngLat: [number, number] = [bus.longitude, bus.latitude];
          
          // Only update if position changed significantly (avoid micro-updates)
          const distance = Math.sqrt(
            Math.pow(currentLngLat.lng - newLngLat[0], 2) +
            Math.pow(currentLngLat.lat - newLngLat[1], 2)
          );
          
          if (distance > 0.0001) { // ~11 meters
            existingMarker.setLngLat(newLngLat);
          }
          
          // Don't update popup - it causes flickering
          // Popup content is set once when marker is created
        } else {
          // Create new marker only if it doesn't exist - SIMPLIFIED for memory
          const el = document.createElement('div');
          el.className = 'bus-marker';
          el.style.cssText = `
            width: 28px;
            height: 28px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
          `;
          el.textContent = '🚌';

          // Add click handler to show route
          const clickHandler = () => {
            setSelectedBusId(bus.id);
            showBusRoute(bus);
          };
          el.addEventListener('click', clickHandler);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([bus.longitude, bus.latitude])
            .addTo(map);

          // Store marker reference and cleanup function
          busMarkersRef.current.set(bus.id, marker);
        }
      });
    }
  }, [buses]); // Only depend on buses

  return (
    <>

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

        {/* Admin button at top right */}
        <button
          onClick={() => router.push("/admin")}
          className="absolute top-6 right-6 z-[1000] bg-slate-800/95 backdrop-blur-sm hover:bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium">Admin</span>
        </button>

        {/* Bus count indicator - REMOVED, now integrated in logo */}
      </div>
    </>
  );
}
