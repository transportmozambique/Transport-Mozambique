import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBusLocation } from '@/lib/busLocationService';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const busId = params.id;
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const paragemId = searchParams.get('paragem');
    const destinationId = searchParams.get('destination');

    console.log('🚌 Fetching bus with ID:', busId, 'paragem:', paragemId, 'destination:', destinationId);

    // Use shared bus location service
    const busData = await getBusLocation(busId);

    if (!busData) {
      console.log('⚠️  Bus not found with ID:', busId);
      return NextResponse.json(
        { error: 'Bus not found' },
        { status: 404 }
      );
    }

    // Mark pickup and destination stops if provided
    if (paragemId && busData.stops) {
      console.log('🔍 Marking stops - paragemId:', paragemId, 'destinationId:', destinationId);
      console.log('🔍 Total stops:', busData.stops.length);
      
      busData.stops = busData.stops.map(stop => {
        const isPickup = stop.id === paragemId;
        const isDestination = destinationId ? stop.id === destinationId : false;
        
        if (isPickup) console.log('✅ Marked PICKUP stop:', stop.nome, stop.id);
        if (isDestination) console.log('✅ Marked DESTINATION stop:', stop.nome, stop.id);
        
        return {
          ...stop,
          isPickup,
          isDestination
        };
      }) as any; // Type assertion to allow dynamic properties
      
      console.log('🔍 Stops after marking:', (busData.stops as any[]).filter((s: any) => s.isPickup || s.isDestination));
    }

    // If paragem and destination are provided, calculate journey details
    if (paragemId && destinationId) {
      const [pickupStop, destinationStop] = await Promise.all([
        prisma.paragem.findUnique({ where: { id: paragemId } }),
        prisma.paragem.findUnique({ where: { id: destinationId } })
      ]);

      if (pickupStop && destinationStop) {
        // Calculate journey details
        const [pickupLat, pickupLng] = pickupStop.geoLocation.split(',').map(Number);
        const [destLat, destLng] = destinationStop.geoLocation.split(',').map(Number);
        
        // Haversine formula for journey distance
        const R = 6371e3; // Earth's radius in meters
        const φ1 = (pickupLat * Math.PI) / 180;
        const φ2 = (destLat * Math.PI) / 180;
        const Δφ = ((destLat - pickupLat) * Math.PI) / 180;
        const Δλ = ((destLng - pickupLng) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) * 
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const journeyDistance = Math.round(R * c); // meters
        const velocidade = 45; // km/h
        const journeyTime = Math.ceil(journeyDistance / 1000 / velocidade * 60); // minutes
        
        // Calculate fare based on journey distance: 10 MT per kilometer
        const distanceKm = journeyDistance / 1000;
        let fare = Math.max(10, Math.ceil(distanceKm * 10)); // Minimum 10 MT, then 10 MT per km

        // Calculate distance from bus to pickup
        const [busLat, busLng] = [busData.latitude, busData.longitude];
        const φ3 = (busLat * Math.PI) / 180;
        const φ4 = (pickupLat * Math.PI) / 180;
        const Δφ2 = ((pickupLat - busLat) * Math.PI) / 180;
        const Δλ2 = ((pickupLng - busLng) * Math.PI) / 180;

        const a2 = Math.sin(Δφ2 / 2) * Math.sin(Δφ2 / 2) +
                   Math.cos(φ3) * Math.cos(φ4) * 
                   Math.sin(Δλ2 / 2) * Math.sin(Δλ2 / 2);
        const c2 = 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));

        const distanceToBus = Math.round(R * c2); // meters
        const timeToBus = Math.ceil(distanceToBus / 1000 / velocidade * 60); // minutes
        const totalTime = timeToBus + journeyTime;

        // Add journey details to bus data (extend the type)
        Object.assign(busData, {
          journeyDistance,
          journeyTime,
          totalTime,
          fare,
          userJourney: {
            from: pickupStop.nome,
            to: destinationStop.nome,
            fromId: pickupStop.id,
            toId: destinationStop.id
          },
          direcao: `${pickupStop.nome} → ${destinationStop.nome}`
        });
        
        console.log(`✅ Added journey details: ${journeyDistance}m, ${journeyTime}min, ${fare}MT`);
      }
    }

    console.log(`✅ Returning bus data for: ${busData.matricula} on ${busData.via}`);

    return NextResponse.json(busData);
  } catch (error: any) {
    console.error('❌ Error fetching bus:', error);
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
