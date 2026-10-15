import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Africa's Talking USSD format
interface USSDRequest {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data from Africa's Talking
    const formData = await request.formData();
    
    const sessionId = formData.get('sessionId') as string || '';
    const serviceCode = formData.get('serviceCode') as string || '';
    const phoneNumber = formData.get('phoneNumber') as string || '';
    const text = formData.get('text') as string || '';

    // Log for debugging
    console.log('📱 USSD Request:', {
      sessionId,
      serviceCode,
      phoneNumber,
      text,
      timestamp: new Date().toISOString()
    });

    // Process the USSD request
    const response = await handleUSSD(sessionId, phoneNumber, text);

    console.log('📤 USSD Response:', response);

    // Return plain text response
    return new NextResponse(response, {
      status: 200,
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('❌ USSD Error:', error);
    return new NextResponse('END Erro ao processar pedido. Tente novamente.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function handleUSSD(sessionId: string, phoneNumber: string, text: string): Promise<string> {
  // Split user input by * to track navigation
  const inputs = text === '' ? [] : text.split('*');
  const level = inputs.length;

  // LEVEL 0: Main Menu (first interaction)
  if (level === 0) {
    return `CON Bem-vindo ao Sistema de Transportes
1. Encontrar Transporte Agora
2. Procurar Rotas
3. Paragens Próximas
4. Calcular Tarifa
5. Ajuda`;
  }

  // LEVEL 1: Main menu selection
  if (level === 1) {
    const choice = inputs[0];

    switch (choice) {
      case '1':
        // Find transport now - Get available locations from database
        const availableLocations = await getAvailableLocations();
        if (availableLocations.length === 0) {
          return `END Nenhuma localização disponível no momento.`;
        }
        
        let locationMenu = `CON Onde você está agora?\n`;
        availableLocations.slice(0, 7).forEach((loc, i) => {
          locationMenu += `${i + 1}. ${loc}\n`;
        });
        if (availableLocations.length > 7) {
          locationMenu += `8. Outro local\n`;
        }
        locationMenu += `0. Voltar`;
        return locationMenu;

      case '2':
        // Search routes - Get available origins from database
        const availableOrigins = await getAvailableOrigins();
        if (availableOrigins.length === 0) {
          return `END Nenhuma rota disponível no momento.`;
        }
        
        let originMenu = `CON Procurar Rotas - Escolha origem:\n`;
        availableOrigins.slice(0, 8).forEach((origin, i) => {
          originMenu += `${i + 1}. ${origin}\n`;
        });
        if (availableOrigins.length > 8) {
          originMenu += `9. Outro (digitar nome)\n`;
        }
        originMenu += `0. Voltar`;
        return originMenu;

      case '3':
        // Nearest stops - Get available areas from database
        const availableAreas = await getAvailableAreas();
        if (availableAreas.length === 0) {
          return `END Nenhuma paragem disponível no momento.`;
        }
        
        let areaMenu = `CON Paragens Próximas - Escolha área:\n`;
        availableAreas.slice(0, 8).forEach((area, i) => {
          areaMenu += `${i + 1}. ${area}\n`;
        });
        if (availableAreas.length > 8) {
          areaMenu += `9. Outro (digitar nome)\n`;
        }
        areaMenu += `0. Voltar`;
        return areaMenu;

      case '4':
        // Calculate fare - Get available locations from database
        const fareLocations = await getAvailableLocations();
        if (fareLocations.length === 0) {
          return `END Nenhuma localização disponível no momento.`;
        }
        
        let fareMenu = `CON Calcular Tarifa\nEscolha sua origem:\n`;
        fareLocations.slice(0, 7).forEach((loc, i) => {
          fareMenu += `${i + 1}. ${loc}\n`;
        });
        if (fareLocations.length > 7) {
          fareMenu += `8. Outro\n`;
        }
        fareMenu += `0. Voltar`;
        return fareMenu;

      case '5':
        return `END Sistema de Transportes - Ajuda

Marque *384*123# para:
- Encontrar transporte proximo
- Ver tempo de chegada
- Calcular tarifa
- Procurar rotas

Suporte: info@transporte.mz`;

      default:
        return `END Opção inválida. Por favor, tente novamente.`;
    }
  }

  // LEVEL 2: Process user input based on previous choice
  if (level === 2) {
    const mainChoice = inputs[0];
    const userInput = inputs[1];

    // Option 1: Find transport now (NEW)
    if (mainChoice === '1') {
      // Handle back
      if (userInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = await getAvailableLocations();
      
      if (userInput === '8' || parseInt(userInput) > locations.slice(0, 7).length) {
        return `CON Digite sua localização:`;
      }

      const locationIndex = parseInt(userInput) - 1;
      if (locationIndex < 0 || locationIndex >= locations.length) {
        return `END Opção inválida.`;
      }

      const currentLocation = locations[locationIndex];
      
      // Find nearest stop
      const nearestStop = await findNearestStop(currentLocation);
      
      if (!nearestStop) {
        return `END Nenhuma paragem encontrada perto de ${currentLocation}.`;
      }

      // Get available destinations from current location
      const destinations = await getAvailableDestinations(currentLocation);
      
      if (destinations.length === 0) {
        return `END Nenhum transporte disponível de ${currentLocation}.`;
      }

      let destMenu = `CON Você está perto de:\n${nearestStop.name}\n\nPara onde quer ir?\n`;
      destinations.slice(0, 5).forEach((dest, i) => {
        destMenu += `${i + 1}. ${dest}\n`;
      });
      if (destinations.length > 5) {
        destMenu += `6. Outro destino\n`;
      }
      destMenu += `0. Voltar`;
      return destMenu;
    }

    // Option 2: Search routes (EXISTING)
    if (mainChoice === '2') {
      // Handle back
      if (userInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      // Get available origins from database
      const locations = await getAvailableOrigins();
      let origin: string;

      if (userInput === '9' || parseInt(userInput) > locations.slice(0, 8).length) {
        // User wants to type custom location
        return `CON Digite o nome da origem:`;
      } else {
        const locationIndex = parseInt(userInput) - 1;
        if (locationIndex >= 0 && locationIndex < locations.length) {
          origin = locations[locationIndex];
        } else {
          return `END Opção inválida.`;
        }
      }

      // Search routes from database
      const routes = await searchRoutes(origin);

      if (routes.length === 0) {
        return `END Nenhuma rota encontrada de "${origin}".
        
Tente outro nome de local.`;
      }

      // Show up to 9 routes (max for single digit selection)
      let response = `CON Rotas de ${origin}:\n`;
      routes.slice(0, 9).forEach((route, i) => {
        response += `${i + 1}. ${route.destination}\n`;
      });
      
      if (routes.length > 9) {
        response += `\nMostrando 9 de ${routes.length} rotas\n`;
      }
      
      response += `0. Voltar ao menu`;
      return response;
    }

    // Option 3: Nearest stops (EXISTING)
    if (mainChoice === '3') {
      // Handle back
      if (userInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      // Get available areas from database
      const areas = await getAvailableAreas();
      let area: string;

      if (userInput === '9' || parseInt(userInput) > areas.slice(0, 8).length) {
        // User wants to type custom area
        return `CON Digite o nome da área:`;
      } else {
        const areaIndex = parseInt(userInput) - 1;
        if (areaIndex >= 0 && areaIndex < areas.length) {
          area = areas[areaIndex];
        } else {
          return `END Opção inválida.`;
        }
      }
      
      const stops = await searchStops(area);

      if (stops.length === 0) {
        return `END Nenhuma paragem encontrada em "${area}".`;
      }

      let response = `CON Paragens em ${area}:\n\n`;
      stops.slice(0, 9).forEach((stop, i) => {
        response += `${i + 1}. ${stop.name}\n`;
      });
      
      response += `\n0. Voltar ao menu`;
      return response;
    }

    // Option 4: Calculate fare (NEW)
    if (mainChoice === '4') {
      // Handle back
      if (userInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = await getAvailableLocations();
      
      if (userInput === '8' || parseInt(userInput) > locations.slice(0, 7).length) {
        return `CON Digite a origem:`;
      }

      const locationIndex = parseInt(userInput) - 1;
      if (locationIndex < 0 || locationIndex >= locations.length) {
        return `END Opção inválida.`;
      }

      const origin = locations[locationIndex];
      
      // Get available destinations from origin
      const allDestinations = await getAvailableDestinations(origin);
      
      // Filter out same origin
      const destinations = allDestinations.filter(d => d !== origin);
      
      if (destinations.length === 0) {
        return `END Nenhum destino disponível de ${origin}.`;
      }
      
      let destMenu = `CON De: ${origin}\n\nPara onde?\n`;
      destinations.slice(0, 7).forEach((dest, i) => {
        destMenu += `${i + 1}. ${dest}\n`;
      });
      if (destinations.length > 7) {
        destMenu += `8. Outro\n`;
      }
      destMenu += `0. Voltar`;
      return destMenu;
    }

    // Option 5: Saved routes submenu (EXISTING)
    if (mainChoice === '3') {
      if (userInput === '1') {
        const saved = await getSavedRoutes(phoneNumber);
        let response = `END Minhas Rotas Salvas:\n\n`;
        saved.forEach((route, i) => {
          response += `${i + 1}. ${route.origin} → ${route.destination}\n`;
        });
        return response;
      }
      if (userInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }
    }
  }

  // LEVEL 3: Show route details OR handle custom location input OR show transport info
  if (level === 3) {
    const mainChoice = inputs[0];
    const secondChoice = inputs[1];
    const thirdInput = inputs[2];

    // Option 1: Find transport now - Show available transports (NEW)
    if (mainChoice === '1') {
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = await getAvailableLocations();
      const currentLocation = locations[parseInt(secondChoice) - 1];
      
      if (!currentLocation) {
        return `END Localização inválida.`;
      }
      
      const destinations = await getAvailableDestinations(currentLocation);
      
      if (thirdInput === '6' || parseInt(thirdInput) > destinations.slice(0, 5).length) {
        return `CON Digite o destino:`;
      }

      const destIndex = parseInt(thirdInput) - 1;
      if (destIndex < 0 || destIndex >= destinations.length) {
        return `END Opção inválida.`;
      }

      const destination = destinations[destIndex];
      
      // Find routes and calculate info
      const transportInfo = await findTransportInfo(currentLocation, destination);
      
      if (!transportInfo) {
        return `END Nenhum transporte encontrado de ${currentLocation} para ${destination}.`;
      }

      // Create mission for tracking and notification
      try {
        await createMissionForUser(phoneNumber, currentLocation, destination);
      } catch (error) {
        console.error('Error creating mission:', error);
      }

      return `END INFORMACAO DE TRANSPORTE

AUTOCARRO: ${transportInfo.busId}
LOCALIZACAO ATUAL: ${transportInfo.busLocation}

TEMPO ATE CHEGAR A SI: ${transportInfo.timeUntilBusArrives} min
TEMPO DE VIAGEM: ${transportInfo.travelTime} min
TEMPO TOTAL: ${transportInfo.totalTime} min

HORA DE CHEGADA: ${transportInfo.arrivalTime}

DISTANCIA: ${transportInfo.distance} km
TARIFA: ${transportInfo.fare} MT

DE: ${transportInfo.from}
PARA: ${transportInfo.to}

Voce sera notificado via SMS!`;
    }

    // Option 2: Search routes - Handle custom location input (EXISTING)
    if (mainChoice === '2' && secondChoice === '9') {
      const customOrigin = thirdInput.trim();
      
      if (customOrigin.length < 2) {
        return `END Por favor, digite pelo menos 2 caracteres.`;
      }

      const routes = await searchRoutes(customOrigin);

      if (routes.length === 0) {
        return `END Nenhuma rota encontrada de "${customOrigin}".`;
      }

      let response = `CON Rotas de ${customOrigin}:\n`;
      routes.slice(0, 9).forEach((route, i) => {
        response += `${i + 1}. ${route.destination}\n`;
      });
      
      if (routes.length > 9) {
        response += `\nMostrando 9 de ${routes.length} rotas\n`;
      }
      
      response += `0. Voltar ao menu`;
      return response;
    }

    // Option 3: Search stops - Handle custom area input (EXISTING)
    if (mainChoice === '3' && secondChoice === '9') {
      const customArea = thirdInput.trim();
      
      if (customArea.length < 2) {
        return `END Por favor, digite pelo menos 2 caracteres.`;
      }

      const stops = await searchStops(customArea);

      if (stops.length === 0) {
        return `END Nenhuma paragem encontrada em "${customArea}".`;
      }

      let response = `CON Paragens em ${customArea}:\n\n`;
      stops.slice(0, 9).forEach((stop, i) => {
        response += `${i + 1}. ${stop.name}\n`;
      });
      
      response += `\n0. Voltar ao menu`;
      return response;
    }

    // Option 4: Calculate fare - Show fare calculation (NEW)
    if (mainChoice === '4') {
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = await getAvailableLocations();
      const origin = locations[parseInt(secondChoice) - 1];
      
      if (!origin) {
        return `END Origem inválida.`;
      }
      
      const destinations = await getAvailableDestinations(origin);
      
      if (thirdInput === '8' || parseInt(thirdInput) > destinations.slice(0, 7).length) {
        return `CON Digite o destino:`;
      }

      const destIndex = parseInt(thirdInput) - 1;
      if (destIndex < 0 || destIndex >= destinations.length) {
        return `END Opção inválida.`;
      }

      const destination = destinations[destIndex];
      
      // Calculate fare
      const fareInfo = await calculateFare(origin, destination);
      
      return `END CALCULO DE TARIFA

DE: ${origin}
PARA: ${destination}

DISTANCIA: ${fareInfo.distance} km
TARIFA: ${fareInfo.fare} MT
TEMPO: ${fareInfo.duration}

ROTAS DISPONIVEIS: ${fareInfo.routeCount}`;
    }

    // Handle route/stop selection from predefined locations (EXISTING)
    if (mainChoice === '2') {
      // Handle "0" to go back
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }
      
      const routeIndex = parseInt(thirdInput) - 1;
      
      if (isNaN(routeIndex) || routeIndex < 0) {
        return `END Opção inválida.`;
      }

      // Get origin from predefined list
      const locations = ['Matola', 'Maputo Centro', 'Baixa', 'Costa do Sol', 'Sommerschield', 'Polana', 'Aeroporto', 'Maxaquene'];
      const locationIndex = parseInt(secondChoice) - 1;
      const origin = locations[locationIndex];

      const routes = await searchRoutes(origin);

      if (routeIndex >= routes.length) {
        return `END Opção inválida.`;
      }

      const route = routes[routeIndex];
      
      return `END ${route.name}

De: ${route.origin}
Para: ${route.destination}

Horario: ${route.hours || '05:00 - 22:00'}
Tarifa: ${route.fare || '20-30'} MT

Obrigado por usar nosso servico!`;
    }

    if (mainChoice === '3') {
      // Handle "0" to go back
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }
      
      const stopIndex = parseInt(thirdInput) - 1;
      
      if (isNaN(stopIndex) || stopIndex < 0) {
        return `END Opção inválida.`;
      }

      // Get area from predefined list
      const areas = ['Centro', 'Baixa', 'Matola', 'Sommerschield', 'Polana', 'Costa do Sol', 'Maxaquene', 'Aeroporto'];
      const areaIndex = parseInt(secondChoice) - 1;
      const area = areas[areaIndex];

      const stops = await searchStops(area);

      if (stopIndex >= stops.length) {
        return `END Opção inválida.`;
      }

      const stop = stops[stopIndex];
      
      return `END ${stop.name}

${stop.routes ? `Rotas: ${stop.routes}` : 'Sem informacao de rotas'}

Obrigado por usar nosso servico!`;
    }
  }

  // LEVEL 4: Handle route/stop selection after custom input
  if (level === 4) {
    const mainChoice = inputs[0];
    const secondChoice = inputs[1]; // Should be "9"
    const customLocation = inputs[2];
    const selection = inputs[3];

    if (mainChoice === '1' && secondChoice === '9') {
      // Handle "0" to go back
      if (selection === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const routeIndex = parseInt(selection) - 1;
      
      if (isNaN(routeIndex) || routeIndex < 0) {
        return `END Opção inválida.`;
      }

      const routes = await searchRoutes(customLocation);

      if (routeIndex >= routes.length) {
        return `END Opção inválida.`;
      }

      const route = routes[routeIndex];
      
      return `END ${route.name}

De: ${route.origin}
Para: ${route.destination}

Horario: ${route.hours || '05:00 - 22:00'}
Tarifa: ${route.fare || '20-30'} MT

Obrigado por usar nosso servico!`;
    }

    if (mainChoice === '2' && secondChoice === '9') {
      // Handle "0" to go back
      if (selection === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const stopIndex = parseInt(selection) - 1;
      
      if (isNaN(stopIndex) || stopIndex < 0) {
        return `END Opção inválida.`;
      }

      const stops = await searchStops(customLocation);

      if (stopIndex >= stops.length) {
        return `END Opção inválida.`;
      }

      const stop = stops[stopIndex];
      
      return `END ${stop.name}

${stop.routes ? `Rotas: ${stop.routes}` : 'Sem informacao de rotas'}

Obrigado por usar nosso servico!`;
    }
  }

  // Default fallback
  return `END Obrigado por usar o Sistema de Transportes!`;
}

// NEW: Get available locations from database (terminals and major stops)
async function getAvailableLocations(): Promise<string[]> {
  try {
    // Get unique terminal names from routes
    const routes = await prisma.via.findMany({
      select: {
        terminalPartida: true,
        terminalChegada: true,
      },
    });

    const locations = new Set<string>();
    
    routes.forEach(route => {
      if (route.terminalPartida) locations.add(route.terminalPartida);
      if (route.terminalChegada) locations.add(route.terminalChegada);
    });

    // Also add major stops from paragem table
    const majorStops = await prisma.paragem.findMany({
      select: {
        nome: true,
      },
      where: {
        OR: [
          { nome: { contains: 'Terminal' } },
          { nome: { contains: 'Albasine' } },
          { nome: { contains: 'Matola' } },
          { nome: { contains: 'Baixa' } },
          { nome: { contains: 'Museu' } },
          { nome: { contains: 'Zimpeto' } },
        ]
      }
    });

    majorStops.forEach(stop => {
      // Extract main location name (remove parentheses content)
      const mainName = stop.nome.split('(')[0].trim();
      locations.add(mainName);
    });

    console.log('📍 Available locations:', Array.from(locations).sort());

    return Array.from(locations).sort();
  } catch (error) {
    console.error('Error getting available locations:', error);
    return [];
  }
}

// NEW: Get available origins from database
async function getAvailableOrigins(): Promise<string[]> {
  try {
    const routes = await prisma.via.findMany({
      select: {
        terminalPartida: true,
      },
      distinct: ['terminalPartida'],
      orderBy: {
        terminalPartida: 'asc',
      },
    });

    return routes
      .map(r => r.terminalPartida)
      .filter(t => t && t.trim().length > 0);
  } catch (error) {
    console.error('Error getting available origins:', error);
    return [];
  }
}

// NEW: Get available areas from database (based on stops)
async function getAvailableAreas(): Promise<string[]> {
  try {
    const stops = await prisma.paragem.findMany({
      select: {
        nome: true,
      },
      orderBy: {
        nome: 'asc',
      },
    });

    // Extract area names (first word or two)
    const areas = new Set<string>();
    stops.forEach(stop => {
      const words = stop.nome.split(' ');
      if (words.length >= 2) {
        areas.add(`${words[0]} ${words[1]}`);
      } else {
        areas.add(words[0]);
      }
    });

    return Array.from(areas).sort().slice(0, 10);
  } catch (error) {
    console.error('Error getting available areas:', error);
    return [];
  }
}

// NEW: Get available destinations from a given origin
async function getAvailableDestinations(origin: string): Promise<string[]> {
  try {
    // Normalizar origem para busca (remover acentos, lowercase)
    const normalizedOrigin = origin.toLowerCase().trim();
    
    // Buscar rotas onde a origem pode ser terminal de partida OU chegada
    const routes = await prisma.via.findMany({
      where: {
        OR: [
          { terminalPartida: { contains: origin, mode: 'insensitive' } },
          { terminalChegada: { contains: origin, mode: 'insensitive' } },
          { nome: { contains: origin, mode: 'insensitive' } }
        ]
      },
      select: {
        terminalPartida: true,
        terminalChegada: true,
        nome: true,
      },
    });

    console.log(`🔍 Searching destinations from "${origin}":`, {
      normalizedOrigin,
      routesFound: routes.length,
      routes: routes.map(r => ({ 
        partida: r.terminalPartida, 
        chegada: r.terminalChegada, 
        nome: r.nome 
      }))
    });

    // Coletar todos os destinos únicos
    const destinations = new Set<string>();
    
    routes.forEach(route => {
      // Se a origem corresponde ao terminal de partida, adicionar destino
      if (route.terminalPartida && 
          route.terminalPartida.toLowerCase().includes(normalizedOrigin)) {
        if (route.terminalChegada) {
          destinations.add(route.terminalChegada);
          console.log(`✅ Added destination: ${route.terminalChegada} (from partida match)`);
        }
      }
      
      // Se a origem corresponde ao terminal de chegada, adicionar partida (rota inversa)
      if (route.terminalChegada && 
          route.terminalChegada.toLowerCase().includes(normalizedOrigin)) {
        if (route.terminalPartida) {
          destinations.add(route.terminalPartida);
          console.log(`✅ Added destination: ${route.terminalPartida} (from chegada match - reverse)`);
        }
      }
    });

    // Filtrar origem e retornar array ordenado
    const finalDestinations = Array.from(destinations)
      .filter(d => d && d.trim().length > 0 && 
                   !d.toLowerCase().includes(normalizedOrigin))
      .sort();

    console.log(`📍 Final destinations for "${origin}":`, finalDestinations);

    return finalDestinations;
  } catch (error) {
    console.error('Error getting available destinations:', error);
    return [];
  }
}

// Database query functions
async function searchRoutes(origin: string) {
  try {
    // Map common location names to actual terminal names
    const locationMap: { [key: string]: string[] } = {
      'Matola': ['Matola', 'Tchumene', 'Malhampsene', 'Machava'],
      'Maputo Centro': ['Baixa', 'Praça', 'Albert', 'Laurentina'],
      'Baixa': ['Baixa', 'Praça', 'Albert', 'Laurentina'],
      'Costa do Sol': ['Costa do Sol', 'Praia'],
      'Sommerschield': ['Sommerschield'],
      'Polana': ['Polana'],
      'Aeroporto': ['Aeroporto'],
      'Maxaquene': ['Maxaquene'],
      'Museu': ['Museu'],
      'Zimpeto': ['Zimpeto'],
    };

    // Get search terms for this location
    const searchTerms = locationMap[origin] || [origin];
    
    // Build OR conditions for all search terms
    const orConditions = searchTerms.flatMap(term => [
      { terminalPartida: { contains: term } },
      { terminalChegada: { contains: term } },
      { nome: { contains: term } }
    ]);

    // Search in terminal names and route names (case-insensitive for SQLite)
    const routes = await prisma.via.findMany({
      where: {
        OR: orConditions
      },
      select: {
        id: true,
        nome: true,
        terminalPartida: true,
        terminalChegada: true,
      },
      distinct: ['terminalChegada'], // Remove duplicates
      take: 10,
      orderBy: { terminalChegada: 'asc' }
    });

    return routes.map(route => ({
      id: route.id,
      name: route.nome,
      origin: route.terminalPartida,
      destination: route.terminalChegada,
      fare: '20-30', // Add to your database if available
      hours: '05:00 - 22:00' // Add to your database if available
    }));
  } catch (error) {
    console.error('Error searching routes:', error);
    return [];
  }
}

async function searchStops(area: string) {
  try {
    // Map common area names to actual stop names
    const areaMap: { [key: string]: string[] } = {
      'Centro': ['Baixa', 'Praça', 'Albert', 'Laurentina', 'Museu'],
      'Baixa': ['Baixa', 'Praça', 'Albert', 'Laurentina'],
      'Matola': ['Matola', 'Tchumene', 'Malhampsene', 'Machava', 'Godinho', 'Shoprite', 'Portagem'],
      'Sommerschield': ['Sommerschield'],
      'Polana': ['Polana'],
      'Costa do Sol': ['Costa do Sol', 'Praia'],
      'Maxaquene': ['Maxaquene'],
      'Aeroporto': ['Aeroporto'],
    };

    // Get search terms for this area
    const searchTerms = areaMap[area] || [area];
    
    // Build OR conditions for all search terms
    const orConditions = searchTerms.map(term => ({
      nome: { contains: term }
    }));

    const stops = await prisma.paragem.findMany({
      where: {
        OR: orConditions
      },
      include: {
        vias: {
          include: {
            via: true
          },
          take: 3
        }
      },
      take: 9,
      orderBy: { nome: 'asc' }
    });

    return stops.map(stop => ({
      id: stop.id,
      name: stop.nome,
      routes: stop.vias.map(v => v.via.nome).join(', ') || 'N/A'
    }));
  } catch (error) {
    console.error('Error searching stops:', error);
    return [];
  }
}

async function getSavedRoutesCount(phoneNumber: string): Promise<number> {
  try {
    // This would require a user/saved routes table
    // For now, return 0
    return 0;
  } catch (error) {
    return 0;
  }
}

async function getSavedRoutes(phoneNumber: string): Promise<Array<{ origin: string; destination: string }>> {
  try {
    // This would require a user/saved routes table
    // For now, return empty array
    return [] as Array<{ origin: string; destination: string }>;
  } catch (error) {
    return [] as Array<{ origin: string; destination: string }>;
  }
}

// NEW: Find nearest stop based on location name
async function findNearestStop(locationName: string) {
  try {
    const stop = await prisma.paragem.findFirst({
      where: {
        nome: { contains: locationName }
      }
    });

    if (!stop) return null;

    return {
      id: stop.id,
      name: stop.nome,
      location: stop.geoLocation
    };
  } catch (error) {
    console.error('Error finding nearest stop:', error);
    return null;
  }
}

// NEW: Find transport info (routes, ETA, fare)
async function findTransportInfo(from: string, to: string) {
  try {
    // Map common location names to actual terminal names
    const locationMap: { [key: string]: string[] } = {
      'Matola Sede': ['Matola Sede', 'Matola', 'Hanhane'],
      'Baixa': ['Baixa', 'Praça', 'Albert', 'Laurentina'],
      'Museu': ['Museu'],
      'Zimpeto': ['Zimpeto'],
      'Costa do Sol': ['Costa do Sol', 'Praia'],
      'Portagem': ['Portagem'],
      'Machava': ['Machava'],
    };

    // Get search terms
    const fromTerms = locationMap[from] || [from];
    const toTerms = locationMap[to] || [to];
    
    // Build OR conditions
    const fromConditions = fromTerms.flatMap(term => [
      { terminalPartida: { contains: term } },
      { nome: { contains: term } }
    ]);
    
    const toConditions = toTerms.flatMap(term => [
      { terminalChegada: { contains: term } },
      { nome: { contains: term } }
    ]);

    // Find routes that match origin and destination
    const routes = await prisma.via.findMany({
      where: {
        AND: [
          { OR: fromConditions },
          { OR: toConditions }
        ]
      },
      include: {
        transportes: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            geoLocations: {
              take: 1,
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      },
      take: 1
    });

    if (routes.length === 0) return null;

    const route = routes[0];
    const bus = route.transportes[0];
    
    // Calculate distances and times
    const distanceToYou = calculateDistance(from, to);
    const travelTime = Math.ceil(distanceToYou / 30 * 60); // Total travel time in minutes
    
    // Simulate bus current location (in real system, get from GPS)
    const busDistanceFromStart = Math.random() * distanceToYou; // km from start
    const busDistanceToYourStop = distanceToYou - busDistanceFromStart;
    const timeUntilBusArrives = Math.ceil(busDistanceToYourStop / 30 * 60); // minutes
    
    // Calculate arrival time
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + (timeUntilBusArrives + travelTime) * 60000);
    const arrivalTimeStr = `${arrivalTime.getHours().toString().padStart(2, '0')}:${arrivalTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Get bus current location name (simplified)
    const busLocation = getBusLocationName(from, to, busDistanceFromStart, distanceToYou);
    
    // Calculate fare
    const fare = calculateFareAmount(distanceToYou);

    return {
      // Bus info
      busId: bus ? `${bus.marca} ${bus.modelo} - ${bus.matricula}` : 'N/A',
      busLocation: busLocation,
      
      // Timing
      timeUntilBusArrives: timeUntilBusArrives,
      travelTime: travelTime,
      totalTime: timeUntilBusArrives + travelTime,
      arrivalTime: arrivalTimeStr,
      
      // Route info
      from: route.terminalPartida,
      to: route.terminalChegada,
      distance: distanceToYou.toFixed(1),
      
      // Fare
      fare: fare
    };
  } catch (error) {
    console.error('Error finding transport info:', error);
    return null;
  }
}

// Helper: Get bus location name based on progress
function getBusLocationName(from: string, to: string, currentDistance: number, totalDistance: number): string {
  const progress = currentDistance / totalDistance;
  
  // Define intermediate stops based on common routes
  const intermediateStops: { [key: string]: string[] } = {
    'Matola Sede-Baixa': ['Shoprite Matola', 'Portagem', 'Museu'],
    'Baixa-Matola Sede': ['Museu', 'Portagem', 'Shoprite Matola'],
    'Matola Sede-Museu': ['Godinho', 'Portagem'],
    'Museu-Matola Sede': ['Portagem', 'Godinho'],
    'Baixa-Zimpeto': ['Costa do Sol', 'Praia'],
    'Zimpeto-Baixa': ['Praia', 'Costa do Sol'],
  };
  
  const key = `${from}-${to}`;
  const stops = intermediateStops[key] || ['Em rota'];
  
  if (progress < 0.33) return stops[0] || from;
  if (progress < 0.66) return stops[1] || stops[0];
  return stops[2] || stops[1] || 'Proximo';
}


// NEW: Calculate fare between two locations
async function calculateFare(origin: string, destination: string) {
  try {
    // Map common location names to actual terminal names
    const locationMap: { [key: string]: string[] } = {
      'Matola': ['Matola', 'Tchumene', 'Malhampsene', 'Machava'],
      'Baixa': ['Baixa', 'Praça', 'Albert', 'Laurentina'],
      'Museu': ['Museu'],
      'Zimpeto': ['Zimpeto'],
      'Costa do Sol': ['Costa do Sol', 'Praia'],
      'Portagem': ['Portagem'],
      'Machava': ['Machava'],
    };

    // Get search terms
    const originTerms = locationMap[origin] || [origin];
    const destTerms = locationMap[destination] || [destination];
    
    // Build OR conditions
    const originConditions = originTerms.flatMap(term => [
      { terminalPartida: { contains: term } },
      { nome: { contains: term } }
    ]);
    
    const destConditions = destTerms.flatMap(term => [
      { terminalChegada: { contains: term } },
      { nome: { contains: term } }
    ]);

    // Find routes between origin and destination
    const routes = await prisma.via.findMany({
      where: {
        AND: [
          { OR: originConditions },
          { OR: destConditions }
        ]
      }
    });

    const distance = calculateDistance(origin, destination);
    const fare = calculateFareAmount(distance);
    const duration = Math.ceil(distance / 30 * 60); // 30km/h average

    return {
      distance: distance.toFixed(1),
      fare: fare.toString(),
      duration: `${duration} min`,
      routeCount: routes.length
    };
  } catch (error) {
    console.error('Error calculating fare:', error);
    return {
      distance: '10.0',
      fare: '25',
      duration: '20 min',
      routeCount: 0
    };
  }
}

// Helper: Calculate distance between two locations (simplified)
function calculateDistance(from: string, to: string): number {
  // Simplified distance calculation based on common routes
  const distances: { [key: string]: number } = {
    'Matola-Baixa': 12,
    'Baixa-Matola': 12,
    'Matola-Museu': 10,
    'Museu-Matola': 10,
    'Baixa-Zimpeto': 15,
    'Zimpeto-Baixa': 15,
    'Baixa-Costa do Sol': 8,
    'Costa do Sol-Baixa': 8,
    'Matola-Zimpeto': 18,
    'Zimpeto-Matola': 18,
    'Portagem-Baixa': 8,
    'Baixa-Portagem': 8,
    'Machava-Museu': 9,
    'Museu-Machava': 9
  };

  const key = `${from}-${to}`;
  return distances[key] || 10; // Default 10km
}

// Helper: Calculate fare based on distance
function calculateFareAmount(distance: number): number {
  // Fare structure:
  // 0-5km: 15 MT
  // 5-10km: 20 MT
  // 10-15km: 25 MT
  // 15-20km: 30 MT
  // 20+km: 35 MT
  
  if (distance <= 5) return 15;
  if (distance <= 10) return 20;
  if (distance <= 15) return 25;
  if (distance <= 20) return 30;
  return 35;
}

// NEW: Create mission for user tracking
async function createMissionForUser(phoneNumber: string, from: string, to: string) {
  try {
    // Find or create user
    let user = await prisma.utente.findFirst({
      where: { telefone: phoneNumber }
    });

    if (!user) {
      // Create new user
      user = await prisma.utente.create({
        data: {
          nome: `User ${phoneNumber.slice(-4)}`,
          telefone: phoneNumber,
          email: `${phoneNumber}@temp.com`,
          senha: 'temp', // Will be updated when user registers
          mISSION: `USSD-${phoneNumber}-${Date.now()}`, // Unique mission identifier
        }
      });
    }

    // Find nearest stop to destination
    const stop = await prisma.paragem.findFirst({
      where: {
        nome: { contains: to }
      }
    });

    if (!stop) {
      console.log('No stop found for destination:', to);
      return;
    }

    // Create mission
    const mission = await prisma.mISSION.create({
      data: {
        mISSIONUtente: `USSD-${Date.now()}`,
        codigoParagem: stop.id,
        geoLocationUtente: '-25.9732,32.5632', // Default location
        geoLocationParagem: stop.geoLocation,
        utenteId: user.id,
        paragemId: stop.id,
      }
    });

    console.log(`✅ Mission created for ${phoneNumber} to ${to}`);

    // Send confirmation SMS
    try {
      const { notifyMissionCreated } = await import('@/lib/notifications');
      await notifyMissionCreated(phoneNumber, stop.nome);
    } catch (error) {
      console.error('Error sending confirmation SMS:', error);
    }

    return mission;
  } catch (error) {
    console.error('Error creating mission:', error);
    throw error;
  }
}
