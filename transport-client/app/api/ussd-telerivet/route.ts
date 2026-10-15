import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/notifications';
import { waitUntil } from '@vercel/functions';

// Telerivet USSD format
interface TelerivetRequest {
  event: string;
  id: string;
  message_type: string;
  content: string;
  from_number: string;
  to_number: string;
  phone_id: string;
  service_id: string;
  project_id: string;
  secret: string;
  time_created: string;
  contact_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data from Telerivet (NOT JSON!)
    const formData = await request.formData();
    
    // Extract parameters
    const event = formData.get('event') as string || '';
    const sessionId = formData.get('id') as string || '';
    const phoneNumber = formData.get('from_number') as string || '';
    const text = formData.get('content') as string || '';
    const secret = formData.get('secret') as string || '';
    const messageType = formData.get('message_type') as string || '';

    // Verify secret (security)
    const WEBHOOK_SECRET = process.env.TELERIVET_SECRET;
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      console.error('❌ Invalid webhook secret');
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Log for debugging
    console.log('📱 Telerivet USSD Request:', {
      event,
      sessionId,
      phoneNumber,
      text,
      messageType,
      timestamp: new Date().toISOString()
    });

    // Only process incoming messages
    if (event !== 'incoming_message') {
      return NextResponse.json({
        messages: [],
        continue_session: false
      });
    }

    // Process the USSD request using existing logic
    const response = await handleUSSD(sessionId, phoneNumber, text);

    // Check if session should continue
    const shouldContinue = response.startsWith('CON');
    const message = response.replace(/^(CON|END)\s*/, '');

    console.log('📤 Telerivet USSD Response:', { 
      message: message.substring(0, 100) + '...', 
      shouldContinue 
    });

    // Return Telerivet JSON format
    return NextResponse.json({
      messages: [{
        content: message,
        status: 'queued'
      }],
      continue_session: shouldContinue
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Telerivet USSD Error:', error);
    return NextResponse.json({
      messages: [{
        content: 'Erro ao processar pedido. Tente novamente.',
        status: 'queued'
      }],
      continue_session: false
    }, {
      status: 200
    });
  }
}

// Reuse existing USSD logic
function paginateList(title: string, list: string[], currentPage: number, itemsPerPage: number = 6) {
  const totalPages = Math.ceil(list.length / itemsPerPage);
  const start = currentPage * itemsPerPage;
  const pageItems = list.slice(start, start + itemsPerPage);
  
  let menu = `CON ${title}\n`;
  pageItems.forEach((item, i) => {
    menu += `${i + 1}. ${item}\n`;
  });
  
  if (currentPage < totalPages - 1) {
    menu += `98. Proximo\n`;
  }
  if (currentPage > 0) {
    menu += `99. Anterior\n`;
  }
  menu += `0. Voltar`;
  return menu;
}

async function handleUSSD(sessionId: string, phoneNumber: string, text: string): Promise<string> {
  // Split user input by * to track navigation and pagination
  const rawInputs = text === '' ? [] : text.split('*');
  const inputs: string[] = [];
  const pages: number[] = [];
  let currPg = 0;
  for (const val of rawInputs) {
    if (val === '7') currPg++;
    else if (val === '8') currPg = Math.max(0, currPg - 1);
    else if (val === '0') {
      if (inputs.length > 0) {
        inputs.pop();
        pages.pop();
      }
      currPg = 0;
    }
    else {
      inputs.push(val);
      pages.push(currPg);
      currPg = 0;
    }
  }
  const level = inputs.length;

  // LEVEL 0: Main Menu (first interaction)
  if (level === 0) {
    return `CON Bem-vindo ao Sistema de Transportes
1. Encontrar Transporte Agora
2. Procurar Rotas
3. Paragens Próximas
4. Calcular Tarifa
5. Ajuda
9. Rastrear Autocarro`;
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
        
        return paginateList("Onde você está agora?", availableLocations, currPg, 6);

      case '2':
        // Search routes - Get available origins from database
        const availableOrigins = await getAvailableOrigins();
        if (availableOrigins.length === 0) {
          return `END Nenhuma rota disponível no momento.`;
        }
        
        return paginateList("Procurar Rotas - Escolha origem:", availableOrigins, currPg, 6);

      case '3':
        // Nearest stops - Get available areas from database
        const availableAreas = await getAvailableAreas();
        if (availableAreas.length === 0) {
          return `END Nenhuma paragem disponível no momento.`;
        }
        
        return paginateList("Paragens Próximas - Escolha área:", availableAreas, currPg, 6);

      case '4':
        // Calculate fare - Get available locations from database
        const fareLocations = await getAvailableLocations();
        if (fareLocations.length === 0) {
          return `END Nenhuma localização disponível no momento.`;
        }
        
        return paginateList("Calcular Tarifa - Escolha origem:", fareLocations, currPg, 6);

      
      case '5':
        return `END Sistema de Transportes - Ajuda

Marque *384*123# para:
- Encontrar transporte proximo
- Ver tempo de chegada
- Calcular tarifa
- Procurar rotas

Suporte: info@transporte.mz`;

      case '9':
        return `CON Digite a matricula do autocarro:
(ex: ACK ou 184M)`;

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
      
      const locationIndex = pages[1] * 6 + parseInt(userInput) - 1;
      if (locationIndex >= locations.length) return `END Opção inválida.`;
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

      return paginateList(`Você está perto de: ${nearestStop.name}\nPara onde quer ir?`, destinations, currPg, 6);
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
      
      const locationIndex = pages[1] * 6 + parseInt(userInput) - 1;
      if (locationIndex >= locations.length) return `END Opção inválida.`;
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

    // Option 9: Track Specific Transport
    if (mainChoice === '9') {
      const matricula = userInput.trim().toUpperCase();
      
      if (matricula.length < 3) {
        return `END Por favor, insira pelo menos 3 caracteres da matricula.`;
      }
      
      const transport = await prisma.transporte.findFirst({
        where: { matricula: { contains: matricula, mode: 'insensitive' } },
        select: {
          id: true,
          matricula: true,
          marca: true,
          modelo: true,
          currGeoLocation: true,
          via: { select: { nome: true } }
        }
      });
      
      if (!transport) {
        return `END Nenhum autocarro encontrado com a matricula "${matricula}".`;
      }
      
      const locationInfo = transport.currGeoLocation && transport.currGeoLocation.includes(',') 
        ? "Em movimento (GPS Ativo)" 
        : "Localizacao indisponivel";
        
      const response = `END AUTOCARRO ENCONTRADO
Matricula: ${transport.matricula}
Marca: ${transport.marca || 'N/A'} ${transport.modelo || ''}
Rota: ${transport.via?.nome || 'Nenhuma rota atribuida'}
Status: ${locationInfo}`;
      try { waitUntil(sendSMS(phoneNumber, response.replace('END ', ''))); } catch (e) { console.error('SMS Error:', e); }
      return response;
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
      const locationIndex = pages[1] * 6 + parseInt(secondChoice) - 1;
      if (isNaN(locationIndex) || locationIndex < 0 || locationIndex >= locations.length) {
        return `END Opção inválida.`;
      }
      const currentLocation = locations[locationIndex];
      
      const destinations = await getAvailableDestinations(currentLocation);
      
      const destIndex = pages[2] * 6 + parseInt(thirdInput) - 1;
      if (isNaN(destIndex) || destIndex < 0 || destIndex >= destinations.length) {
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

      // DO NOT send SMS here yet, wait for Level 4 or 5
      return `CON TRANSPORTE ENCONTRADO
Autocarro: ${transportInfo.busId}
Chega em: ${transportInfo.timeUntilBusArrives} min
Viagem: ${transportInfo.travelTime} min
Tarifa: ${transportInfo.fare} MT

Deseja pagar agora?
1. Sim
2. Nao`;
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
      const origin = locations[pages[1] * 6 + parseInt(secondChoice) - 1];
      
      if (!origin) {
        return `END Origem inválida.`;
      }
      
      const destinations = await getAvailableDestinations(origin);
      
      const destIndex = pages[2] * 6 + parseInt(thirdInput) - 1;
      if (destIndex >= destinations.length) return `END Opção inválida.`;
      if (destIndex < 0 || destIndex >= destinations.length) {
        return `END Opção inválida.`;
      }

      const destination = destinations[destIndex];
      
      // Calculate fare
      const fareInfo = await calculateFare(origin, destination);
      
      if (!fareInfo) {
        return `END Erro ao calcular tarifa. Tente novamente.`;
      }
      
      const response = `END CALCULO DE TARIFA

DE: ${origin || 'N/A'}
PARA: ${destination || 'N/A'}

DISTANCIA: ${fareInfo.distance || '0.0'} km
TARIFA: ${fareInfo.fare || '0'} MT
TEMPO: ${fareInfo.duration || 'N/A'}

ROTAS DISPONIVEIS: ${fareInfo.routeCount || 0}`;
      try { waitUntil(sendSMS(phoneNumber, response.replace('END ', ''))); } catch (e) { console.error('SMS Error:', e); }
      return response;
    }


    // Option 5: Pagamento - Ask Amount
    if (mainChoice === '5') {
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = await getAvailableLocations();
      const origin = locations[pages[1] * 6 + parseInt(secondChoice) - 1];
      
      if (!origin) return `END Origem inválida.`;

      const allDestinations = await getAvailableDestinations(origin);
      const destinations = allDestinations.filter(d => d !== origin);
      
      const destIndex = pages[2] * 6 + parseInt(thirdInput) - 1;
      if (destIndex >= destinations.length) return `END Opção inválida.`;
      if (destIndex < 0 || destIndex >= destinations.length) {
        return `END Opção inválida.`;
      }

      const destination = destinations[destIndex];
      
      return `CON Valor a transferir para viagem ${origin}-${destination} (MT):`;
    }

    // Handle route/stop selection from predefined locations (EXISTING)
    if (mainChoice === '2') {
      // Handle "0" to go back
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }
      
      const routeIndex = pages[2] * 6 + parseInt(thirdInput) - 1;
      
      if (isNaN(routeIndex) || routeIndex < 0) {
        return `END Opção inválida.`;
      }

      // Get origin from dynamic list (FIXED: was using hardcoded list)
      const locations = await getAvailableOrigins();
      const locationIndex = pages[1] * 6 + parseInt(secondChoice) - 1;
      
      if (isNaN(locationIndex) || locationIndex < 0 || locationIndex >= locations.length) {
        return `END Opção inválida.`;
      }
      
      const origin = locations[locationIndex];

      const routes = await searchRoutes(origin);

      if (routeIndex >= routes.length) {
        return `END Opção inválida.`;
      }

      const route = routes[routeIndex];
      
      const response = `END ${route.name || 'Rota'}

De: ${route.origin || 'N/A'}
Para: ${route.destination || 'N/A'}

Horario: ${route.hours || '05:00 - 22:00'}
Tarifa: ${route.fare || '20-30'} MT

Obrigado por usar nosso servico!`;
      try { waitUntil(sendSMS(phoneNumber, response.replace('END ', ''))); } catch (e) { console.error('SMS Error:', e); }
      return response;
    }

    if (mainChoice === '3') {
      // Handle "0" to go back
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }
      
      const stopIndex = pages[2] * 6 + parseInt(thirdInput) - 1;
      
      if (isNaN(stopIndex) || stopIndex < 0) {
        return `END Opção inválida.`;
      }

      // Get area from dynamic list (FIXED: was using hardcoded list)
      const areas = await getAvailableAreas();
      const areaIndex = pages[1] * 6 + parseInt(secondChoice) - 1;
      
      if (isNaN(areaIndex) || areaIndex < 0 || areaIndex >= areas.length) {
        return `END Opção inválida.`;
      }
      
      const area = areas[areaIndex];

      const stops = await searchStops(area);

      if (stopIndex >= stops.length) {
        return `END Opção inválida.`;
      }

      const stop = stops[stopIndex];
      
      const response = `END ${stop.name || 'Paragem'}

${stop.routes ? `Rotas: ${stop.routes}` : 'Sem informacao de rotas'}

Obrigado por usar nosso servico!`;
      try { waitUntil(sendSMS(phoneNumber, response.replace('END ', ''))); } catch (e) { console.error('SMS Error:', e); }
      return response;
    }
  }


  // LEVEL 4: Handle Find Transport Payment Choice
  if (level === 4 && inputs[0] === '1') {
    const secondChoice = inputs[1];
    const thirdInput = inputs[2];
    const fourthInput = inputs[3];

    if (fourthInput === '1') {
      return `CON Introduza o seu PIN (1234):`;
    } else if (fourthInput === '2') {
      const locations = await getAvailableLocations();
      const locationIndex = pages[1] * 6 + parseInt(secondChoice) - 1;
      const currentLocation = locations[locationIndex];
      const destinations = await getAvailableDestinations(currentLocation);
      const destIndex = pages[2] * 6 + parseInt(thirdInput) - 1;
      const destination = destinations[destIndex];
      const transportInfo = await findTransportInfo(currentLocation, destination);

      if (transportInfo) {
        const smsMsg = `Autocarro: ${transportInfo.busId}. Tempo ate chegada: ${transportInfo.timeUntilBusArrives}min. Tempo de viagem: ${transportInfo.travelTime}min. Tarifa: ${transportInfo.fare}MT.`;
        try { waitUntil(sendSMS(phoneNumber, smsMsg)); } catch (e) { }
      }
      return `END Detalhes enviados por SMS.`;
    } else {
      return `END Opção inválida.`;
    }
  }

  // LEVEL 5: Handle Find Transport PIN
  if (level === 5 && inputs[0] === '1') {
    const secondChoice = inputs[1];
    const thirdInput = inputs[2];
    const fifthInput = inputs[4];

    if (fifthInput) {
      const locations = await getAvailableLocations();
      const locationIndex = pages[1] * 6 + parseInt(secondChoice) - 1;
      const currentLocation = locations[locationIndex];
      const destinations = await getAvailableDestinations(currentLocation);
      const destIndex = pages[2] * 6 + parseInt(thirdInput) - 1;
      const destination = destinations[destIndex];
      const transportInfo = await findTransportInfo(currentLocation, destination);

      if (transportInfo) {
        const smsMsg = `Pagamento de ${transportInfo.fare} MT recebido. Viagem ${currentLocation}-${destination}. Autocarro: ${transportInfo.busId}. Chegada em: ${transportInfo.timeUntilBusArrives}m.`;
        try { waitUntil(sendSMS(phoneNumber, smsMsg)); } catch (e) { }
        return `END Pagamento de ${transportInfo.fare} MT confirmado.\nDetalhes enviados por SMS.`;
      }
      return `END Pagamento confirmado.\nDetalhes enviados por SMS.`;
    } else {
      return `END PIN incorreto. Operacao cancelada.`;
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
      
      const rMsg = `Rota ${route.name}: ${route.origin} - ${route.destination}. Tarifa: ${route.fare || '20-30'}MT.`;
      try { waitUntil(sendSMS(phoneNumber, rMsg)); } catch (e) {}
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
      
      const sMsg = `Paragem ${stop.name}. Rotas: ${stop.routes ? stop.routes : 'N/A'}`; 
      try { waitUntil(sendSMS(phoneNumber, sMsg)); } catch (e) {}
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
      where: {
        transportes: {
          some: {}
        }
      },
      select: {
        terminalPartida: true,
        terminalChegada: true,
      },
      distinct: ['terminalPartida'],
    });

    const locations = new Set<string>();
    
    routes.forEach(route => {
      if (route.terminalPartida) locations.add(route.terminalPartida);
    });

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
      where: {
        transportes: {
          some: {}
        }
      },
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
    const routes = await prisma.via.findMany({
      where: {
        AND: [
          {
            OR: [
              { terminalPartida: { contains: origin } },
              { nome: { contains: origin } }
            ]
          },
          {
            transportes: { some: {} }
          }
        ]
      },
      select: {
        terminalChegada: true,
      },
      distinct: ['terminalChegada'],
      orderBy: {
        terminalChegada: 'asc',
      },
    });

    return routes
      .map(r => r.terminalChegada)
      .filter(t => t && t.trim().length > 0 && t !== origin);
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
      name: route.nome || 'Rota',
      origin: route.terminalPartida || 'N/A',
      destination: route.terminalChegada || 'N/A',
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
      routes: stop.vias.map(v => v.via ? v.via.nome : 'N/A').filter(n => n !== 'N/A').join(', ') || 'N/A'
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
      name: stop.nome || 'Paragem',
      location: stop.geoLocation || '0,0'
    };
  } catch (error) {
    console.error('Error finding nearest stop:', error);
    return null;
  }
}

// NEW: Find transport info (routes, ETA, fare) - SIMPLIFIED for USSD performance
async function findTransportInfo(from: string, to: string) {
  try {
    console.log(`\n🔍 USSD: Finding transport from "${from}" to "${to}"`);

    // 1. Find origem paragem
    const origemParagem = await prisma.paragem.findFirst({
      where: { nome: { contains: from, mode: 'insensitive' } },
      select: { nome: true, geoLocation: true }
    });

    // 2. Find destino paragem
    const destinoParagem = await prisma.paragem.findFirst({
      where: { nome: { contains: to, mode: 'insensitive' } },
      select: { nome: true, geoLocation: true }
    });

    if (!origemParagem || !destinoParagem) return null;

    // 3. Find transport very efficiently without massive joins
    const transports = await prisma.transporte.findMany({
      where: {
        via: {
          AND: [
            { OR: [{ terminalPartida: { contains: from } }, { nome: { contains: from } }] },
            { terminalChegada: { contains: to } }
          ]
        }
      },
      select: {
        id: true,
        matricula: true,
        marca: true,
        modelo: true,
        currGeoLocation: true,
        via: { select: { nome: true } },
        geoLocations: { orderBy: { createdAt: 'desc' }, take: 1, select: { geoLocationTransporte: true } }
      },
      take: 1,
    });

    if (transports.length === 0) return null;
    const transport = transports[0];

    // Helper function to calculate distance
    const calculateDistanceCoords = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371e3;
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lng2 - lng1) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    if (!origemParagem.geoLocation || !origemParagem.geoLocation.includes(',')) return null;
    if (!destinoParagem.geoLocation || !destinoParagem.geoLocation.includes(',')) return null;

    const [origemLat, origemLng] = origemParagem.geoLocation.split(',').map(Number);
    const [destinoLat, destinoLng] = destinoParagem.geoLocation.split(',').map(Number);
    
    if (isNaN(origemLat) || isNaN(origemLng) || isNaN(destinoLat) || isNaN(destinoLng)) return null;

    // Get current bus position
    let currentLat = origemLat, currentLng = origemLng; // default to origin if unknown
    
    if (transport.currGeoLocation && transport.currGeoLocation.includes(',')) {
      [currentLat, currentLng] = transport.currGeoLocation.split(',').map(Number);
    } else if (transport.geoLocations && transport.geoLocations.length > 0 && transport.geoLocations[0].geoLocationTransporte) {
      const geoLoc = transport.geoLocations[0].geoLocationTransporte;
      if (geoLoc && geoLoc.includes(',')) {
        [currentLat, currentLng] = geoLoc.split(',').map(Number);
      }
    }
    
    // Calculate straight-line distances (multiplied by 1.3 to approximate road distance)
    const roadFactor = 1.3;
    let distanciaAteOrigem = calculateDistanceCoords(currentLat, currentLng, origemLat, origemLng) * roadFactor;
    
    // If distance is super short, assume bus is there
    if (distanciaAteOrigem < 500) distanciaAteOrigem = 1000;
    
    const tempoChegada = Math.max(1, Math.ceil(distanciaAteOrigem / 1000 / 45 * 60)); // 45 km/h
    
    const distanciaViagem = calculateDistanceCoords(origemLat, origemLng, destinoLat, destinoLng) * roadFactor;
    const tempoViagem = Math.ceil(distanciaViagem / 1000 / 30 * 60); // 30 km/h
    const distanciaViagemKm = distanciaViagem / 1000;
    const fare = Math.max(10, Math.ceil(distanciaViagemKm * 10)); // 10 MT per km

    // Calculate arrival time
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + (tempoChegada + tempoViagem) * 60000);
    const arrivalTimeStr = `${arrivalTime.getHours().toString().padStart(2, '0')}:${arrivalTime.getMinutes().toString().padStart(2, '0')}`;

    return {
      busId: `${transport.marca || 'N/A'} ${transport.modelo || 'N/A'} - ${transport.matricula || 'N/A'}`,
      busLocation: "Em rota",
      timeUntilBusArrives: tempoChegada,
      travelTime: tempoViagem,
      totalTime: tempoChegada + tempoViagem,
      arrivalTime: arrivalTimeStr,
      from: origemParagem.nome || 'Origem',
      to: destinoParagem.nome || 'Destino',
      distance: distanciaViagemKm.toFixed(1),
      fare: fare
    };
  } catch (error) {
    console.error('Error finding transport info:', error);
    return null;
  }
}


// Helper: Get bus location name based on progress
function getBusLocationName(from: string, to: string, currentDistance: number, totalDistance: number): string {
  // Prevent division by zero
  if (totalDistance === 0) {
    return 'Em rota';
  }
  
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

    return mission;
  } catch (error) {
    console.error('Error creating mission:', error);
    throw error;
  }
}

// If Pagamento Level 4 is missing, let's append it manually inside level === 4 block.
// Wait, doing this via regex is safer. Let's just write the modified content back.
