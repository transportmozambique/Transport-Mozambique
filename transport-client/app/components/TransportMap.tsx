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
}: TransportMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const transportMarkerRef = useRef<maplibregl.Marker | null>(null);
  const paragemMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]); // Store all stop markers
  const actualRouteRef = useRef<[number, number][]>([]); // Store the actual OSRM route coordinates
  const stopsAddedRef = useRef(false); // Track if stops have been added to prevent duplicates
  const [isMaximized, setIsMaximized] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false); // Track if map is initialized

  useEffect(() => {
    console.log('🗺️ TransportMap useEffect - Initializing map');
    console.log('   Stops prop:', stops?.length || 0);
    console.log('   Map initialized:', mapInitialized);
    
    if (!mapRef.current) {
      console.log('   ⚠️ Skipping: mapRef not ready');
      return;
    }
    
    if (mapInstanceRef.current) {
      console.log('   ⚠️ Skipping: map already exists');
      return;
    }
    
    if (mapInitialized) {
      console.log('   ⚠️ Skipping: map already initialized');
      return;
    }
    
    console.log('   ✅ Creating new map instance');
    setMapInitialized(true);

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
        // Limit waypoints to avoid OSRM errors (max 100 waypoints)
        const maxWaypoints = 100;
        const limitedCoords = routeCoords.length > maxWaypoints 
          ? routeCoords.filter((_, i) => i % Math.ceil(routeCoords.length / maxWaypoints) === 0)
          : routeCoords;
        
        const waypointsString = limitedCoords.map(w => `${w[0]},${w[1]}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson&steps=true`;

        fetch(osrmUrl)
          .then(response => {
            console.log('OSRM response status:', response.status);
            if (!response.ok) {
              console.warn(`OSRM returned status ${response.status}, using direct route`);
              drawRoute(routeCoords);
              return null;
            }
            return response.json();
          })
          .then(data => {
            if (!data) return; // Already handled in previous then
            
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
            console.warn('OSRM routing unavailable, using direct route:', error.message);
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
        
        // Store the actual route coordinates for marker snapping
        actualRouteRef.current = coordinates;
        console.log('✅ Stored actual route coordinates:', coordinates.length, 'points');
        
        // Desenhar rota
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

        console.log('Route layer added, adding stops and bus');
        
        // Continue with stops and bus
        addStopsAndBus(coordinates);
      }

      // Function to add stops and bus
      function addStopsAndBus(actualRouteCoords: [number, number][]) {
      // Prevent adding stops multiple times
      if (stopsAddedRef.current) {
        console.log('⚠️ Stops already added, skipping to prevent duplicates');
        return;
      }
      
      stopsAddedRef.current = true;
      console.log('✅ Setting stopsAddedRef to true');
      
      // Clean up existing stop markers first to prevent duplicates
      console.log('🧹 Cleaning up', stopMarkersRef.current.length, 'existing stop markers');
      stopMarkersRef.current.forEach(marker => marker.remove());
      stopMarkersRef.current = [];
      
      // Use the actual drawn route coordinates (OSRM-generated) for snapping
      console.log('🎯 Using', actualRouteCoords.length, 'OSRM route coordinates for marker snapping');
      
      // Adicionar paragens
      // Use provided stops if available, otherwise create default stops
      const defaultStops: Array<{
        position: [number, number];
        title: string;
        isTerminal: boolean;
        isPickup: boolean;
        isDestination: boolean;
      }> = [
        { position: actualRouteCoords[0], title: "Terminal Início", isTerminal: true, isPickup: false, isDestination: false },
        { position: actualRouteCoords[Math.floor(actualRouteCoords.length * 0.25)], title: "Paragem 1", isTerminal: false, isPickup: false, isDestination: false },
        { position: actualRouteCoords[Math.floor(actualRouteCoords.length * 0.5)], title: "Paragem 2", isTerminal: false, isPickup: false, isDestination: false },
        { position: actualRouteCoords[Math.floor(actualRouteCoords.length * 0.75)], title: "Paragem 3", isTerminal: false, isPickup: false, isDestination: false },
        { position: actualRouteCoords[actualRouteCoords.length - 1], title: "Terminal Fim", isTerminal: true, isPickup: false, isDestination: false },
      ];

      let stopsToRender;
      
      if (stops && stops.length > 0) {
        console.log('🗺️ TransportMap - Rendering stops:', stops.length);
        console.log('🗺️ OSRM route has', actualRouteCoords.length, 'coordinate points');
        console.log('🗺️ Stops with isPickup:', stops.filter(s => s.isPickup).length);
        console.log('🗺️ Stops with isDestination:', stops.filter(s => s.isDestination).length);
        
        // Helper function to find closest point on a line segment
        const closestPointOnSegment = (
          point: [number, number],
          segmentStart: [number, number],
          segmentEnd: [number, number]
        ): [number, number] => {
          const [px, py] = point;
          const [x1, y1] = segmentStart;
          const [x2, y2] = segmentEnd;
          
          const dx = x2 - x1;
          const dy = y2 - y1;
          
          if (dx === 0 && dy === 0) {
            return segmentStart; // Segment is a point
          }
          
          // Calculate the parameter t that represents the projection of point onto the line
          const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
          
          // Calculate the closest point on the segment
          return [x1 + t * dx, y1 + t * dy];
        };
        
        // First pass: snap all stops to the OSRM route (on line segments, not just points)
        const snappedStops = stops.map(stop => {
          const stopLngLat: [number, number] = [stop.longitude, stop.latitude];
          
          // Find the closest point on any line segment of the OSRM route
          let minDistance = Infinity;
          let closestPoint = stopLngLat;
          let closestSegmentIndex = -1;
          
          for (let i = 0; i < actualRouteCoords.length - 1; i++) {
            const segmentStart = actualRouteCoords[i];
            const segmentEnd = actualRouteCoords[i + 1];
            
            // Find closest point on this segment
            const pointOnSegment = closestPointOnSegment(stopLngLat, segmentStart, segmentEnd);
            
            // Calculate distance to this point
            const dx = pointOnSegment[0] - stopLngLat[0];
            const dy = pointOnSegment[1] - stopLngLat[1];
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistance) {
              minDistance = distance;
              closestPoint = pointOnSegment;
              closestSegmentIndex = i;
            }
          }
          
          const distanceKm = (minDistance * 111).toFixed(1);
          const logPrefix = stop.isPickup ? '🔴 PICKUP' : stop.isDestination ? '🔵 DEST' : '⚪';
          console.log(`${logPrefix} "${stop.nome}": [${stopLngLat[0].toFixed(5)}, ${stopLngLat[1].toFixed(5)}] → [${closestPoint[0].toFixed(5)}, ${closestPoint[1].toFixed(5)}] (${distanceKm}km, segment #${closestSegmentIndex})`);
          
          return {
            position: closestPoint,
            title: stop.nome,
            isTerminal: stop.isTerminal,
            isPickup: stop.isPickup || false,
            isDestination: stop.isDestination || false,
            routeIndex: closestSegmentIndex,
          };
        });
        
        // Second pass: fix destination if it's before pickup
        const pickupStop = snappedStops.find(s => s.isPickup);
        const destinationStop = snappedStops.find(s => s.isDestination);
        
        if (pickupStop && destinationStop && destinationStop.routeIndex <= pickupStop.routeIndex) {
          console.warn(`⚠️ Destination (segment #${destinationStop.routeIndex}) is before or at pickup (segment #${pickupStop.routeIndex})`);
          console.log('   Fixing: Moving destination to next segment after pickup');
          
          // Find a point on the next segment after pickup
          const nextSegmentIndex = pickupStop.routeIndex + 1;
          if (nextSegmentIndex < actualRouteCoords.length - 1) {
            // Use the midpoint of the next segment
            const segmentStart = actualRouteCoords[nextSegmentIndex];
            const segmentEnd = actualRouteCoords[nextSegmentIndex + 1];
            const midpoint: [number, number] = [
              (segmentStart[0] + segmentEnd[0]) / 2,
              (segmentStart[1] + segmentEnd[1]) / 2
            ];
            destinationStop.position = midpoint;
            destinationStop.routeIndex = nextSegmentIndex;
            console.log(`   ✅ Destination moved to segment #${nextSegmentIndex}: [${destinationStop.position[0].toFixed(5)}, ${destinationStop.position[1].toFixed(5)}]`);
          }
        }
        
        stopsToRender = snappedStops;
      } else {
        stopsToRender = defaultStops;
      }

      stopsToRender.forEach((stop) => {
        console.log(`🔍 Processing stop: ${stop.title}, isPickup: ${stop.isPickup}, isDestination: ${stop.isDestination}, position: [${stop.position}]`);
        
        let marker: maplibregl.Marker;
        
        // Check if this is pickup or destination - render special markers
        if (stop.isPickup) {
          console.log('🔴 Rendering RED pulsing pickup marker for:', stop.title);
          console.log('   Exact position:', stop.position);
          
          // Create pulsing red marker for pickup (like paragem marker)
          const pickupEl = document.createElement("div");
          pickupEl.className = "paragem-marker-container pickup-marker";
          pickupEl.setAttribute('data-marker-type', 'pickup');
          pickupEl.style.cssText = `
            position: absolute !important;
            pointer-events: auto !important;
          `;
          pickupEl.innerHTML = `
            <div class="paragem-pulse pickup"></div>
            <div class="paragem-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="12" fill="#dc2626" stroke="white" stroke-width="3"/>
                <circle cx="16" cy="16" r="5" fill="white"/>
              </svg>
            </div>
          `;

          marker = new maplibregl.Marker({ 
            element: pickupEl,
            anchor: 'center', // Center the marker on the coordinates
            draggable: false // Ensure marker cannot be dragged
          })
            .setLngLat(stop.position as [number, number])
            .setPopup(
              new maplibregl.Popup({ offset: 16 }).setHTML(
                `<strong>${stop.title}</strong><br><span style="color: #dc2626;">🔴 Sua paragem de embarque</span>`
              )
            )
            .addTo(map);
          
          console.log('✅ Pickup marker added at:', marker.getLngLat());
            
        } else if (stop.isDestination) {
          console.log('🔵 Rendering BLUE pulsing destination marker for:', stop.title);
          console.log('   Exact position:', stop.position);
          console.log('   Creating destination marker - should only happen once');
          
          // Create pulsing blue marker for destination
          const destinationEl = document.createElement("div");
          destinationEl.className = "paragem-marker-container destination-marker";
          destinationEl.setAttribute('data-marker-type', 'destination');
          destinationEl.style.cssText = `
            position: absolute !important;
            pointer-events: auto !important;
          `;
          destinationEl.innerHTML = `
            <div class="paragem-pulse destination"></div>
            <div class="paragem-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="12" fill="#3b82f6" stroke="white" stroke-width="3"/>
                <circle cx="16" cy="16" r="5" fill="white"/>
              </svg>
            </div>
          `;

          marker = new maplibregl.Marker({ 
            element: destinationEl,
            anchor: 'center', // Center the marker on the coordinates
            draggable: false // Ensure marker cannot be dragged
          })
            .setLngLat(stop.position as [number, number])
            .setPopup(
              new maplibregl.Popup({ offset: 16 }).setHTML(
                `<strong>${stop.title}</strong><br><span style="color: #3b82f6;">🔵 Seu destino</span>`
              )
            )
            .addTo(map);
          
          console.log('✅ Destination marker added at:', marker.getLngLat());
          console.log('   Marker element classes:', destinationEl.className);
            
        } else {
          // Regular stop markers (gray or black for terminals)
          let markerColor = stop.isTerminal ? "#1f2937" : "#6b7280";
          let markerSize = stop.isTerminal ? "18px" : "14px";
          
          const el = document.createElement("div");
          el.style.cssText = `
            width: ${markerSize};
            height: ${markerSize};
            background: ${markerColor};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
          `;

          marker = new maplibregl.Marker({ 
            element: el,
            anchor: 'center' // Center the marker on the coordinates
          })
            .setLngLat(stop.position as [number, number])
            .setPopup(
              new maplibregl.Popup({ offset: 15 }).setHTML(`<strong>${stop.title}</strong>`)
            )
            .addTo(map);
        }
        
        // Store marker reference for cleanup
        stopMarkersRef.current.push(marker);
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

      // Start position on the route - USE OSRM ROUTE COORDINATES
      const startPos = actualRouteCoords[0];
      const nextPos = actualRouteCoords[1];
      const initialBearing = calculateBearing(startPos, nextPos);
      
      // Log bus animation setup
      console.log('\n🚌 === BUS ANIMATION SETUP ===');
      console.log('   Using OSRM route coordinates for bus animation');
      console.log('   Route has', actualRouteCoords.length, 'coordinate points');
      console.log('   Bus starts at:', startPos);
      console.log('   Bus will move towards:', nextPos);
      console.log('   Initial bearing:', initialBearing.toFixed(2), 'degrees');
      
      // Find pickup and destination positions in route
      if (stops && stops.length > 0) {
        const pickupStop = stops.find(s => s.isPickup);
        const destinationStop = stops.find(s => s.isDestination);
        
        if (pickupStop && destinationStop) {
          const pickupIndex = stops.findIndex(s => s.isPickup);
          const destinationIndex = stops.findIndex(s => s.isDestination);
          
          console.log('\n📍 PICKUP & DESTINATION POSITIONS:');
          console.log('   🔴 PICKUP:', pickupStop.nome);
          console.log('      - Stop index:', pickupIndex, 'of', stops.length);
          console.log('      - Coordinates:', [pickupStop.longitude, pickupStop.latitude]);
          console.log('   🔵 DESTINATION:', destinationStop.nome);
          console.log('      - Stop index:', destinationIndex, 'of', stops.length);
          console.log('      - Coordinates:', [destinationStop.longitude, destinationStop.latitude]);
          
          if (pickupIndex < destinationIndex) {
            console.log('   ✅ Bus will pass PICKUP first, then DESTINATION');
            console.log('      Direction: CORRECT (pickup → destination)');
          } else {
            console.error('   ❌ Bus will pass DESTINATION first, then PICKUP');
            console.error('      Direction: WRONG (destination → pickup)');
            console.error('      The route or stops order needs to be fixed!');
          }
          
          console.log('\n🎯 BUS JOURNEY:');
          console.log('   Start: Route point #0');
          console.log('   → Pass PICKUP at stop #' + pickupIndex);
          console.log('   → Pass DESTINATION at stop #' + destinationIndex);
          console.log('   End: Route point #' + (routeCoords ? routeCoords.length - 1 : 'n/a'));
        }
      }
      console.log('=================================\n');

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
      
      // Track if bus has passed pickup and destination (for logging)
      let passedPickup = false;
      let passedDestination = false;
      const pickupStopIndex = stops?.findIndex(s => s.isPickup) ?? -1;
      const destinationStopIndex = stops?.findIndex(s => s.isDestination) ?? -1;

      // Animate bus along the route - USE OSRM ROUTE COORDINATES
      function animateBus() {
        if (currentSegment >= actualRouteCoords.length - 1) {
          // Reset to start
          currentSegment = 0;
          progress = 0;
          passedPickup = false;
          passedDestination = false;
          console.log('🔄 Bus completed route, restarting from beginning');
        }

        const start = actualRouteCoords[currentSegment];
        const end = actualRouteCoords[currentSegment + 1];

        // Interpolate position
        const lng = start[0] + (end[0] - start[0]) * progress;
        const lat = start[1] + (end[1] - start[1]) * progress;

        // Check if bus is passing pickup or destination stops
        if (stops && stops.length > 0) {
          // Rough check: if current segment is near a stop index
          const currentStopApprox = Math.floor((currentSegment / actualRouteCoords.length) * stops.length);
          
          if (!passedPickup && pickupStopIndex !== -1 && currentStopApprox >= pickupStopIndex) {
            passedPickup = true;
            console.log('🔴 Bus is now passing PICKUP stop:', stops[pickupStopIndex].nome);
            console.log('   Segment:', currentSegment, 'of', actualRouteCoords.length);
          }
          
          if (!passedDestination && destinationStopIndex !== -1 && currentStopApprox >= destinationStopIndex) {
            passedDestination = true;
            console.log('🔵 Bus is now passing DESTINATION stop:', stops[destinationStopIndex].nome);
            console.log('   Segment:', currentSegment, 'of', actualRouteCoords.length);
            
            // Check if this is correct order
            if (passedPickup) {
              console.log('   ✅ CORRECT: Bus passed pickup BEFORE destination');
            } else {
              console.error('   ❌ WRONG: Bus passed destination BEFORE pickup!');
            }
          }
        }

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

      // Only add fallback paragem marker if no stops were provided
      // (When stops are provided, pickup/destination markers are already rendered in the loop above)
      if (!stops || stops.length === 0) {
        // Criar elemento HTML para o marcador da paragem (fallback)
        const paragemEl = document.createElement("div");
        paragemEl.className = "paragem-marker-container";
        paragemEl.innerHTML = `
          <div class="paragem-pulse pickup"></div>
          <div class="paragem-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="12" fill="#dc2626" stroke="white" stroke-width="3"/>
              <circle cx="16" cy="16" r="5" fill="white"/>
            </svg>
          </div>
        `;

        // Adicionar marcador da paragem
        const paragemMarker = new maplibregl.Marker({ element: paragemEl })
          .setLngLat([paragemLng, paragemLat])
          .setPopup(
            new maplibregl.Popup({ offset: 16 }).setHTML(
              `<strong>${paragemNome || "Sua Paragem"}</strong><br><span style="color: #dc2626;">🔴 Aguardando transporte</span>`
            )
          )
          .addTo(map);

        paragemMarkerRef.current = paragemMarker;
      }

      // Ajustar bounds para mostrar toda a rota
      const bounds = new maplibregl.LngLatBounds();
      actualRouteCoords.forEach((coord) => bounds.extend(coord));
      map.fitBounds(bounds, { padding: 50 });
      } // End of addStopsAndBus function
    }); // End of map.on("load")

    // Cleanup
    return () => {
      console.log('🗺️ Cleaning up map and markers');
      
      // Remove all stop markers
      stopMarkersRef.current.forEach(marker => marker.remove());
      stopMarkersRef.current = [];
      stopsAddedRef.current = false; // Reset flag
      
      // Remove transport marker
      if (transportMarkerRef.current) {
        transportMarkerRef.current.remove();
        transportMarkerRef.current = null;
      }
      
      // Remove paragem marker
      if (paragemMarkerRef.current) {
        paragemMarkerRef.current.remove();
        paragemMarkerRef.current = null;
      }
      
      // Remove map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      
      setMapInitialized(false);
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

        /* Marcador da paragem e destino */
        .paragem-marker-container {
          position: relative;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          pointer-events: auto;
        }

        .paragem-icon {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 2;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
          pointer-events: none;
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
          pointer-events: none;
        }

        .paragem-pulse.pickup {
          background: #dc2626; /* Red for pickup */
        }

        .paragem-pulse.destination {
          background: #3b82f6; /* Blue for destination */
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
