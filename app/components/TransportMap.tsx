"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Stop {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  isTerminal: boolean;
  isPickup?: boolean;
  isDestination?: boolean;
}

interface TransportMapProps {
  transportLat: number;
  transportLng: number;
  paragemLat: number;
  paragemLng: number;
  transportMatricula: string;
  routeCoords?: [number, number][];
  stops?: Stop[];
  paragemNome?: string;
  destinationLat?: number;
  destinationLng?: number;
  destinationNome?: string;
  userJourney?: {
    from: string;
    to: string;
    fromId: string;
    toId: string;
  };
}

export default function TransportMap({
  transportLat,
  transportLng,
  paragemLat,
  paragemLng,
  transportMatricula,
  routeCoords,
  stops,
  paragemNome,
  destinationLat,
  destinationLng,
  destinationNome,
  userJourney,
}: TransportMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const transportMarkerRef = useRef<maplibregl.Marker | null>(null);
  const paragemMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  // Log stops prop immediately when component receives it
  console.log('🗺️ TransportMap - Received props:');
  console.log('🗺️ stops prop:', stops);
  console.log('🗺️ stops length:', stops?.length || 0);
  if (stops && stops.length > 0) {
    console.log('🗺️ First stop:', stops[0]);
    console.log('🗺️ Stops with isPickup:', stops.filter(s => s.isPickup).length);
    console.log('🗺️ Stops with isDestination:', stops.filter(s => s.isDestination).length);
    const pickupStop = stops.find(s => s.isPickup);
    const destStop = stops.find(s => s.isDestination);
    if (pickupStop) console.log('🟢 Pickup stop found:', pickupStop.nome, pickupStop.id);
    if (destStop) console.log('🔴 Destination stop found:', destStop.nome, destStop.id);
  }

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    console.log('🗺️ TransportMap - Initializing map');
    console.log('🗺️ Stops available:', stops?.length || 0);

    // Inicializar mapa MapLibre
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty', // OpenFreeMap with building data
      center: [transportLng, transportLat],
      zoom: 14,
      pitch: 60, // Tilt the map for 3D perspective
      bearing: 0, // Will be updated based on vehicle direction
    });

    mapInstanceRef.current = map;

    // Adicionar controles de navegação
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // Resize map when maximized state changes
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapRef.current) {
      resizeObserver.observe(mapRef.current);
    }

    // Aguardar o mapa carregar
    map.on("load", () => {

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

      // Criar rota completa
      // Use provided routeCoords if available, otherwise use default coordinates
      const defaultRouteCoordinates: [number, number][] = routeCoords || [
        [32.5892, -25.9692], // START
        [32.5932, -25.9632], // Stop 1
        [32.5972, -25.9572], // Stop 2
        [32.6012, -25.9512], // Stop 3
        [32.6052, -25.9452], // END
      ];

      console.log('Route coordinates:', defaultRouteCoordinates);
      
      // Always use OSRM to ensure routes follow roads
      if (routeCoords && routeCoords.length > 1) {
        console.log('Using OSRM to refine provided route coordinates');
        
        // Use OSRM to get road-following route
        const waypointsString = routeCoords.map(w => `${w[0]},${w[1]}`).join(';');
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
              drawRoute(routeCoords);
              return;
            }
            
            if (!data.routes || data.routes.length === 0) {
              console.warn('No routes returned from OSRM');
              drawRoute(routeCoords);
              return;
            }

            // Use the route geometry from OSRM (follows roads)
            const routeGeometry = data.routes[0].geometry;
            console.log('✓ OSRM route received with', routeGeometry.coordinates.length, 'coordinates');
            
            drawRoute(routeGeometry.coordinates);
          })
          .catch(error => {
            console.error('❌ Error fetching route from OSRM:', error);
            console.log('Using provided coordinates as fallback');
            drawRoute(routeCoords);
          });
      } else {
        // No route provided, use default
        console.log('No route provided, using default coordinates');
        drawRoute(defaultRouteCoordinates);
      }

      // Function to draw route
      function drawRoute(coordinates: [number, number][]) {
        console.log('Drawing route with', coordinates.length, 'coordinates');
        
        // Find pickup and destination indices in the route
        let pickupIndex = -1;
        let destinationIndex = -1;
        
        if (stops && stops.length > 0) {
          stops.forEach((stop, index) => {
            if (stop.isPickup) {
              // Find closest point on route to pickup
              let minDist = Infinity;
              coordinates.forEach((coord, coordIndex) => {
                const dist = Math.sqrt(
                  Math.pow(coord[0] - stop.longitude, 2) + 
                  Math.pow(coord[1] - stop.latitude, 2)
                );
                if (dist < minDist) {
                  minDist = dist;
                  pickupIndex = coordIndex;
                }
              });
            }
            if (stop.isDestination) {
              // Find closest point on route to destination
              let minDist = Infinity;
              coordinates.forEach((coord, coordIndex) => {
                const dist = Math.sqrt(
                  Math.pow(coord[0] - stop.longitude, 2) + 
                  Math.pow(coord[1] - stop.latitude, 2)
                );
                if (dist < minDist) {
                  minDist = dist;
                  destinationIndex = coordIndex;
                }
              });
            }
          });
        }

        // Ensure pickup comes before destination
        if (pickupIndex > destinationIndex && destinationIndex !== -1) {
          [pickupIndex, destinationIndex] = [destinationIndex, pickupIndex];
        }

        // Draw different route segments with different colors
        if (pickupIndex !== -1 && destinationIndex !== -1) {
          // 1. Full route (gray) - background
          map.addSource("route-full", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: coordinates,
              },
            },
          });

          map.addLayer({
            id: "route-full",
            type: "line",
            source: "route-full",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#9ca3af", // Gray
              "line-width": 8,
              "line-opacity": 0.4,
            },
          });

          // 2. User journey segment (blue) - highlighted
          const userJourneyCoords = coordinates.slice(pickupIndex, destinationIndex + 1);
          map.addSource("route-journey", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: userJourneyCoords,
              },
            },
          });

          map.addLayer({
            id: "route-journey",
            type: "line",
            source: "route-journey",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#3b82f6", // Blue
              "line-width": 6,
              "line-opacity": 0.9,
            },
          });

          // 3. Bus to pickup segment (orange) - where bus needs to travel
          const busToPickupCoords = coordinates.slice(0, pickupIndex + 1);
          if (busToPickupCoords.length > 1) {
            map.addSource("route-bus-to-pickup", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: busToPickupCoords,
                },
              },
            });

            map.addLayer({
              id: "route-bus-to-pickup",
              type: "line",
              source: "route-bus-to-pickup",
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
              paint: {
                "line-color": "#f59e0b", // Orange
                "line-width": 5,
                "line-opacity": 0.8,
              },
            });
          }
        } else {
          // Fallback: single route color
          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: coordinates,
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
        }

        console.log('Route layers added, adding stops and bus');
        
        // Continue with stops and bus
        addStopsAndBus(coordinates);
      }

      // Function to add stops and bus
      function addStopsAndBus(routeCoords: [number, number][]) {
      console.log('🗺️ TransportMap - Adding stops and bus');
      console.log('🗺️ Total stops received:', stops?.length || 0);
      console.log('🗺️ Stops with isPickup:', stops?.filter(s => s.isPickup).length || 0);
      console.log('🗺️ Stops with isDestination:', stops?.filter(s => s.isDestination).length || 0);
      
      if (stops && stops.length > 0) {
        console.log('🗺️ Sample stops:', stops.slice(0, 3).map(s => ({
          nome: s.nome,
          isPickup: s.isPickup,
          isDestination: s.isDestination
        })));
      }
      
      // Adicionar paragens
      // Use provided stops if available, otherwise create default stops
      const defaultStops = [
        { position: routeCoords[0], title: "Terminal Início", isTerminal: true },
        { position: routeCoords[Math.floor(routeCoords.length * 0.25)], title: "Paragem 1", isTerminal: false },
        { position: routeCoords[Math.floor(routeCoords.length * 0.5)], title: "Paragem 2", isTerminal: false },
        { position: routeCoords[Math.floor(routeCoords.length * 0.75)], title: "Paragem 3", isTerminal: false },
        { position: routeCoords[routeCoords.length - 1], title: "Terminal Fim", isTerminal: true },
      ];

      let stopsToRender: Array<{
        position: [number, number];
        title: string;
        isTerminal: boolean;
        isPickup?: boolean;
        isDestination?: boolean;
        id?: string;
      }>;
      
      if (stops && stops.length > 0) {
        // Snap stops to the nearest point on the route
        stopsToRender = stops.map(stop => {
          const stopLngLat: [number, number] = [stop.longitude, stop.latitude];
          
          // Find the closest point on the route
          let minDistance = Infinity;
          let closestPoint = stopLngLat;
          
          routeCoords.forEach(coord => {
            const dx = coord[0] - stopLngLat[0];
            const dy = coord[1] - stopLngLat[1];
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistance) {
              minDistance = distance;
              closestPoint = coord;
            }
          });
          
          // If the stop is very far from the route (>0.01 degrees ~1km), use original position
          // Otherwise, snap to the route
          const useSnapped = minDistance < 0.01;
          
          return {
            position: useSnapped ? closestPoint : stopLngLat,
            title: stop.nome,
            isTerminal: stop.isTerminal,
            isPickup: stop.isPickup || false,  // ← ADD THIS
            isDestination: stop.isDestination || false,  // ← ADD THIS
            id: stop.id,  // ← ADD THIS for better matching
          };
        });
      } else {
        stopsToRender = defaultStops;
      }

      stopsToRender.forEach((stop) => {
        // Determine marker type and color
        let markerColor = "#6b7280"; // Default gray
        let markerSize = "14px";
        let borderColor = "white";
        let markerIcon = "";

        // Check flags directly from stop object
        if (stop.isPickup) {
          console.log('🟢 Rendering PICKUP marker for:', stop.title, 'at position:', stop.position);
          markerColor = "#10b981"; // Green for pickup
          markerSize = "20px";
          borderColor = "#ffffff";
          markerIcon = "P"; // Use letter P instead of emoji
        } else if (stop.isDestination) {
          console.log('🔴 Rendering DESTINATION marker for:', stop.title, 'at position:', stop.position);
          markerColor = "#ef4444"; // Red for destination
          markerSize = "20px";
          borderColor = "#ffffff";
          markerIcon = "D"; // Use letter D instead of emoji
        } else if (stop.isTerminal) {
          markerColor = "#1f2937"; // Black for terminals
          markerSize = "18px";
          borderColor = "#ffffff";
          markerIcon = "T"; // Use letter T for terminal
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
          font-size: 12px;
          font-weight: bold;
          color: white;
          position: relative;
        `;

        // Add icon if available
        if (markerIcon) {
          el.textContent = markerIcon;
        }

        // Create popup content
        let popupContent = `<strong>${stop.title}</strong>`;
        if (stop.isPickup) {
          popupContent += `<br><span style="color: #10b981;">📍 Sua paragem de embarque</span>`;
        } else if (stop.isDestination) {
          popupContent += `<br><span style="color: #ef4444;">🎯 Seu destino</span>`;
        } else if (stop.isTerminal) {
          popupContent += `<br><span style="color: #6b7280;">🏁 Terminal</span>`;
        }

        console.log('Creating marker:', {
          title: stop.title,
          color: markerColor,
          size: markerSize,
          icon: markerIcon,
          isPickup: stop.isPickup,
          isDestination: stop.isDestination
        });

        new maplibregl.Marker({ element: el })
          .setLngLat(stop.position as [number, number])
          .setPopup(
            new maplibregl.Popup({ offset: 15 }).setHTML(popupContent)
          )
          .addTo(map);
      });

      // Calculate bearing between two points
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

      // Start position on the route
      const startPos = routeCoords[0];
      const nextPos = routeCoords[1];
      const initialBearing = calculateBearing(startPos, nextPos);

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

      // Adicionar marcador do transporte
      const transportMarker = new maplibregl.Marker({ 
        element: arrowElement,
        anchor: 'center',
        rotationAlignment: 'map',
        pitchAlignment: 'map'  // Changed back to 'map' so it tilts with the map
      })
        .setLngLat(startPos)
        .setRotation(initialBearing)
        .setPopup(
          new maplibregl.Popup({ offset: 30 }).setHTML(
            `<div style="color: #000;"><strong>Transporte ${transportMatricula}</strong><br>Em movimento</div>`
          )
        )
        .addTo(map);

      transportMarkerRef.current = transportMarker;

      // Simulate bus movement along the route
      let currentSegment = 0;
      let progress = 0;
      const busSpeed = 0.002; // Adjust speed
      let currentBearingValue = initialBearing;

      // Animate bus along the route
      function animateBus() {
        if (currentSegment >= routeCoords.length - 1) {
          // Reset to start
          currentSegment = 0;
          progress = 0;
        }

        const start = routeCoords[currentSegment];
        const end = routeCoords[currentSegment + 1];

        // Interpolate position
        const lng = start[0] + (end[0] - start[0]) * progress;
        const lat = start[1] + (end[1] - start[1]) * progress;

        // Calculate bearing for this segment
        const bearing = calculateBearing(start, end);

        // Update rotation using MapLibre's setRotation method
        if (Math.abs(bearing - currentBearingValue) > 2) {
          currentBearingValue = bearing;
          transportMarker.setRotation(bearing);
        }

        // Update bus position
        transportMarker.setLngLat([lng, lat]);

        // Update progress
        progress += busSpeed;

        if (progress >= 1) {
          progress = 0;
          currentSegment++;
        }

        requestAnimationFrame(animateBus);
      }

      // Start animation
      animateBus();

      // Ajustar bounds para mostrar toda a rota
      const bounds = new maplibregl.LngLatBounds();
      routeCoords.forEach((coord) => bounds.extend(coord));
      map.fitBounds(bounds, { padding: 50 });
      } // End of addStopsAndBus function
    }); // End of map.on("load")

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Empty dependency array - only initialize map once

  // Resize map when maximized state changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        mapInstanceRef.current?.resize();
      }, 100);
    }
  }, [isMaximized]);

  // Note: Bus position is now animated along the route automatically
  // If you need to update based on real GPS data, you can modify the animation logic
  // to use transportLat/transportLng props instead of the simulated route animation

  return (
    <>
      <style jsx global>{`
        /* Estilos do mapa MapLibre */
        .maplibregl-map {
          height: 100%;
          width: 100%;
          border-radius: 0.75rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* Map container styles */
        .map-container {
          position: relative;
          height: 500px;
          width: 100%;
          border-radius: 0.75rem;
          overflow: hidden;
          background: #f3f4f6;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          transition: all 0.3s ease;
        }

        .map-container.maximized {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          z-index: 9999;
          border-radius: 0;
          margin: 0;
        }

        /* Maximize button */
        .map-maximize-btn {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 1000;
          background: white;
          border: none;
          border-radius: 6px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          transition: all 0.2s ease;
        }

        .map-maximize-btn:hover {
          background: #f9fafb;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .map-maximize-btn:active {
          transform: scale(0.95);
        }

        .map-maximize-btn svg {
          width: 20px;
          height: 20px;
          color: #374151;
        }

        /* Marcador da paragem (pickup) */
        .paragem-marker-container {
          position: relative;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
        }

        .destination-marker-container {
          position: relative;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
        }

        .paragem-icon {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 2;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
        }

        .paragem-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 24px;
          height: 24px;
          border-radius: 50%;
          opacity: 0.6;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          z-index: 1;
        }

        .paragem-pulse.pickup {
          background: #10b981; /* Green for pickup */
        }

        .paragem-pulse.destination {
          background: #ef4444; /* Red for destination */
        }

        /* Animações */
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

        /* Ajustes para popups do MapLibre */
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

        .maplibregl-popup-tip {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        /* Controles do mapa */
        .maplibregl-ctrl-group {
          border-radius: 6px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
        }

        .maplibregl-ctrl-group button {
          border-bottom: 1px solid #e5e7eb;
        }

        .maplibregl-ctrl-group button:last-child {
          border-bottom: none;
        }
      `}</style>
      <div className={`map-container ${isMaximized ? 'maximized' : ''}`}>
        <button
          className="map-maximize-btn"
          onClick={() => setIsMaximized(!isMaximized)}
          title={isMaximized ? "Minimizar mapa" : "Maximizar mapa"}
        >
          {isMaximized ? (
            // Minimize icon
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            // Maximize icon
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>
        <div 
          ref={mapRef} 
          style={{ 
            height: "100%", 
            width: "100%"
          }} 
        />
      </div>
    </>
  );
}
