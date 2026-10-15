import { prisma } from '@/lib/prisma';

// Parse geolocation string
function parseGeoLocation(geoStr: string): { lat: number; lng: number } | null {
  if (!geoStr) return null;
  const parts = geoStr.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  
  // Maputo coordinates: lat around -25 to -26, lng around 32
  if (parts[0] < 0 && parts[0] > -30) {
    return { lat: parts[0], lng: parts[1] };
  } else {
    return { lat: parts[1], lng: parts[0] };
  }
}

// Determine region based on coordinates
function determineRegion(lat: number, lng: number): 'Maputo' | 'Matola' {
  // Matola is generally west of Maputo (lower longitude)
  // Rough boundary: lng < 32.48 is Matola, >= 32.48 is Maputo
  if (lng < 32.48) {
    return 'Matola';
  } else {
    return 'Maputo';
  }
}

// Determine neighborhood based on coordinates and stop name
function determineNeighborhood(stopName: string, lat: number, lng: number, region: 'Maputo' | 'Matola'): string {
  const name = stopName.toLowerCase();
  
  if (region === 'Maputo') {
    // Maputo neighborhoods based on coordinates and keywords
    if (name.includes('baixa') || name.includes('praça') || name.includes('trabalhadores') || 
        name.includes('albert') || name.includes('laurentina') || (lat > -25.98 && lng > 32.56)) {
      return 'Baixa / Central';
    }
    if (name.includes('polana') || name.includes('sommerschield') || (lat > -25.97 && lat < -25.96 && lng > 32.58)) {
      return 'Polana / Museu';
    }
    if (name.includes('alto maé') || name.includes('alto mae')) {
      return 'Alto Maé';
    }
    if (name.includes('xipamanine') || (lat > -25.95 && lat < -25.94 && lng > 32.56)) {
      return 'Xipamanine';
    }
    if (name.includes('hulene') || (lat > -25.92 && lat < -25.90 && lng > 32.59)) {
      return 'Hulene';
    }
    if (name.includes('magoanine') || (lat > -25.88 && lat < -25.87 && lng > 32.60)) {
      return 'Magoanine';
    }
    if (name.includes('zimpeto') || (lat > -25.87 && lat < -25.86 && lng > 32.61)) {
      return 'Zimpeto';
    }
    if (name.includes('albasine') || name.includes('albazine') || (lat > -25.85 && lat < -25.83 && lng > 32.63)) {
      return 'Albazine';
    }
    if (name.includes('jardim') || (lat > -25.97 && lat < -25.96 && lng > 32.57)) {
      return 'Jardim';
    }
    if (name.includes('maxaquene') || (lat > -25.96 && lat < -25.94 && lng > 32.56 && lng < 32.58)) {
      return 'Xipamanine';
    }
    if (name.includes('aeroporto') || name.includes('airport') || (lat > -25.93 && lat < -25.91 && lng > 32.57)) {
      return 'Alto Maé';
    }
    
    return 'Baixa / Central';
  } else {
    // Matola neighborhoods based on coordinates and keywords
    if (name.includes('matola sede') || name.includes('sede') || (lat > -25.98 && lng < 32.46)) {
      return 'Matola Sede';
    }
    if (name.includes('machava') || (lat > -25.92 && lat < -25.90 && lng < 32.50)) {
      return 'Machava';
    }
    if (name.includes('matola gare') || name.includes('gare') || (lat > -25.83 && lat < -25.82 && lng < 32.46)) {
      return 'Matola Gare';
    }
    if (name.includes('tchumene') || (lat > -25.89 && lat < -25.88 && lng < 32.41)) {
      return 'Tchumene';
    }
    if (name.includes('t3') || name.includes('t-3') || (lat > -25.91 && lat < -25.90 && lng > 32.51 && lng < 32.53)) {
      return 'T3';
    }
    if (name.includes('fomento') || (lat > -25.93 && lat < -25.91 && lng < 32.49)) {
      return 'Fomento';
    }
    if (name.includes('liberdade') || (lat > -25.95 && lat < -25.93 && lng < 32.47)) {
      return 'Liberdade';
    }
    if (name.includes('malhampsene') || (lat > -25.90 && lat < -25.88 && lng < 32.44)) {
      return 'Malhampsene';
    }
    if (name.includes('godinho') || name.includes('shoprite') || (lat > -25.96 && lat < -25.94 && lng < 32.47)) {
      return 'Matola Sede';
    }
    if (name.includes('portagem') || (lat > -25.95 && lat < -25.93 && lng > 32.50 && lng < 32.52)) {
      return 'Fomento';
    }
    
    return 'Matola Sede';
  }
}

/**
 * Get all neighborhoods in a region from database
 * Returns neighborhoods that have at least one stop connected to routes
 */
export async function getNeighborhoodsByRegion(region: string): Promise<string[]> {
  try {
    // Get all stops that are connected to routes (have ViaParagem relations)
    const stopsWithRoutes = await prisma.paragem.findMany({
      where: {
        vias: {
          some: {} // Has at least one ViaParagem relation
        }
      },
      select: {
        nome: true,
        geoLocation: true
      }
    });

    // Group stops by neighborhood
    const neighborhoodSet = new Set<string>();

    for (const stop of stopsWithRoutes) {
      const coords = parseGeoLocation(stop.geoLocation);
      if (!coords) continue;

      const stopRegion = determineRegion(coords.lat, coords.lng);
      if (stopRegion !== region) continue;

      const neighborhood = determineNeighborhood(stop.nome, coords.lat, coords.lng, stopRegion);
      neighborhoodSet.add(neighborhood);
    }

    // Convert to array and sort
    const neighborhoods = Array.from(neighborhoodSet).sort();

    console.log(`📍 Found ${neighborhoods.length} neighborhoods in ${region}:`, neighborhoods);

    return neighborhoods;
  } catch (error) {
    console.error('Error getting neighborhoods from database:', error);
    // Fallback to empty array
    return [];
  }
}

/**
 * Get all stops in a neighborhood from database
 * Returns only stops that are connected to routes
 */
export async function getStopsByNeighborhood(neighborhood: string, region: string): Promise<string[]> {
  try {
    // Get all stops that are connected to routes
    const stopsWithRoutes = await prisma.paragem.findMany({
      where: {
        vias: {
          some: {} // Has at least one ViaParagem relation
        }
      },
      select: {
        nome: true,
        geoLocation: true
      },
      orderBy: {
        nome: 'asc'
      }
    });

    // Filter stops by neighborhood
    const neighborhoodStops: string[] = [];

    for (const stop of stopsWithRoutes) {
      const coords = parseGeoLocation(stop.geoLocation);
      if (!coords) continue;

      const stopRegion = determineRegion(coords.lat, coords.lng);
      if (stopRegion !== region) continue;

      const stopNeighborhood = determineNeighborhood(stop.nome, coords.lat, coords.lng, stopRegion);
      if (stopNeighborhood === neighborhood) {
        neighborhoodStops.push(stop.nome);
      }
    }

    // Remove duplicates and sort
    const uniqueStops = Array.from(new Set(neighborhoodStops)).sort();

    console.log(`🚏 Found ${uniqueStops.length} stops in ${neighborhood}, ${region}`);

    // If no stops found, return neighborhood name as fallback
    if (uniqueStops.length === 0) {
      console.log(`⚠️  No stops found for ${neighborhood}, returning neighborhood name`);
      return [neighborhood];
    }

    return uniqueStops;
  } catch (error) {
    console.error('Error getting stops from database:', error);
    // Fallback to neighborhood name
    return [neighborhood];
  }
}

/**
 * Get all available regions from database
 */
export async function getAvailableRegions(): Promise<string[]> {
  try {
    const stopsWithRoutes = await prisma.paragem.findMany({
      where: {
        vias: {
          some: {}
        }
      },
      select: {
        geoLocation: true
      }
    });

    const regions = new Set<string>();

    for (const stop of stopsWithRoutes) {
      const coords = parseGeoLocation(stop.geoLocation);
      if (!coords) continue;

      const region = determineRegion(coords.lat, coords.lng);
      regions.add(region);
    }

    return Array.from(regions).sort();
  } catch (error) {
    console.error('Error getting regions from database:', error);
    return ['Maputo', 'Matola']; // Fallback
  }
}
