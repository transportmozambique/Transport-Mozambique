import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAllBusesWithLocations } from '@/lib/busLocationService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paragemId = searchParams.get('paragemId');
    const viaId = searchParams.get('viaId');
    const destinationId = searchParams.get('destinationId'); // User's destination stop

    console.log('📍 Fetching buses for paragemId:', paragemId, 'viaId:', viaId, 'destinationId:', destinationId);

    // If no parameters, return all buses using shared service
    if (!paragemId && !viaId) {
      console.log('🚌 Fetching all buses in circulation using shared service');
      
      const allBuses = await getAllBusesWithLocations();

      console.log(`✅ Found ${allBuses.length} buses in circulation`);

      const response = NextResponse.json({
        buses: allBuses,
        total: allBuses.length,
      });
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    if (!paragemId || !viaId) {
      console.log('⚠️  Missing required parameters');
      return NextResponse.json(
        { error: 'paragemId and viaId are required' },
        { status: 400 }
      );
    }

    const paragem = await prisma.paragem.findUnique({
      where: { id: paragemId },
    });

    if (!paragem) {
      // Instead of returning error, return all buses
      console.log('⚠️  Paragem not found, returning all buses as fallback');
      const allBuses = await getAllBusesWithLocations();
      return NextResponse.json({
        buses: allBuses,
        total: allBuses.length,
      });
    }

    // Check if this paragem is connected to the via through ViaParagem
    const viaParagem = await prisma.viaParagem.findFirst({
      where: {
        viaId: viaId,
        paragemId: paragemId
      }
    });

    if (!viaParagem) {
      console.log('⚠️  This stop is not on this route (no ViaParagem relation)');
      // Return empty or search for routes that DO pass through this stop
      const routesThroughStop = await prisma.via.findMany({
        where: {
          paragens: {
            some: {
              paragemId: paragemId
            }
          }
        },
        select: {
          id: true,
          codigo: true,
          nome: true
        },
        take: 5
      });

      if (routesThroughStop.length > 0) {
        console.log(`ℹ️  Found ${routesThroughStop.length} routes that pass through this stop:`,
          routesThroughStop.map(r => r.codigo).join(', '));
      }

      return NextResponse.json({
        buses: [],
        total: 0,
        message: 'This stop is not on the selected route',
        alternativeRoutes: routesThroughStop
      });
    }

    const via = await prisma.via.findUnique({
      where: { id: viaId },
      include: {
        paragens: {
          include: {
            paragem: true,
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!via) {
      // Instead of returning error, return all buses
      console.log('⚠️  Via not found, returning all buses as fallback');
      const allBuses = await getAllBusesWithLocations();
      return NextResponse.json({
        buses: allBuses,
        total: allBuses.length,
      });
    }

    const transportes = await prisma.transporte.findMany({
      where: {
        viaId: viaId,
      },
      select: {
        id: true,
        matricula: true,
        currGeoLocation: true,
        via: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            terminalPartida: true,
            terminalChegada: true,
            geoLocationPath: true,
            paragens: {
              select: {
                terminalBoolean: true,
                paragem: {
                  select: {
                    id: true,
                    nome: true,
                    geoLocation: true
                  }
                }
              },
              orderBy: {
                id: 'asc'
              }
              // Removed limit - show all stops
            }
          }
        },
        geoLocations: {
          select: {
            geoLocationTransporte: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
      // Removed limit - show all buses on route
    });

    const [paragemLat, paragemLng] = paragem.geoLocation.split(',').map(Number);

    // Get destination stop if provided
    let destinationStop = null;
    if (destinationId) {
      destinationStop = await prisma.paragem.findUnique({
        where: { id: destinationId },
      });
      
      // Verify destination is also on this route
      if (destinationStop) {
        const destViaParagem = await prisma.viaParagem.findFirst({
          where: {
            viaId: viaId,
            paragemId: destinationId
          }
        });
        
        if (!destViaParagem) {
          console.log('⚠️  Destination stop is not on this route');
          destinationStop = null; // Ignore invalid destination
        }
      }
    }

    if (transportes.length === 0) {
      console.log('⚠️  No buses found on this via, returning all buses as fallback');
      
      const allBuses = await getAllBusesWithLocations();

      // Calculate distance to paragem for all buses
      const busesWithDistance = allBuses.map((bus) => {
        const R = 6371e3;
        const φ1 = (bus.latitude * Math.PI) / 180;
        const φ2 = (paragemLat * Math.PI) / 180;
        const Δφ = ((paragemLat - bus.latitude) * Math.PI) / 180;
        const Δλ = ((paragemLng - bus.longitude) * Math.PI) / 180;

        const a =
          Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        let distancia = Math.round(R * c);

        const velocidade = 45;
        let tempoEstimado = Math.ceil(distancia / 1000 / velocidade * 60);
        
        if (distancia < 50) {
          tempoEstimado = 2;
          distancia = 0;
        } else if (tempoEstimado === 0) {
          tempoEstimado = 1;
        }

        return {
          ...bus,
          distancia,
          tempoEstimado,
          velocidade,
        };
      });

      busesWithDistance.sort((a, b) => a.tempoEstimado - b.tempoEstimado);

      return NextResponse.json({
        buses: busesWithDistance,
        paragem: {
          id: paragem.id,
          nome: paragem.nome,
          latitude: paragemLat,
          longitude: paragemLng,
        },
      });
    }

    const busesWithDetails = transportes.map((transporte) => {
      let currentLat, currentLng;
      
      if (transporte.currGeoLocation) {
        [currentLat, currentLng] = transporte.currGeoLocation.split(',').map(Number);
      } else if (transporte.geoLocations.length > 0) {
        [currentLat, currentLng] = transporte.geoLocations[0].geoLocationTransporte.split(',').map(Number);
      } else {
        const firstStop = transporte.via.paragens[0];
        if (firstStop && firstStop.paragem.geoLocation) {
          [currentLat, currentLng] = firstStop.paragem.geoLocation.split(',').map(Number);
        } else {
          currentLat = paragemLat;
          currentLng = paragemLng;
        }
      }

      const R = 6371e3;
      const φ1 = (currentLat * Math.PI) / 180;
      const φ2 = (paragemLat * Math.PI) / 180;
      const Δφ = ((paragemLat - currentLat) * Math.PI) / 180;
      const Δλ = ((paragemLng - currentLng) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      let distancia = Math.round(R * c);

      const velocidade = 45;
      let tempoEstimado = Math.ceil(distancia / 1000 / velocidade * 60);
      
      if (distancia < 50) {
        tempoEstimado = 2;
        distancia = 0;
      } else if (tempoEstimado === 0) {
        tempoEstimado = 1;
      }

      let routeCoords: [number, number][] = [];
      if (transporte.via.geoLocationPath) {
        // Limit route coords to 50 points to reduce memory
        routeCoords = transporte.via.geoLocationPath.split(';').slice(0, 50).map((coord) => {
          const [lng, lat] = coord.split(',').map(Number);
          return [lng, lat];
        });
      }

      // Calculate journey details if destination is provided
      let journeyDistance = 0;
      let journeyTime = 0;
      let totalTime = tempoEstimado;
      let fare = 0;

      if (destinationStop) {
        // Calculate distance from pickup to destination (Haversine)
        const [destLat, destLng] = destinationStop.geoLocation.split(',').map(Number);
        
        const φ3 = (destLat * Math.PI) / 180;
        const Δφ2 = ((destLat - paragemLat) * Math.PI) / 180;
        const Δλ2 = ((destLng - paragemLng) * Math.PI) / 180;

        const a2 = Math.sin(Δφ2 / 2) * Math.sin(Δφ2 / 2) +
                   Math.cos(φ2) * Math.cos(φ3) * 
                   Math.sin(Δλ2 / 2) * Math.sin(Δλ2 / 2);
        const c2 = 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));

        journeyDistance = Math.round(R * c2); // meters
        journeyTime = Math.ceil(journeyDistance / 1000 / velocidade * 60); // minutes
        totalTime = tempoEstimado + journeyTime;

        // Calculate fare based on journey distance: 10 MT per kilometer
        const distanceKm = journeyDistance / 1000;
        fare = Math.max(10, Math.ceil(distanceKm * 10)); // Minimum 10 MT, then 10 MT per km
      }

      return {
        id: transporte.id,
        matricula: transporte.matricula,
        via: transporte.via.nome,
        viaId: transporte.via.id,
        // Show user's journey if destination provided, otherwise show full route
        direcao: destinationStop 
          ? `${paragem.nome} → ${destinationStop.nome}` 
          : `${transporte.via.terminalPartida} → ${transporte.via.terminalChegada}`,
        // Full bus route (for reference)
        fullRoute: `${transporte.via.terminalPartida} → ${transporte.via.terminalChegada}`,
        // User's journey segment
        userJourney: destinationStop ? {
          from: paragem.nome,
          to: destinationStop.nome,
          fromId: paragem.id,
          toId: destinationStop.id
        } : null,
        
        // Distance and time from bus to pickup
        distancia,              // Distance from bus to pickup (meters)
        tempoEstimado,          // Time until bus arrives at pickup (minutes)
        
        // Journey details (pickup to destination)
        journeyDistance,        // Distance from pickup to destination (meters)
        journeyTime,            // Time from pickup to destination (minutes)
        totalTime,              // Total time: bus arrival + journey (minutes)
        fare,                   // Fare based on journey distance (MT)
        
        velocidade,
        latitude: currentLat,
        longitude: currentLng,
        status: 'Em Circulação',
        routeCoords,
        stops: transporte.via.paragens.map((vp) => {
          const [lat, lng] = vp.paragem.geoLocation.split(',').map(Number);
          return {
            id: vp.paragem.id,
            nome: vp.paragem.nome,
            latitude: lat,
            longitude: lng,
            isTerminal: vp.terminalBoolean,
            // Mark if this is user's pickup or destination
            isPickup: vp.paragem.id === paragemId,
            isDestination: destinationStop ? vp.paragem.id === destinationId : false,
          };
        }),
      };
    });

    busesWithDetails.sort((a, b) => a.tempoEstimado - b.tempoEstimado);

    console.log(`✅ Found ${busesWithDetails.length} buses on route ${via.codigo}`);

    return NextResponse.json({
      buses: busesWithDetails,
      paragem: {
        id: paragem.id,
        nome: paragem.nome,
        latitude: paragemLat,
        longitude: paragemLng,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching buses:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Instead of returning error, return empty array with error info
    return NextResponse.json({
      buses: [],
      total: 0,
      error: error.message
    });
  }
}
