import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const busId = params.id;
    
    // Get origem and destino from query params
    const searchParams = request.nextUrl.searchParams;
    const paragemId = searchParams.get('paragem'); // User's origin (EMBARQUE)
    const destinoId = searchParams.get('destino'); // User's destination (DESTINO)

    console.log('\n🔍 Fetching bus details:');
    console.log(`   Bus ID: ${busId}`);
    console.log(`   User EMBARQUE (paragemId): ${paragemId || 'not provided'}`);
    console.log(`   User DESTINO (destinoId): ${destinoId || 'not provided'}\n`);

    // Get the transport with its via and stops
    const transporte = await prisma.transporte.findUnique({
      where: { id: busId },
      include: {
        via: {
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
        },
        geoLocations: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    console.log('Transport found:', transporte ? 'Yes' : 'No');

    if (!transporte) {
      console.log('Bus not found with ID:', busId);
      return NextResponse.json(
        { error: 'Bus not found' },
        { status: 404 }
      );
    }

    if (!transporte.via) {
      return NextResponse.json(
        { error: 'Route (via) not assigned to this transport' },
        { status: 400 }
      );
    }

    const { via } = transporte;

    // Get current location
    let currentLat: number;
    let currentLng: number;
    
    if (transporte.currGeoLocation) {
      [currentLat, currentLng] = transporte.currGeoLocation.split(',').map(Number);
      console.log('Using currGeoLocation:', currentLat, currentLng);
    } else if (transporte.geoLocations.length > 0) {
      [currentLat, currentLng] = transporte.geoLocations[0].geoLocationTransporte.split(',').map(Number);
      console.log('Using geoLocations:', currentLat, currentLng);
    } else {
      // Default to first stop
      const firstStop = via.paragens[0];
      if (firstStop) {
        [currentLat, currentLng] = firstStop.paragem.geoLocation.split(',').map(Number);
        console.log('Using first stop location:', currentLat, currentLng);
      } else {
        currentLat = -25.9692;
        currentLng = 32.5732;
        console.log('Using default location:', currentLat, currentLng);
      }
    }

    // Get route coordinates from bus's individual route or via's default route
    const routeCoords = transporte.routePath
      ? transporte.routePath.split(';').map((coord) => {
          const [lng, lat] = coord.split(',').map(Number);
          return [lng, lat];
        })
      : via.geoLocationPath.split(';').map((coord) => {
          const [lng, lat] = coord.split(',').map(Number);
          return [lng, lat];
        });

    console.log('Route coords count:', routeCoords.length);

    // Get stops and mark origem/destino
    const stops = via.paragens.map((vp) => {
      const [lat, lng] = vp.paragem.geoLocation.split(',').map(Number);
      return {
        id: vp.paragem.id,
        nome: vp.paragem.nome,
        latitude: lat,
        longitude: lng,
        isTerminal: vp.terminalBoolean,
        isPickup: vp.paragem.id === paragemId,  // Mark pickup stop
        isDestination: vp.paragem.id === destinoId,  // Mark destination stop
      };
    });

    console.log('Stops count:', stops.length);
    console.log('Stops with isPickup:', stops.filter(s => s.isPickup).length);
    console.log('Stops with isDestination:', stops.filter(s => s.isDestination).length);
    
    // Verify order
    const pickupIndex = stops.findIndex(s => s.isPickup);
    const destinationIndex = stops.findIndex(s => s.isDestination);
    if (pickupIndex !== -1 && destinationIndex !== -1) {
      console.log(`   🔴 EMBARQUE at index: ${pickupIndex} (${stops[pickupIndex].nome})`);
      console.log(`   🔵 DESTINO at index: ${destinationIndex} (${stops[destinationIndex].nome})`);
      if (pickupIndex < destinationIndex) {
        console.log('   ✅ CORRECT ORDER: Embarque comes BEFORE Destino');
      } else {
        console.error('   ❌ WRONG ORDER: Embarque comes AFTER Destino!');
        console.error('   This will cause the bus to pass destino before embarque!');
      }
    }

    // Calculate distances and times based on user's journey (origem → destino)
    let tempoChegada = 5; // Default
    let distanciaAteOrigem = 1000; // Default
    let tempoViagem = 10; // Default
    let distanciaViagem = 2000; // Default
    let fare = 10; // Default minimum

    if (paragemId && destinoId) {
      // Find origem and destino indices in the route
      const origemIndex = stops.findIndex(stop => stop.id === paragemId);
      const destinoIndex = stops.findIndex(stop => stop.id === destinoId);

      console.log(`   Origem index: ${origemIndex}`);
      console.log(`   Destino index: ${destinoIndex}`);

      if (origemIndex !== -1 && destinoIndex !== -1 && origemIndex < destinoIndex) {
        // Helper function to calculate distance
        const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
          const R = 6371e3;
          const φ1 = (lat1 * Math.PI) / 180;
          const φ2 = (lat2 * Math.PI) / 180;
          const Δφ = ((lat2 - lat1) * Math.PI) / 180;
          const Δλ = ((lng2 - lng1) * Math.PI) / 180;

          const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          
          return R * c;
        };

        // Find closest stop to current bus position
        let closestStopIndex = 0;
        let minDistance = Infinity;

        stops.forEach((stop, index) => {
          const dist = calculateDistance(currentLat, currentLng, stop.latitude, stop.longitude);
          if (dist < minDistance) {
            minDistance = dist;
            closestStopIndex = index;
          }
        });

        console.log(`   Closest stop index: ${closestStopIndex}`);

        // Calculate distance from bus to origem
        distanciaAteOrigem = 0;
        
        if (closestStopIndex <= origemIndex) {
          // Bus hasn't reached origem yet
          distanciaAteOrigem = minDistance; // Distance to closest stop
          
          // Add distances between stops from closest to origem
          for (let i = closestStopIndex; i < origemIndex; i++) {
            distanciaAteOrigem += calculateDistance(
              stops[i].latitude,
              stops[i].longitude,
              stops[i + 1].latitude,
              stops[i + 1].longitude
            );
          }
        } else {
          // Bus already passed origem
          distanciaAteOrigem = 0;
        }

        tempoChegada = Math.max(1, Math.ceil(distanciaAteOrigem / 1000 / 45 * 60)); // 45 km/h

        // Calculate user's journey distance (origem → destino)
        distanciaViagem = 0;
        for (let i = origemIndex; i < destinoIndex; i++) {
          distanciaViagem += calculateDistance(
            stops[i].latitude,
            stops[i].longitude,
            stops[i + 1].latitude,
            stops[i + 1].longitude
          );
        }

        tempoViagem = Math.ceil(distanciaViagem / 1000 / 30 * 60); // 30 km/h city speed

        // Calculate fare based on user's journey
        const distanciaViagemKm = distanciaViagem / 1000;
        fare = Math.max(10, Math.ceil(distanciaViagemKm * 10)); // 10 MT per km

        console.log(`   ⏱️  Tempo chegada: ${tempoChegada} min`);
        console.log(`   📏 Distância até origem: ${(distanciaAteOrigem / 1000).toFixed(1)} km`);
        console.log(`   🚶 Distância viagem: ${(distanciaViagem / 1000).toFixed(1)} km`);
        console.log(`   🕐 Tempo viagem: ${tempoViagem} min`);
        console.log(`   💰 Preço: ${fare} MT\n`);
      }
    }

    const response = {
      id: transporte.id,
      matricula: transporte.matricula,
      via: via.nome,
      viaId: via.id,
      direcao: `${via.terminalPartida} → ${via.terminalChegada}`,
      velocidade: 45,
      latitude: currentLat,
      longitude: currentLng,
      status: 'Em Circulação',
      routeCoords,
      stops,
      // Add calculated values
      tempoEstimado: tempoChegada,
      distancia: Math.round(distanciaAteOrigem),
      tempoViagem: tempoViagem,
      distanciaViagem: Math.round(distanciaViagem),
      fare: fare,
    };

    console.log('Returning bus data for:', response.matricula);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching bus:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
