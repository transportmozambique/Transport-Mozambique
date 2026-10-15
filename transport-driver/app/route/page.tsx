"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function RoutePage() {
  const router = useRouter();
  const [motorista, setMotorista] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    const motoristaData = localStorage.getItem("motorista");
    if (!motoristaData) {
      router.push("/");
      return;
    }

    const data = JSON.parse(motoristaData);
    setMotorista(data);
  }, [router]);

  // Inicializar mapa em um useEffect separado
  useEffect(() => {
    if (!motorista || !mapRef.current || mapInstanceRef.current) return;

    console.log("Inicializando mapa...");
    console.log("Container do mapa:", mapRef.current);

    try {
      const map = new maplibregl.Map({
        container: mapRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty', // OpenFreeMap with building data
        center: [32.5732, -25.9692],
        zoom: 16,
        pitch: 60, // Tilt the map for driving perspective
        bearing: 0, // Will be updated based on vehicle direction
      });

      mapInstanceRef.current = map;

      // Adicionar controles
      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", () => {
        setMapLoaded(true);

        // Add 3D building extrusions
        // Check if buildings layer exists, if not add it
        if (!map.getLayer('building')) {
          const layers = map.getStyle().layers;
          let firstSymbolId;
          for (const layer of layers) {
            if (layer.type === 'symbol') {
              firstSymbolId = layer.id;
              break;
            }
          }

          // Add building source if it doesn't exist
          if (!map.getSource('openmaptiles')) {
            map.addSource('openmaptiles', {
              'type': 'vector',
              'url': 'https://tiles.openfreemap.org/planet'
            });
          }

          // Add 3D buildings layer
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
        }

        // Route waypoints (stops) - Using real Maputo coordinates
        const waypoints = [
          [32.5892, -25.9692], // START: Near Maputo city center
          [32.5932, -25.9632], // Stop 1
          [32.5972, -25.9572], // Stop 2
          [32.6012, -25.9512], // Stop 3
          [32.6052, -25.9452], // END: Terminal
        ];

        console.log('Fetching route from OSRM with waypoints:', waypoints);
        
        // Fetch route from OSRM routing service to follow roads
        const waypointsString = waypoints.map(w => `${w[0]},${w[1]}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson&steps=true`;

        fetch(osrmUrl)
          .then(response => {
            console.log('OSRM response status:', response.status);
            if (!response.ok) {
              throw new Error(`OSRM returned status ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            console.log('OSRM response data:', data);
            
            if (data.code !== 'Ok') {
              console.warn('OSRM code not OK:', data.code, data.message);
              drawRoute(waypoints, waypoints);
              return;
            }
            
            if (!data.routes || data.routes.length === 0) {
              console.warn('No routes returned from OSRM');
              drawRoute(waypoints, waypoints);
              return;
            }

            // Use the route geometry from OSRM (follows roads)
            const routeGeometry = data.routes[0].geometry;
            console.log('✓ OSRM route received with', routeGeometry.coordinates.length, 'coordinates');
            console.log('First few coordinates:', routeGeometry.coordinates.slice(0, 5));
            
            drawRoute(waypoints, routeGeometry.coordinates);
          })
          .catch(error => {
            console.error('❌ Error fetching route from OSRM:', error);
            console.log('Using straight line fallback');
            drawRoute(waypoints, waypoints);
          });

        // Function to draw route and add markers
        function drawRoute(waypoints: number[][], routeCoordinates: number[][]) {
          console.log('Drawing route with', routeCoordinates.length, 'coordinates');
          
          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: routeCoordinates,
              },
            },
          });

          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#2563eb",
              "line-width": 5,
              "line-opacity": 0.7,
            },
          });

          console.log('Route layer added, calling addStopsAndBus');
          
          // Add stops and bus marker
          addStopsAndBus(waypoints, routeCoordinates);
        }

        // Function to add stops and bus marker
        function addStopsAndBus(waypoints: number[][], routeCoordinates: number[][]) {
          console.log('addStopsAndBus called with', routeCoordinates.length, 'coordinates');
          // Paragens - Updated for new route
          const stops = [
            { position: waypoints[0], title: "Paragem Sommerschield", isTerminal: true, isStart: true },
            { position: waypoints[1], title: "Paragem Polana", isTerminal: false, isStart: false },
            { position: waypoints[2], title: "Paragem Costa do Sol", isTerminal: false, isStart: false },
            { position: waypoints[3], title: "Paragem Triunfo", isTerminal: false, isStart: false },
            { position: waypoints[4], title: "Terminal Matola", isTerminal: true, isStart: false },
          ];

          stops.forEach((stop, index) => {
            const el = document.createElement("div");
            
            // Different styles for start, finish, and regular stops
            if (stop.isStart) {
              // Start indicator - green flag
              el.innerHTML = `
                <div style="
                  width: 40px;
                  height: 40px;
                  background: #10b981;
                  border: 4px solid white;
                  border-radius: 50%;
                  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 20px;
                  cursor: pointer;
                ">🚩</div>
              `;
            } else if (index === stops.length - 1) {
              // Finish indicator - checkered flag
              el.innerHTML = `
                <div style="
                  width: 40px;
                  height: 40px;
                  background: #ef4444;
                  border: 4px solid white;
                  border-radius: 50%;
                  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 20px;
                  cursor: pointer;
                ">🏁</div>
              `;
            } else {
              // Regular stop
              el.style.cssText = `
                width: ${stop.isTerminal ? "18px" : "14px"};
                height: ${stop.isTerminal ? "18px" : "14px"};
                background: ${stop.isTerminal ? "#1f2937" : "#6b7280"};
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                cursor: pointer;
              `;
            }

            new maplibregl.Marker({ element: el })
              .setLngLat(stop.position as [number, number])
              .setPopup(
                new maplibregl.Popup({ offset: 15 }).setHTML(
                  `<strong>${stop.title}</strong>${stop.isStart ? '<br><span style="color: #10b981;">🚩 Início</span>' : index === stops.length - 1 ? '<br><span style="color: #ef4444;">🏁 Fim</span>' : ''}`
                )
              )
              .addTo(map);
          });

          // Calculate bearing between two points for route direction
          function calculateBearing(start: [number, number], end: [number, number]): number {
            const startLat = start[1] * Math.PI / 180;
            const startLng = start[0] * Math.PI / 180;
            const endLat = end[1] * Math.PI / 180;
            const endLng = end[0] * Math.PI / 180;

            const dLng = endLng - startLng;

            const y = Math.sin(dLng) * Math.cos(endLat);
            const x = Math.cos(startLat) * Math.sin(endLat) -
                      Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

            const bearing = Math.atan2(y, x) * 180 / Math.PI;
            return (bearing + 360) % 360; // Normalize to 0-360
          }

          // Animation state
          let currentIndex = 0;
          let progress = 0;
          const targetSpeed = 45; // km/h
          
          // Calculate distance between two points in meters
          function calculateDistance(start: [number, number], end: [number, number]): number {
            const R = 6371000; // Earth's radius in meters
            const lat1 = start[1] * Math.PI / 180;
            const lat2 = end[1] * Math.PI / 180;
            const deltaLat = (end[1] - start[1]) * Math.PI / 180;
            const deltaLng = (end[0] - start[0]) * Math.PI / 180;

            const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                      Math.cos(lat1) * Math.cos(lat2) *
                      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            return R * c; // Distance in meters
          }

          // Start position
          const startPosition = routeCoordinates[0] as [number, number];
          
          // Calculate initial bearing
          let currentBearing = 0;
          if (routeCoordinates.length > 1) {
            currentBearing = calculateBearing(
              routeCoordinates[0] as [number, number],
              routeCoordinates[1] as [number, number]
            );
          }

          // Create 3D bus that tilts with the map
          const arrowElement = document.createElement('div');
          arrowElement.innerHTML = `
            <svg width="48" height="56" viewBox="0 0 48 56" style="display: block; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));">
              <defs>
                <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#3b82f6"/>
                  <stop offset="100%" style="stop-color:#1e40af"/>
                </linearGradient>
              </defs>
              
              <!-- Shadow -->
              <ellipse cx="24" cy="52" rx="18" ry="3" fill="#000000" opacity="0.3"/>
              
              <!-- Main bus body -->
              <rect x="8" y="16" width="32" height="34" rx="2" fill="url(#bodyGrad)" stroke="#0a1f5c" stroke-width="1.5"/>
              
              <!-- Roof -->
              <rect x="10" y="12" width="28" height="5" rx="1" fill="#1e3a8a" stroke="#0a1f5c" stroke-width="1"/>
              
              <!-- Front windshield -->
              <rect x="12" y="18" width="24" height="8" rx="1" fill="#e0f2fe" opacity="0.8" stroke="#1e40af" stroke-width="0.5"/>
              
              <!-- Side windows (left) -->
              <rect x="10" y="28" width="6" height="6" rx="0.5" fill="#dbeafe" opacity="0.7"/>
              <rect x="10" y="36" width="6" height="6" rx="0.5" fill="#dbeafe" opacity="0.7"/>
              <rect x="10" y="44" width="6" height="6" rx="0.5" fill="#dbeafe" opacity="0.7"/>
              
              <!-- Side windows (right) -->
              <rect x="32" y="28" width="6" height="6" rx="0.5" fill="#bfdbfe" opacity="0.6"/>
              <rect x="32" y="36" width="6" height="6" rx="0.5" fill="#bfdbfe" opacity="0.6"/>
              <rect x="32" y="44" width="6" height="6" rx="0.5" fill="#bfdbfe" opacity="0.6"/>
              
              <!-- Front headlights (YELLOW - these point forward) -->
              <circle cx="16" cy="14" r="3" fill="#fef08a" stroke="#ffffff" stroke-width="1.5"/>
              <circle cx="16" cy="14" r="1.8" fill="#fde047"/>
              
              <circle cx="32" cy="14" r="3" fill="#fef08a" stroke="#ffffff" stroke-width="1.5"/>
              <circle cx="32" cy="14" r="1.8" fill="#fde047"/>
              
              <!-- Wheels -->
              <circle cx="14" cy="50" r="4" fill="#1f2937" stroke="#000" stroke-width="1"/>
              <circle cx="14" cy="50" r="2.5" fill="#4b5563"/>
              <circle cx="14" cy="50" r="1" fill="#6b7280"/>
              
              <circle cx="34" cy="50" r="4" fill="#1f2937" stroke="#000" stroke-width="1"/>
              <circle cx="34" cy="50" r="2.5" fill="#4b5563"/>
              <circle cx="34" cy="50" r="1" fill="#6b7280"/>
              
              <!-- Rear lights (red) -->
              <circle cx="16" cy="51" r="1.5" fill="#ef4444" opacity="0.9"/>
              <circle cx="32" cy="51" r="1.5" fill="#ef4444" opacity="0.9"/>
              
              <!-- Door -->
              <rect x="9" y="34" width="3" height="12" rx="0.5" fill="#1e3a8a" stroke="#0a1f5c" stroke-width="0.5"/>
              
              <!-- 3D effect highlights -->
              <rect x="9" y="17" width="2" height="32" fill="#60a5fa" opacity="0.3"/>
              <rect x="37" y="17" width="2" height="32" fill="#1e3a8a" opacity="0.4"/>
            </svg>
          `;

          const busMarker = new maplibregl.Marker({ 
            element: arrowElement,
            anchor: 'center',
            rotationAlignment: 'map',
            pitchAlignment: 'map'  // Changed back to 'map' so it tilts with the map
          })
            .setLngLat(startPosition)
            .setRotation(currentBearing)
            .setPopup(
              new maplibregl.Popup({ offset: 30 }).setHTML(
                `<div style="color: #000;"><strong>Sua Posição</strong><br>${motorista.transporte.matricula}<br>Velocidade: ${targetSpeed} km/h</div>`
              )
            )
            .addTo(map);

          let lastTimestamp = Date.now();
          let currentBearingValue = currentBearing;

          // Animate bus along route
          function animateBus() {
            if (currentIndex >= routeCoordinates.length - 1) {
              // Reached end, restart from beginning
              currentIndex = 0;
              progress = 0;
            }

            const now = Date.now();
            const deltaTime = (now - lastTimestamp) / 1000; // Time in seconds
            lastTimestamp = now;

            const start = routeCoordinates[currentIndex] as [number, number];
            const end = routeCoordinates[currentIndex + 1] as [number, number];

            // Calculate segment distance in meters
            const segmentDistance = calculateDistance(start, end);
            
            // Calculate how far to move based on speed (45 km/h = 12.5 m/s)
            const speedMetersPerSecond = (targetSpeed * 1000) / 3600; // 45 km/h = 12.5 m/s
            const distanceToMove = speedMetersPerSecond * deltaTime;
            
            // Calculate progress increment (0 to 1 for this segment)
            const progressIncrement = segmentDistance > 0 ? distanceToMove / segmentDistance : 0;

            // Interpolate position
            const lng = start[0] + (end[0] - start[0]) * progress;
            const lat = start[1] + (end[1] - start[1]) * progress;

            // Calculate bearing for current segment
            const bearing = calculateBearing(start, end);

            // Update rotation using MapLibre's setRotation method
            if (Math.abs(bearing - currentBearingValue) > 2) {
              currentBearingValue = bearing;
              busMarker.setRotation(bearing);
            }

            // Update bus position
            busMarker.setLngLat([lng, lat]);

            // Update progress
            progress += progressIncrement;

            if (progress >= 1) {
              progress = 0;
              currentIndex++;
            }

            requestAnimationFrame(animateBus);
          }

          // Start animation
          animateBus();

          // Center map on bus position
          map.flyTo({
            center: startPosition,
            zoom: 17,
            bearing: 0,
            pitch: 60,
            duration: 2000
          });
        } // End of addStopsAndBus function
      });

      map.on("error", (e) => {
        console.error("Erro no mapa:", e.error?.message || "Erro desconhecido");
      });

    } catch (error) {
      console.error("Erro ao criar mapa:", error);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [motorista]);

  if (!motorista) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Voltar
              </Link>
              <div className="w-px h-6 bg-gray-300"></div>
              <h1 className="text-xl font-bold text-gray-900">Minha Rota</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Route Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{motorista.via.nome}</h2>
              <p className="text-gray-600">Código: {motorista.via.codigo}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Transporte</div>
              <div className="text-lg font-bold text-gray-900">{motorista.transporte.matricula}</div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Mapa da Rota</h3>
          <div
            ref={mapRef}
            style={{
              height: "500px",
              width: "100%",
              borderRadius: "0.75rem",
              overflow: "hidden",
              backgroundColor: "#e5e7eb",
              position: "relative",
            }}
          >
            {!mapLoaded && (
              <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                color: "#6b7280",
                zIndex: 1000,
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                padding: "20px",
                borderRadius: "8px",
              }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p>Carregando mapa...</p>
              </div>
            )}
          </div>
        </div>

        {/* Stops List */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Paragens da Rota</h3>
          <div className="space-y-3">
            {[
              { name: "Terminal Zimpeto", time: "06:00", isTerminal: true },
              { name: "Paragem Albazine", time: "06:15", isTerminal: false },
              { name: "Paragem Xipamanine", time: "06:30", isTerminal: false },
              { name: "Paragem Sommerschield", time: "06:45", isTerminal: false },
              { name: "Paragem Polana", time: "07:00", isTerminal: false },
              { name: "Terminal Baixa", time: "07:15", isTerminal: true },
            ].map((stop, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  stop.isTerminal ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    stop.isTerminal ? 'bg-blue-600 text-white' : 'bg-gray-400 text-white'
                  }`}>
                    {stop.isTerminal ? '🏁' : index}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{stop.name}</p>
                    {stop.isTerminal && (
                      <p className="text-xs text-blue-600 font-medium">Terminal</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{stop.time}</p>
                  <p className="text-xs text-gray-500">Horário estimado</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
