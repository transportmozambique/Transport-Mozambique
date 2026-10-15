import { prisma } from '@/lib/prisma';

// Route paths with street names (same as in USSD)
const routePathsWithStreets: { [key: string]: { name: string; waypoints: Array<{ location: string; street: string; coords: string }> } } = {
  'VIA-1A': {
    name: 'Rota 1a: Baixa - Chamissava',
    waypoints: [
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Av. 25 de Setembro', street: 'Av. 25 de Setembro', coords: '-25.9700,32.5720' },
      { location: 'Av. Julius Nyerere', street: 'Av. Julius Nyerere', coords: '-25.9650,32.5750' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9600,32.5650' },
      { location: 'Av. de Moçambique', street: 'Av. de Moçambique', coords: '-25.9500,32.5500' },
      { location: 'Chamissava', street: 'Estrada de Chamissava', coords: '-26.0371,32.5186' }
    ]
  },
  'VIA-MAT-BAI': {
    name: 'Matola Sede - Baixa',
    waypoints: [
      { location: 'Terminal Matola Sede', street: 'Av. União Africana', coords: '-25.9794,32.4589' },
      { location: 'Godinho', street: 'Av. União Africana', coords: '-25.9528,32.4655' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-T3-BAI': {
    name: 'Rota T3-Baixa',
    waypoints: [
      { location: 'T3 (Terminal)', street: 'Estrada Circular', coords: '-25.9083,32.5222' },
      { location: 'Mussumbuluco', street: 'Estrada Circular', coords: '-25.8894,32.5117' },
      { location: 'Av. de Moçambique', street: 'Av. de Moçambique', coords: '-25.9300,32.5400' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-POL-BAI': {
    name: 'Rota Polana-Baixa',
    waypoints: [
      { location: 'Polana Cimento', street: 'Av. Julius Nyerere', coords: '-25.9650,32.5850' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9680,32.5800' },
      { location: 'Av. 25 de Setembro', street: 'Av. 25 de Setembro', coords: '-25.9700,32.5720' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-MAG-BAI': {
    name: 'Rota Magoanine-Baixa',
    waypoints: [
      { location: 'Magoanine A', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Zimpeto', street: 'Estrada Circular', coords: '-25.8643,32.6186' },
      { location: 'Av. de Moçambique', street: 'Av. de Moçambique', coords: '-25.9000,32.5800' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-17': {
    name: 'Rota 17: Baixa - Zimpeto',
    waypoints: [
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Hulene', street: 'Av. de Moçambique', coords: '-25.9083,32.5939' },
      { location: 'Magoanine', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Terminal Zimpeto', street: 'Estrada do Zimpeto', coords: '-25.8643,32.6186' }
    ]
  },
  'VIA-21': {
    name: 'Rota 21: Museu - Albasine',
    waypoints: [
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Av. Julius Nyerere', street: 'Av. Julius Nyerere', coords: '-25.9600,32.5900' },
      { location: 'Jardim', street: 'Av. de Moçambique', coords: '-25.9688,32.5714' },
      { location: 'Zimpeto', street: 'Estrada Circular', coords: '-25.8643,32.6186' },
      { location: 'Albasine', street: 'Estrada de Albasine', coords: '-25.8373,32.6382' }
    ]
  },
  'VIA-53': {
    name: 'Rota 53: Baixa - Albasine',
    waypoints: [
      { location: 'Laurentina', street: 'Av. 24 de Julho', coords: '-25.9734,32.5694' },
      { location: 'Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Jardim', street: 'Av. de Moçambique', coords: '-25.9688,32.5714' },
      { location: 'Zimpeto', street: 'Estrada Circular', coords: '-25.8643,32.6186' },
      { location: 'Albasine', street: 'Estrada de Albasine', coords: '-25.8373,32.6382' }
    ]
  },
  'VIA-MACH-MUS': {
    name: 'Machava Sede - Museu',
    waypoints: [
      { location: 'Machava Sede', street: 'Av. das Indústrias', coords: '-25.9125,32.4914' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9600,32.5650' },
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' }
    ]
  },
  'VIA-TCH-BAI': {
    name: 'Tchumene - Baixa',
    waypoints: [
      { location: 'Tchumene', street: 'Estrada Nacional N4', coords: '-25.8856,32.4042' },
      { location: 'Malhampsene', street: 'Estrada Nacional N4', coords: '-25.8885,32.4336' },
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  // Add remaining routes...
  'VIA-MAT-MUS': {
    name: 'Matola Sede - Museu',
    waypoints: [
      { location: 'Terminal Matola Sede', street: 'Av. União Africana', coords: '-25.9794,32.4589' },
      { location: 'Godinho', street: 'Av. União Africana', coords: '-25.9528,32.4655' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' }
    ]
  },
  'VIA-MAL-MUS': {
    name: 'Malhampsene - Museu',
    waypoints: [
      { location: 'Malhampsene', street: 'Estrada Nacional N4', coords: '-25.8885,32.4336' },
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' }
    ]
  },
  'VIA-MGARE-BAI': {
    name: 'Matola Gare - Baixa',
    waypoints: [
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-37': {
    name: 'Rota 37: Museu - Zimpeto',
    waypoints: [
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Av. Julius Nyerere', street: 'Av. Julius Nyerere', coords: '-25.9600,32.5900' },
      { location: 'Av. de Moçambique', street: 'Av. de Moçambique', coords: '-25.9300,32.5600' },
      { location: 'Magoanine', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Terminal Zimpeto', street: 'Estrada do Zimpeto', coords: '-25.8643,32.6186' }
    ]
  },
  'VIA-39A': {
    name: 'Rota 39a: Baixa - Zimpeto',
    waypoints: [
      { location: 'Albert Lithule', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Hulene', street: 'Av. de Moçambique', coords: '-25.9083,32.5939' },
      { location: 'Magoanine', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Terminal Zimpeto', street: 'Estrada do Zimpeto', coords: '-25.8643,32.6186' }
    ]
  },
  'VIA-39B': {
    name: 'Rota 39b: Baixa - Boquisso',
    waypoints: [
      { location: 'Albert Lithule', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Hulene', street: 'Av. de Moçambique', coords: '-25.9083,32.5939' },
      { location: 'Magoanine', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Boquisso', street: 'Estrada de Boquisso', coords: '-25.8200,32.6500' }
    ]
  },
  'VIA-47': {
    name: 'Rota 47: Baixa - Tchumene',
    waypoints: [
      { location: 'Albert Lithule', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Malhampsene', street: 'Estrada Nacional N4', coords: '-25.8885,32.4336' },
      { location: 'Tchumene', street: 'Estrada Nacional N4', coords: '-25.8856,32.4042' }
    ]
  },
  'VIA-51A': {
    name: 'Rota 51a: Baixa - Boane',
    waypoints: [
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Boane', street: 'Estrada Nacional N2', coords: '-26.0500,32.3200' }
    ]
  },
  'VIA-51C': {
    name: 'Rota 51c: Baixa - Mafuiane',
    waypoints: [
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Mafuiane', street: 'Estrada Nacional N2', coords: '-26.1000,32.2800' }
    ]
  },
  'VIA-11': {
    name: 'Rota 11: Baixa - Michafutene',
    waypoints: [
      { location: 'Albert Lithule', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Hulene', street: 'Av. de Moçambique', coords: '-25.9083,32.5939' },
      { location: 'Michafutene', street: 'Estrada de Michafutene', coords: '-25.8500,32.6800' }
    ]
  },
  'VIA-20': {
    name: 'Rota 20: Baixa - Matendene',
    waypoints: [
      { location: 'Albert Lithule', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Hulene', street: 'Av. de Moçambique', coords: '-25.9083,32.5939' },
      { location: 'Matendene', street: 'Estrada de Matendene', coords: '-25.8300,32.6600' }
    ]
  },
  'VIA-POL-MAT': {
    name: 'Rota Polana-Matola',
    waypoints: [
      { location: 'Polana Shopping', street: 'Av. Julius Nyerere', coords: '-25.9650,32.5850' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9680,32.5800' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Terminal Matola Sede', street: 'Av. União Africana', coords: '-25.9794,32.4589' }
    ]
  },
  'VIA-T3-MUS': {
    name: 'Rota T3-Museu',
    waypoints: [
      { location: 'T3 Mercado', street: 'Estrada Circular', coords: '-25.9083,32.5222' },
      { location: 'Av. de Moçambique', street: 'Av. de Moçambique', coords: '-25.9300,32.5400' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9600,32.5650' },
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' }
    ]
  },
  'VIA-MAG-ZIM': {
    name: 'Rota Magoanine-Zimpeto',
    waypoints: [
      { location: 'Magoanine B', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Terminal Zimpeto', street: 'Estrada do Zimpeto', coords: '-25.8643,32.6186' }
    ]
  },
  'VIA-FOM-BAI': {
    name: 'Rota Fomento-Baixa',
    waypoints: [
      { location: 'Fomento (Paragem)', street: 'Av. das Indústrias', coords: '-25.9200,32.4800' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-SOM-BAI': {
    name: 'Rota Sommerschield-Baixa',
    waypoints: [
      { location: 'Sommerschield', street: 'Av. Julius Nyerere', coords: '-25.9600,32.5900' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9680,32.5800' },
      { location: 'Av. 25 de Setembro', street: 'Av. 25 de Setembro', coords: '-25.9700,32.5720' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-MAX-BAI': {
    name: 'Rota Maxaquene-Baixa',
    waypoints: [
      { location: 'Maxaquene', street: 'Av. de Moçambique', coords: '-25.9500,32.5700' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-AER-BAI': {
    name: 'Rota Aeroporto-Baixa',
    waypoints: [
      { location: 'Aeroporto', street: 'Av. Acordos de Lusaka', coords: '-25.9208,32.5728' },
      { location: 'Av. Julius Nyerere', street: 'Av. Julius Nyerere', coords: '-25.9600,32.5750' },
      { location: 'Av. 25 de Setembro', street: 'Av. 25 de Setembro', coords: '-25.9700,32.5720' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  }
};

/**
 * Get current street location based on route code and progress
 */
export function getCurrentStreetLocation(routeCode: string, progress: number): {
  street: string;
  location: string;
  coords: string | null;
  description: string;
} {
  const route = routePathsWithStreets[routeCode];
  if (!route || !route.waypoints || route.waypoints.length === 0) {
    return { street: 'Em rota', location: 'Desconhecido', coords: null, description: 'Em rota' };
  }
  
  // Calculate which waypoint based on progress (0-1)
  const index = Math.floor(progress * (route.waypoints.length - 1));
  const nextIndex = Math.min(index + 1, route.waypoints.length - 1);
  
  const currentWaypoint = route.waypoints[index];
  const nextWaypoint = route.waypoints[nextIndex];
  
  // If close to next waypoint, show "próximo de"
  const localProgress = (progress * (route.waypoints.length - 1)) - index;
  
  if (localProgress < 0.3) {
    return {
      street: currentWaypoint.street,
      location: currentWaypoint.location,
      coords: currentWaypoint.coords,
      description: `Em ${currentWaypoint.street}`
    };
  } else if (localProgress > 0.7 && nextIndex !== index) {
    return {
      street: currentWaypoint.street,
      location: `Próximo de ${nextWaypoint.location}`,
      coords: currentWaypoint.coords,
      description: `Em ${currentWaypoint.street}, próximo de ${nextWaypoint.location}`
    };
  } else {
    return {
      street: currentWaypoint.street,
      location: `Entre ${currentWaypoint.location} e ${nextWaypoint.location}`,
      coords: currentWaypoint.coords,
      description: `Em ${currentWaypoint.street}`
    };
  }
}

/**
 * Get bus current location with street name (optimized)
 * This is the shared function used by both webapp and USSD
 */
export async function getBusLocation(busId: string) {
  try {
    const bus = await prisma.transporte.findUnique({
      where: { id: busId },
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
              // Show all stops
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
    });

    if (!bus) {
      return null;
    }

    // Get current coordinates from database (updated by simulation)
    let currentLat, currentLng;
    
    if (bus.currGeoLocation) {
      [currentLat, currentLng] = bus.currGeoLocation.split(',').map(Number);
    } else if (bus.geoLocations.length > 0) {
      [currentLat, currentLng] = bus.geoLocations[0].geoLocationTransporte.split(',').map(Number);
    } else {
      const firstStop = bus.via.paragens[0];
      if (firstStop && firstStop.paragem.geoLocation) {
        [currentLat, currentLng] = firstStop.paragem.geoLocation.split(',').map(Number);
      } else {
        currentLat = -25.9692;
        currentLng = 32.5732;
      }
    }

    // Get route coords for progress calculation
    const routeCoords = bus.via.geoLocationPath
      ? bus.via.geoLocationPath.split(';').map((coord) => {
          const [lng, lat] = coord.split(',').map(Number);
          return [lng, lat] as [number, number];
        })
      : [];

    // Calculate progress based on actual position
    let progress = 0;
    if (routeCoords.length > 1) {
      // Find closest point on route to current position
      let minDistance = Infinity;
      let closestIndex = 0;
      
      routeCoords.forEach(([lng, lat], index) => {
        const distance = Math.sqrt(
          Math.pow(lat - currentLat, 2) + Math.pow(lng - currentLng, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      
      progress = closestIndex / (routeCoords.length - 1);
    }

    // Get street location based on actual progress
    const streetLocation = getCurrentStreetLocation(bus.via.codigo, progress);

    // Get stops
    const stops = bus.via.paragens.map((vp) => {
      const [lat, lng] = vp.paragem.geoLocation.split(',').map(Number);
      return {
        id: vp.paragem.id,
        nome: vp.paragem.nome,
        latitude: lat,
        longitude: lng,
        isTerminal: vp.terminalBoolean
      };
    });

    // Limit route coords for display (reduce memory)
    const displayRouteCoords = routeCoords.slice(0, 50);

    return {
      id: bus.id,
      matricula: bus.matricula,
      via: bus.via.nome,
      viaId: bus.via.id,
      viaCodigo: bus.via.codigo,
      direcao: `${bus.via.terminalPartida} → ${bus.via.terminalChegada}`,
      latitude: currentLat,
      longitude: currentLng,
      streetLocation: streetLocation.description,
      streetName: streetLocation.street,
      nearLocation: streetLocation.location,
      status: 'Em Circulação',
      routeCoords: displayRouteCoords,
      stops
    };
  } catch (error) {
    console.error('Error getting bus location:', error);
    return null;
  }
}

/**
 * Get all buses with their current locations (optimized - single query)
 */
export async function getAllBusesWithLocations() {
  try {
    const buses = await prisma.transporte.findMany({
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
              // Show all stops
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
      },
      orderBy: {
        id: 'asc' // Stable sort order
      }
    });

    // Process buses without additional queries
    const busesWithLocations = buses.map((bus) => {
      // Get route coords for display
      const routeCoords = bus.via.geoLocationPath
        ? bus.via.geoLocationPath.split(';').map((coord) => {
            const [lng, lat] = coord.split(',').map(Number);
            return [lng, lat] as [number, number];
          })
        : [];

      // Get ACTUAL current coordinates from database (updated by simulation)
      let currentLat, currentLng;
      
      if (bus.currGeoLocation) {
        // Use the actual location from database (simulation updates this)
        [currentLat, currentLng] = bus.currGeoLocation.split(',').map(Number);
      } else if (bus.geoLocations.length > 0) {
        // Fallback to latest geoLocation
        [currentLat, currentLng] = bus.geoLocations[0].geoLocationTransporte.split(',').map(Number);
      } else if (routeCoords.length > 0) {
        // Fallback to start of route
        [currentLng, currentLat] = routeCoords[0];
      } else {
        // Last resort: use first stop
        const firstStop = bus.via.paragens[0];
        if (firstStop && firstStop.paragem.geoLocation) {
          [currentLat, currentLng] = firstStop.paragem.geoLocation.split(',').map(Number);
        } else {
          currentLat = -25.9692;
          currentLng = 32.5732;
        }
      }

      // Calculate progress based on actual position (for street location display)
      let progress = 0;
      if (routeCoords.length > 1) {
        // Find closest point on route to current position
        let minDistance = Infinity;
        let closestIndex = 0;
        
        routeCoords.forEach(([lng, lat], index) => {
          const distance = Math.sqrt(
            Math.pow(lat - currentLat, 2) + Math.pow(lng - currentLng, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
          }
        });
        
        progress = closestIndex / (routeCoords.length - 1);
      }

      // Get street location based on actual progress
      const streetLocation = getCurrentStreetLocation(bus.via.codigo, progress);

      // Get stops
      const stops = bus.via.paragens.map((vp) => {
        const [lat, lng] = vp.paragem.geoLocation.split(',').map(Number);
        return {
          id: vp.paragem.id,
          nome: vp.paragem.nome,
          latitude: lat,
          longitude: lng,
          isTerminal: vp.terminalBoolean
        };
      });

      // Limit route coords for display (reduce memory)
      const displayRouteCoords = routeCoords.slice(0, 50);

      return {
        id: bus.id,
        matricula: bus.matricula,
        via: bus.via.nome,
        viaId: bus.via.id,
        viaCodigo: bus.via.codigo,
        direcao: `${bus.via.terminalPartida} → ${bus.via.terminalChegada}`,
        latitude: currentLat,
        longitude: currentLng,
        streetLocation: streetLocation.description,
        streetName: streetLocation.street,
        nearLocation: streetLocation.location,
        status: 'Em Circulação',
        routeCoords: displayRouteCoords,
        routePath: displayRouteCoords, // Add routePath for main page compatibility
        stops
      };
    });

    return busesWithLocations;
  } catch (error) {
    console.error('Error getting all buses:', error);
    return [];
  }
}
