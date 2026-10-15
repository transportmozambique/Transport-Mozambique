import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
async function handleUSSD(sessionId: string, phoneNumber: string, text: string): Promise<string> {
  // Split user input by * to track navigation
  const inputs = text === '' ? [] : text.split('*');
  const level = inputs.length;

  // LEVEL 0: Main Menu (first interaction)
  if (level === 0) {
    return `CON Bem-vindo ao Sistema de Transportes
1. Encontrar Transporte Agora
2. Procurar Rotas
3. Paragens Proximas
4. Calcular Tarifa
5. Ajuda`;
  }

  // LEVEL 1: Main menu selection
  if (level === 1) {
    const choice = inputs[0];

    switch (choice) {
      case '1':
        return `CON Onde voce esta agora?
1. Matola Sede
2. Baixa (Centro)
3. Museu
4. Zimpeto
5. Costa do Sol
6. Portagem
7. Machava
8. Outro local
0. Voltar`;

      case '2':
        return `CON Procurar Rotas - Escolha origem:
1. Matola
2. Maputo Centro
3. Baixa
4. Costa do Sol
5. Sommerschield
6. Polana
7. Aeroporto
8. Maxaquene
9. Outro (digitar nome)
0. Voltar`;

      case '3':
        return `CON Paragens Proximas - Escolha area:
1. Centro
2. Baixa
3. Matola
4. Sommerschield
5. Polana
6. Costa do Sol
7. Maxaquene
8. Aeroporto
9. Outro (digitar nome)
0. Voltar`;

      case '4':
        return `CON Calcular Tarifa
Escolha sua origem:
1. Matola
2. Baixa
3. Museu
4. Zimpeto
5. Costa do Sol
6. Portagem
7. Machava
8. Outro
0. Voltar`;

      case '5':
        return `END Sistema de Transportes - Ajuda

Marque *seu-codigo# para:
- Encontrar transporte proximo
- Ver tempo de chegada
- Calcular tarifa
- Procurar rotas

Suporte: info@transporte.mz`;

      default:
        return `END Opcao invalida. Por favor, tente novamente.`;
    }
  }

  // LEVEL 2: Process user input based on previous choice
  if (level === 2) {
    const mainChoice = inputs[0];
    const userInput = inputs[1];

    // Option 1: Find transport now
    if (mainChoice === '1') {
      if (userInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = ['Matola Sede', 'Baixa', 'Museu', 'Zimpeto', 'Costa do Sol', 'Portagem', 'Machava'];
      
      if (userInput === '8') {
        return `CON Digite sua localizacao:`;
      }

      const locationIndex = parseInt(userInput) - 1;
      if (locationIndex < 0 || locationIndex >= locations.length) {
        return `END Opcao invalida.`;
      }

      const currentLocation = locations[locationIndex];
      
      const nearestStop = await findNearestStop(currentLocation);
      
      if (!nearestStop) {
        return `END Nenhuma paragem encontrada perto de ${currentLocation}.`;
      }

      return `CON Voce esta perto de:
${nearestStop.name}

Para onde quer ir?
1. Baixa
2. Museu
3. Matola
4. Zimpeto
5. Costa do Sol
6. Outro destino
0. Voltar`;
    }

    // Option 2: Search routes
    if (mainChoice === '2') {
      if (userInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = ['Matola', 'Maputo Centro', 'Baixa', 'Costa do Sol', 'Sommerschield', 'Polana', 'Aeroporto', 'Maxaquene'];
      let origin: string;

      if (userInput === '9') {
        return `CON Digite o nome da origem:`;
      } else {
        const locationIndex = parseInt(userInput) - 1;
        if (locationIndex >= 0 && locationIndex < locations.length) {
          origin = locations[locationIndex];
        } else {
          return `END Opcao invalida.`;
        }
      }

      const routes = await searchRoutes(origin);

      if (routes.length === 0) {
        return `END Nenhuma rota encontrada de "${origin}".
        
Tente outro nome de local.`;
      }

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

    // Option 3: Nearest stops
    if (mainChoice === '3') {
      if (userInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const areas = ['Centro', 'Baixa', 'Matola', 'Sommerschield', 'Polana', 'Costa do Sol', 'Maxaquene', 'Aeroporto'];
      let area: string;

      if (userInput === '9') {
        return `CON Digite o nome da area:`;
      } else {
        const areaIndex = parseInt(userInput) - 1;
        if (areaIndex >= 0 && areaIndex < areas.length) {
          area = areas[areaIndex];
        } else {
          return `END Opcao invalida.`;
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

    // Option 4: Calculate fare
    if (mainChoice === '4') {
      if (userInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = ['Matola', 'Baixa', 'Museu', 'Zimpeto', 'Costa do Sol', 'Portagem', 'Machava'];
      
      if (userInput === '8') {
        return `CON Digite a origem:`;
      }

      const locationIndex = parseInt(userInput) - 1;
      if (locationIndex < 0 || locationIndex >= locations.length) {
        return `END Opcao invalida.`;
      }

      const origin = locations[locationIndex];
      
      return `CON De: ${origin}
      
Para onde?
1. Baixa
2. Museu
3. Matola
4. Zimpeto
5. Costa do Sol
6. Portagem
7. Machava
8. Outro
0. Voltar`;
    }
  }

  // LEVEL 3: Show transport info or route details
  if (level === 3) {
    const mainChoice = inputs[0];
    const secondChoice = inputs[1];
    const thirdInput = inputs[2];

    // Option 1: Find transport now - Show available transports
    if (mainChoice === '1') {
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = ['Matola Sede', 'Baixa', 'Museu', 'Zimpeto', 'Costa do Sol', 'Portagem', 'Machava'];
      const currentLocation = locations[parseInt(secondChoice) - 1];
      
      const destinations = ['Baixa', 'Museu', 'Matola', 'Zimpeto', 'Costa do Sol'];
      
      if (thirdInput === '6') {
        return `CON Digite o destino:`;
      }

      const destIndex = parseInt(thirdInput) - 1;
      if (destIndex < 0 || destIndex >= destinations.length) {
        return `END Opcao invalida.`;
      }

      const destination = destinations[destIndex];
      
      const transportInfo = await findTransportInfo(currentLocation, destination);
      
      if (!transportInfo) {
        return `END Nenhum transporte encontrado de ${currentLocation} para ${destination}.`;
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
PARA: ${transportInfo.to}`;
    }

    // Option 2: Show route details
    if (mainChoice === '2') {
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }
      
      const routeIndex = parseInt(thirdInput) - 1;
      
      if (isNaN(routeIndex) || routeIndex < 0) {
        return `END Opcao invalida.`;
      }

      const locations = ['Matola', 'Maputo Centro', 'Baixa', 'Costa do Sol', 'Sommerschield', 'Polana', 'Aeroporto', 'Maxaquene'];
      const locationIndex = parseInt(secondChoice) - 1;
      const origin = locations[locationIndex];

      const routes = await searchRoutes(origin);

      if (routeIndex >= routes.length) {
        return `END Opcao invalida.`;
      }

      const route = routes[routeIndex];
      
      return `END ${route.name}

De: ${route.origin}
Para: ${route.destination}

Horario: ${route.hours || '05:00 - 22:00'}
Tarifa: ${route.fare || '20-30'} MT

Obrigado por usar nosso servico!`;
    }

    // Option 3: Show stop details
    if (mainChoice === '3') {
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }
      
      const stopIndex = parseInt(thirdInput) - 1;
      
      if (isNaN(stopIndex) || stopIndex < 0) {
        return `END Opcao invalida.`;
      }

      const areas = ['Centro', 'Baixa', 'Matola', 'Sommerschield', 'Polana', 'Costa do Sol', 'Maxaquene', 'Aeroporto'];
      const areaIndex = parseInt(secondChoice) - 1;
      const area = areas[areaIndex];

      const stops = await searchStops(area);

      if (stopIndex >= stops.length) {
        return `END Opcao invalida.`;
      }

      const stop = stops[stopIndex];
      
      return `END ${stop.name}

${stop.routes ? `Rotas: ${stop.routes}` : 'Sem informacao de rotas'}

Obrigado por usar nosso servico!`;
    }

    // Option 4: Calculate fare - Show result
    if (mainChoice === '4') {
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = ['Matola', 'Baixa', 'Museu', 'Zimpeto', 'Costa do Sol', 'Portagem', 'Machava'];
      const origin = locations[parseInt(secondChoice) - 1];
      
      if (thirdInput === '8') {
        return `CON Digite o destino:`;
      }

      const destIndex = parseInt(thirdInput) - 1;
      if (destIndex < 0 || destIndex >= locations.length) {
        return `END Opcao invalida.`;
      }

      const destination = locations[destIndex];
      
      const fareInfo = await calculateFare(origin, destination);
      
      return `END CALCULO DE TARIFA

DE: ${origin}
PARA: ${destination}

DISTANCIA: ${fareInfo.distance} km
TARIFA: ${fareInfo.fare} MT
TEMPO: ${fareInfo.duration}

ROTAS DISPONIVEIS: ${fareInfo.routeCount}`;
    }
  }

  // Default fallback
  return `END Obrigado por usar o Sistema de Transportes!`;
}

// Database query functions (reuse from existing code)
async function searchRoutes(origin: string) {
  try {
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

    const searchTerms = locationMap[origin] || [origin];
    
    const orConditions = searchTerms.flatMap(term => [
      { terminalPartida: { contains: term } },
      { terminalChegada: { contains: term } },
      { nome: { contains: term } }
    ]);

    const routes = await prisma.via.findMany({
      where: {
        OR: orConditions
      },
      take: 10,
      orderBy: { nome: 'asc' }
    });

    return routes.map(route => ({
      id: route.id,
      name: route.nome,
      origin: route.terminalPartida,
      destination: route.terminalChegada,
      fare: '20-30',
      hours: '05:00 - 22:00'
    }));
  } catch (error) {
    console.error('Error searching routes:', error);
    return [];
  }
}

async function searchStops(area: string) {
  try {
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

    const searchTerms = areaMap[area] || [area];
    
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

async function findTransportInfo(from: string, to: string) {
  try {
    const locationMap: { [key: string]: string[] } = {
      'Matola Sede': ['Matola Sede', 'Matola', 'Hanhane'],
      'Baixa': ['Baixa', 'Praça', 'Albert', 'Laurentina'],
      'Museu': ['Museu'],
      'Zimpeto': ['Zimpeto'],
      'Costa do Sol': ['Costa do Sol', 'Praia'],
      'Portagem': ['Portagem'],
      'Machava': ['Machava'],
    };

    const fromTerms = locationMap[from] || [from];
    const toTerms = locationMap[to] || [to];
    
    const fromConditions = fromTerms.flatMap(term => [
      { terminalPartida: { contains: term } },
      { nome: { contains: term } }
    ]);
    
    const toConditions = toTerms.flatMap(term => [
      { terminalChegada: { contains: term } },
      { nome: { contains: term } }
    ]);

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
          orderBy: { createdAt: 'desc' }
        }
      },
      take: 1
    });

    if (routes.length === 0) return null;

    const route = routes[0];
    const bus = route.transportes[0];
    
    const distanceToYou = calculateDistance(from, to);
    const travelTime = Math.ceil(distanceToYou / 30 * 60);
    
    const busDistanceFromStart = Math.random() * distanceToYou;
    const busDistanceToYourStop = distanceToYou - busDistanceFromStart;
    const timeUntilBusArrives = Math.ceil(busDistanceToYourStop / 30 * 60);
    
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + (timeUntilBusArrives + travelTime) * 60000);
    const arrivalTimeStr = `${arrivalTime.getHours().toString().padStart(2, '0')}:${arrivalTime.getMinutes().toString().padStart(2, '0')}`;
    
    const busLocation = getBusLocationName(from, to, busDistanceFromStart, distanceToYou);
    const fare = calculateFareAmount(distanceToYou);

    return {
      busId: bus ? `${bus.marca} ${bus.modelo} - ${bus.matricula}` : 'N/A',
      busLocation: busLocation,
      timeUntilBusArrives: timeUntilBusArrives,
      travelTime: travelTime,
      totalTime: timeUntilBusArrives + travelTime,
      arrivalTime: arrivalTimeStr,
      from: route.terminalPartida,
      to: route.terminalChegada,
      distance: distanceToYou.toFixed(1),
      fare: fare
    };
  } catch (error) {
    console.error('Error finding transport info:', error);
    return null;
  }
}

function getBusLocationName(from: string, to: string, currentDistance: number, totalDistance: number): string {
  const progress = currentDistance / totalDistance;
  
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

async function calculateFare(origin: string, destination: string) {
  try {
    const distance = calculateDistance(origin, destination);
    const fare = calculateFareAmount(distance);
    const duration = Math.ceil(distance / 30 * 60);

    return {
      distance: distance.toFixed(1),
      fare: fare.toString(),
      duration: `${duration} min`,
      routeCount: 1
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

function calculateDistance(from: string, to: string): number {
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
  return distances[key] || 10;
}

function calculateFareAmount(distance: number): number {
  if (distance <= 5) return 15;
  if (distance <= 10) return 20;
  if (distance <= 15) return 25;
  if (distance <= 20) return 30;
  return 35;
}
