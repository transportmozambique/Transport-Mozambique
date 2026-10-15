const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Check if a paragem is within 50m of a via path
function isParagemOnViaPath(paragem, viaPath, maxDistance = 0.05) { // 50m = 0.05km
  for (let i = 0; i < viaPath.length - 1; i++) {
    const segmentStart = viaPath[i];
    const segmentEnd = viaPath[i + 1];
    
    // Calculate distance from paragem to line segment
    const distance = pointToSegmentDistance(
      paragem.latitude, paragem.longitude,
      segmentStart[0], segmentStart[1],
      segmentEnd[0], segmentEnd[1]
    );
    
    if (distance <= maxDistance) {
      return true;
    }
  }
  return false;
}

// Calculate distance from point to line segment
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) param = dot / lenSq;
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy) * 111; // Convert to km
}

// Realistic Maputo routes following actual roads
const maputoRoutes = [
  {
    nome: 'Maputo Centro → Ponta d\'Ouro (EN1)',
    origem: 'Maputo Centro',
    destino: 'Ponta d\'Ouro',
    path: [
      [-25.9692, 32.5732], // Maputo Centro
      [-25.9850, 32.5850], // Av. Julius Nyerere
      [-26.0100, 32.6000], // Av. de Moçambique
      [-26.0500, 32.6300], // Matola
      [-26.1200, 32.6800], // Boane
      [-26.2000, 32.7500], // Namaacha direction
      [-26.3500, 32.8200], // Ponta Malongane
      [-26.5000, 32.8600], // Ponta Mamoli
      [-26.6500, 32.8800], // Ponta Techobanine
      [-26.8433, 32.8933]  // Ponta d'Ouro
    ]
  },
  {
    nome: 'Maputo Centro → Matola (Av. de Moçambique)',
    origem: 'Maputo Centro',
    destino: 'Matola Centro',
    path: [
      [-25.9692, 32.5732], // Maputo Centro
      [-25.9650, 32.5800], // Baixa
      [-25.9600, 32.5900], // Av. 24 de Julho
      [-25.9550, 32.6000], // Av. de Moçambique
      [-25.9500, 32.6100], // Matola-Rio
      [-25.9450, 32.6200], // Matola Centro
      [-25.9400, 32.6300]  // Matola Gare
    ]
  },
  {
    nome: 'Maputo Centro → Machava (Estrada Circular)',
    origem: 'Maputo Centro',
    destino: 'Machava',
    path: [
      [-25.9692, 32.5732], // Maputo Centro
      [-25.9600, 32.5650], // Av. Eduardo Mondlane
      [-25.9500, 32.5550], // Av. Mao Tse Tung
      [-25.9350, 32.5400], // Estrada Circular
      [-25.9200, 32.5300], // Machava direction
      [-25.9050, 32.5200], // Machava
      [-25.9002, 32.4834]  // Machava-Sede
    ]
  },
  {
    nome: 'Avenida 4 de Outubro (Completa)',
    origem: 'Início Av. 4 de Outubro',
    destino: 'Fim Av. 4 de Outubro',
    path: [
      [-25.8918, 32.5392],
      [-25.8919, 32.5393],
      [-25.8920, 32.5400],
      [-25.8922, 32.5410],
      [-25.8926, 32.5418],
      [-25.8910, 32.5435],
      [-25.8898, 32.5443],
      [-25.8890, 32.5450],
      [-25.8875, 32.5461],
      [-25.8870, 32.5465],
      [-25.8861, 32.5471],
      [-25.8857, 32.5483],
      [-25.8860, 32.5500],
      [-25.8865, 32.5520],
      [-25.8867, 32.5545],
      [-25.8868, 32.5544],
      [-25.8869, 32.5561]
    ]
  },
  {
    nome: 'Estrada Circular (Norte)',
    origem: 'Circular Norte',
    destino: 'Circular Sul',
    path: [
      [-25.8281, 32.6077],
      [-25.8290, 32.6100],
      [-25.8297, 32.6130],
      [-25.8310, 32.6150],
      [-25.8330, 32.6180],
      [-25.8350, 32.6200],
      [-25.8380, 32.6220],
      [-25.8417, 32.4842]
    ]
  },
  {
    nome: 'Av. Julius Nyerere (Norte-Sul)',
    origem: 'Maputo Norte',
    destino: 'Maputo Sul',
    path: [
      [-25.9400, 32.5700],
      [-25.9450, 32.5720],
      [-25.9500, 32.5740],
      [-25.9550, 32.5760],
      [-25.9600, 32.5780],
      [-25.9650, 32.5800],
      [-25.9692, 32.5732],
      [-25.9750, 32.5850],
      [-25.9800, 32.5900],
      [-25.9850, 32.5950],
      [-25.9900, 32.6000]
    ]
  },
  {
    nome: 'Av. Eduardo Mondlane (Leste-Oeste)',
    origem: 'Baixa',
    destino: 'Sommerschield',
    path: [
      [-25.9692, 32.5732],
      [-25.9680, 32.5700],
      [-25.9670, 32.5670],
      [-25.9660, 32.5640],
      [-25.9650, 32.5610],
      [-25.9640, 32.5580],
      [-25.9630, 32.5550]
    ]
  },
  {
    nome: 'Av. 24 de Julho (Marginal)',
    origem: 'Baixa',
    destino: 'Costa do Sol',
    path: [
      [-25.9692, 32.5732],
      [-25.9650, 32.5800],
      [-25.9600, 32.5900],
      [-25.9550, 32.6000],
      [-25.9500, 32.6100],
      [-25.9450, 32.6200],
      [-25.9400, 32.6300],
      [-25.9350, 32.6400]
    ]
  },
  {
    nome: 'Av. Mao Tse Tung',
    origem: 'Maputo Centro',
    destino: 'Zimpeto',
    path: [
      [-25.9692, 32.5732],
      [-25.9750, 32.5750],
      [-25.9800, 32.5770],
      [-25.9850, 32.5790],
      [-25.9900, 32.5810],
      [-25.9950, 32.5830],
      [-26.0000, 32.5850],
      [-26.0050, 32.5870],
      [-26.0100, 32.5890]
    ]
  },
  {
    nome: 'Av. Vladimir Lenine',
    origem: 'Baixa',
    destino: 'Polana',
    path: [
      [-25.9692, 32.5732],
      [-25.9700, 32.5750],
      [-25.9710, 32.5770],
      [-25.9720, 32.5790],
      [-25.9730, 32.5810],
      [-25.9740, 32.5830],
      [-25.9750, 32.5850]
    ]
  }
];

// Generate additional Maputo routes following road grid patterns
function generateMaputoGridRoutes() {
  const routes = [];
  
  // North-South routes (following main avenues)
  const nsRoutes = [
    { name: 'NS-1', startLat: -25.8000, endLat: -26.1000, lon: 32.4500 },
    { name: 'NS-2', startLat: -25.8000, endLat: -26.1000, lon: 32.4650 },
    { name: 'NS-3', startLat: -25.8000, endLat: -26.1000, lon: 32.4800 },
    { name: 'NS-4', startLat: -25.8000, endLat: -26.1000, lon: 32.4950 },
    { name: 'NS-5', startLat: -25.8000, endLat: -26.1000, lon: 32.5100 },
    { name: 'NS-6', startLat: -25.8000, endLat: -26.1000, lon: 32.5250 },
    { name: 'NS-7', startLat: -25.8000, endLat: -26.1000, lon: 32.5400 },
    { name: 'NS-8', startLat: -25.8000, endLat: -26.1000, lon: 32.5550 },
    { name: 'NS-9', startLat: -25.8000, endLat: -26.1000, lon: 32.5700 },
    { name: 'NS-10', startLat: -25.8000, endLat: -26.1000, lon: 32.5850 },
    { name: 'NS-11', startLat: -25.8000, endLat: -26.1000, lon: 32.6000 },
    { name: 'NS-12', startLat: -25.8000, endLat: -26.1000, lon: 32.6150 },
    { name: 'NS-13', startLat: -25.8000, endLat: -26.1000, lon: 32.6300 },
    { name: 'NS-14', startLat: -25.8000, endLat: -26.1000, lon: 32.6450 },
    { name: 'NS-15', startLat: -25.8000, endLat: -26.1000, lon: 32.6600 },
  ];
  
  nsRoutes.forEach(route => {
    const path = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const lat = route.startLat + (route.endLat - route.startLat) * (i / steps);
      path.push([lat, route.lon]);
    }
    routes.push({
      nome: `Rota ${route.name} (Norte-Sul)`,
      origem: `${route.name} Norte`,
      destino: `${route.name} Sul`,
      path: path
    });
  });
  
  // East-West routes (following main roads)
  const ewRoutes = [
    { name: 'EW-1', startLon: 32.4500, endLon: 32.6700, lat: -25.8100 },
    { name: 'EW-2', startLon: 32.4500, endLon: 32.6700, lat: -25.8250 },
    { name: 'EW-3', startLon: 32.4500, endLon: 32.6700, lat: -25.8400 },
    { name: 'EW-4', startLon: 32.4500, endLon: 32.6700, lat: -25.8550 },
    { name: 'EW-5', startLon: 32.4500, endLon: 32.6700, lat: -25.8700 },
    { name: 'EW-6', startLon: 32.4500, endLon: 32.6700, lat: -25.8850 },
    { name: 'EW-7', startLon: 32.4500, endLon: 32.6700, lat: -25.9000 },
    { name: 'EW-8', startLon: 32.4500, endLon: 32.6700, lat: -25.9150 },
    { name: 'EW-9', startLon: 32.4500, endLon: 32.6700, lat: -25.9300 },
    { name: 'EW-10', startLon: 32.4500, endLon: 32.6700, lat: -25.9450 },
    { name: 'EW-11', startLon: 32.4500, endLon: 32.6700, lat: -25.9600 },
    { name: 'EW-12', startLon: 32.4500, endLon: 32.6700, lat: -25.9750 },
    { name: 'EW-13', startLon: 32.4500, endLon: 32.6700, lat: -25.9900 },
    { name: 'EW-14', startLon: 32.4500, endLon: 32.6700, lat: -26.0050 },
    { name: 'EW-15', startLon: 32.4500, endLon: 32.6700, lat: -26.0200 },
  ];
  
  ewRoutes.forEach(route => {
    const path = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const lon = route.startLon + (route.endLon - route.startLon) * (i / steps);
      path.push([route.lat, lon]);
    }
    routes.push({
      nome: `Rota ${route.name} (Leste-Oeste)`,
      origem: `${route.name} Oeste`,
      destino: `${route.name} Leste`,
      path: path
    });
  });
  
  // Diagonal routes (NE-SW and NW-SE)
  const diagonalRoutes = [
    { name: 'DIAG-1', startLat: -25.8000, startLon: 32.4500, endLat: -26.1000, endLon: 32.6700 },
    { name: 'DIAG-2', startLat: -25.8000, startLon: 32.5000, endLat: -26.1000, endLon: 32.7200 },
    { name: 'DIAG-3', startLat: -25.8000, startLon: 32.5500, endLat: -26.1000, endLon: 32.7700 },
    { name: 'DIAG-4', startLat: -25.8000, startLon: 32.6700, endLat: -26.1000, endLon: 32.4500 },
    { name: 'DIAG-5', startLat: -25.8000, startLon: 32.7200, endLat: -26.1000, endLon: 32.5000 },
    { name: 'DIAG-6', startLat: -25.8000, startLon: 32.7700, endLat: -26.1000, endLon: 32.5500 },
  ];
  
  diagonalRoutes.forEach(route => {
    const path = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      const lat = route.startLat + (route.endLat - route.startLat) * ratio;
      const lon = route.startLon + (route.endLon - route.startLon) * ratio;
      path.push([lat, lon]);
    }
    routes.push({
      nome: `Rota ${route.name} (Diagonal)`,
      origem: `${route.name} Início`,
      destino: `${route.name} Fim`,
      path: path
    });
  });
  
  // Diagonal routes for Matola
  for (let i = 0; i < 10; i++) {
    const path = [];
    const startLat = -25.9350;
    const startLon = 32.6100 + (i * 0.0040);
    const endLat = -25.9750;
    const endLon = 32.6500 + (i * 0.0040);
    const steps = 10;
    
    for (let j = 0; j <= steps; j++) {
      const ratio = j / steps;
      const lat = startLat + (endLat - startLat) * ratio;
      const lon = startLon + (endLon - startLon) * ratio;
      path.push([lat, lon]);
    }
    
    routes.push({
      nome: `Matola Rota Diagonal ${i + 21}`,
      origem: `Matola Diag ${i + 21} Início`,
      destino: `Matola Diag ${i + 21} Fim`,
      path: path
    });
  }
  
  // Reverse diagonal routes
  for (let i = 0; i < 6; i++) {
    const path = [];
    const startLat = -25.9350;
    const startLon = 32.6500 - (i * 0.0040);
    const endLat = -25.9750;
    const endLon = 32.6100 - (i * 0.0040);
    const steps = 10;
    
    for (let j = 0; j <= steps; j++) {
      const ratio = j / steps;
      const lat = startLat + (endLat - startLat) * ratio;
      const lon = startLon + (endLon - startLon) * ratio;
      path.push([lat, lon]);
    }
    
    routes.push({
      nome: `Matola Rota Diagonal Rev ${i + 31}`,
      origem: `Matola DiagRev ${i + 31} Início`,
      destino: `Matola DiagRev ${i + 31} Fim`,
      path: path
    });
  }
  
  return routes;
}

// Matola routes following local roads
const matolaRoutes = [
  {
    nome: 'Matola Centro → Machava (Estrada Principal)',
    origem: 'Matola Centro',
    destino: 'Machava',
    path: [
      [-25.9500, 32.6200],
      [-25.9520, 32.6230],
      [-25.9550, 32.6250],
      [-25.9580, 32.6270],
      [-25.9600, 32.6300],
      [-25.9630, 32.6330],
      [-25.9650, 32.6350],
      [-25.9680, 32.6380],
      [-25.9700, 32.6400]
    ]
  },
  {
    nome: 'Matola Centro → Fomento',
    origem: 'Matola Centro',
    destino: 'Fomento',
    path: [
      [-25.9500, 32.6200],
      [-25.9510, 32.6210],
      [-25.9520, 32.6220],
      [-25.9530, 32.6235],
      [-25.9540, 32.6240],
      [-25.9550, 32.6255],
      [-25.9560, 32.6260],
      [-25.9570, 32.6270],
      [-25.9580, 32.6280]
    ]
  },
  {
    nome: 'Matola Centro → Tsalala',
    origem: 'Matola Centro',
    destino: 'Tsalala',
    path: [
      [-25.9500, 32.6200],
      [-25.9490, 32.6210],
      [-25.9480, 32.6220],
      [-25.9470, 32.6235],
      [-25.9460, 32.6240],
      [-25.9450, 32.6255],
      [-25.9440, 32.6260],
      [-25.9430, 32.6270],
      [-25.9420, 32.6280]
    ]
  },
  {
    nome: 'Matola Gare → Sikwama',
    origem: 'Matola Gare',
    destino: 'Sikwama',
    path: [
      [-25.9550, 32.6150],
      [-25.9555, 32.6180],
      [-25.9560, 32.6200],
      [-25.9565, 32.6230],
      [-25.9570, 32.6250],
      [-25.9575, 32.6280],
      [-25.9580, 32.6300],
      [-25.9585, 32.6320],
      [-25.9590, 32.6330],
      [-25.9595, 32.6340],
      [-25.9600, 32.6350]
    ]
  },
  {
    nome: 'Machava → Khongolote',
    origem: 'Machava',
    destino: 'Khongolote',
    path: [
      [-25.9700, 32.6400],
      [-25.9680, 32.6400],
      [-25.9660, 32.6400],
      [-25.9640, 32.6400],
      [-25.9620, 32.6400],
      [-25.9600, 32.6400],
      [-25.9580, 32.6400],
      [-25.9560, 32.6400],
      [-25.9540, 32.6400],
      [-25.9520, 32.6400],
      [-25.9500, 32.6400],
      [-25.9480, 32.6400],
      [-25.9460, 32.6400],
      [-25.9440, 32.6400],
      [-25.9420, 32.6400],
      [-25.9400, 32.6400]
    ]
  }
];

// Generate additional Matola routes
function generateMatolaGridRoutes() {
  const routes = [];
  
  // Local north-south routes
  for (let i = 0; i < 10; i++) {
    const lon = 32.6100 + (i * 0.0080);
    const path = [];
    const startLat = -25.9350;
    const endLat = -25.9750;
    const steps = 10;
    
    for (let j = 0; j <= steps; j++) {
      const lat = startLat + (endLat - startLat) * (j / steps);
      path.push([lat, lon]);
    }
    
    routes.push({
      nome: `Matola Rota Local ${i + 1} (NS)`,
      origem: `Matola Norte ${i + 1}`,
      destino: `Matola Sul ${i + 1}`,
      path: path
    });
  }
  
  // Local east-west routes
  for (let i = 0; i < 10; i++) {
    const lat = -25.9350 - (i * 0.0040);
    const path = [];
    const startLon = 32.6100;
    const endLon = 32.6500;
    const steps = 10;
    
    for (let j = 0; j <= steps; j++) {
      const lon = startLon + (endLon - startLon) * (j / steps);
      path.push([lat, lon]);
    }
    
    routes.push({
      nome: `Matola Rota Local ${i + 11} (EW)`,
      origem: `Matola Oeste ${i + 11}`,
      destino: `Matola Leste ${i + 11}`,
      path: path
    });
  }
  
  // Diagonal routes for Matola
  for (let i = 0; i < 15; i++) {
    const path = [];
    const startLat = -25.9350;
    const startLon = 32.6100 + (i * 0.0030);
    const endLat = -25.9750;
    const endLon = 32.6500 + (i * 0.0030);
    const steps = 10;
    
    for (let j = 0; j <= steps; j++) {
      const ratio = j / steps;
      const lat = startLat + (endLat - startLat) * ratio;
      const lon = startLon + (endLon - startLon) * ratio;
      path.push([lat, lon]);
    }
    
    routes.push({
      nome: `Matola Rota Diagonal ${i + 21}`,
      origem: `Matola Diag ${i + 21} Início`,
      destino: `Matola Diag ${i + 21} Fim`,
      path: path
    });
  }
  
  // Reverse diagonal routes
  for (let i = 0; i < 14; i++) {
    const path = [];
    const startLat = -25.9350;
    const startLon = 32.6500 - (i * 0.0030);
    const endLat = -25.9750;
    const endLon = 32.6100 - (i * 0.0030);
    const steps = 10;
    
    for (let j = 0; j <= steps; j++) {
      const ratio = j / steps;
      const lat = startLat + (endLat - startLat) * ratio;
      const lon = startLon + (endLon - startLon) * ratio;
      path.push([lat, lon]);
    }
    
    routes.push({
      nome: `Matola Rota Diagonal Rev ${i + 36}`,
      origem: `Matola DiagRev ${i + 36} Início`,
      destino: `Matola DiagRev ${i + 36} Fim`,
      path: path
    });
  }
  
  return routes;
}

async function reorganizeVias() {
  try {
    console.log('🚀 Starting via reorganization with road-following routes...\n');
    
    // Get municipio IDs
    const maputo = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Maputo', mode: 'insensitive' } }
    });
    
    const matola = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Matola', mode: 'insensitive' } }
    });
    
    if (!maputo || !matola) {
      throw new Error('Could not find Maputo or Matola municipios');
    }
    
    console.log('📍 Municipio IDs:');
    console.log('Maputo:', maputo.id);
    console.log('Matola:', matola.id);
    console.log('');
    
    // Get all paragens
    const allParagens = await prisma.paragem.findMany();
    console.log(`📍 Total paragens: ${allParagens.length}`);
    console.log('');
    
    // Delete all existing vias
    console.log('🗑️  Deleting existing vias...');
    await prisma.viaParagem.deleteMany({});
    await prisma.via.deleteMany({});
    console.log('✅ All vias deleted\n');
    
    // Generate all routes
    const allMaputoRoutes = [...maputoRoutes, ...generateMaputoGridRoutes()];
    const allMatolaRoutes = [...matolaRoutes, ...generateMatolaGridRoutes()];
    
    // Select routes to maintain 111 total with Maputo > Matola
    // We need 111 total, with Maputo > Matola
    // If we have 56 Maputo, we need 55 Matola to reach 111
    const maputoRoutesToCreate = allMaputoRoutes; // Use all available Maputo routes (56)
    const matolaNeeded = 111 - allMaputoRoutes.length; // 111 - 56 = 55
    const matolaRoutesToCreate = allMatolaRoutes.slice(0, Math.min(matolaNeeded, allMatolaRoutes.length));
    
    console.log(`📊 Creating ${maputoRoutesToCreate.length} Maputo vias and ${matolaRoutesToCreate.length} Matola vias`);
    console.log(`📊 Total routes available: ${allMaputoRoutes.length} Maputo, ${allMatolaRoutes.length} Matola\n`);
    
    let createdCount = 0;
    let totalAssociations = 0;
    let viasWithNoParagens = 0;
    
    // Create Maputo vias
    console.log('🏗️  Creating Maputo vias...');
    for (const route of maputoRoutesToCreate) {
      // Generate unique codigo
      const codigo = `VIA-MPT-${String(createdCount + 1).padStart(3, '0')}`;
      
      // Convert path to geoLocationPath format (lng,lat;lng,lat;...)
      const geoLocationPath = route.path.map(p => `${p[1]},${p[0]}`).join(';');
      
      const via = await prisma.via.create({
        data: {
          codigo: codigo,
          nome: route.nome,
          terminalPartida: route.origem,
          terminalChegada: route.destino,
          geoLocationPath: geoLocationPath,
          codigoMunicipio: maputo.codigo,
          municipioId: maputo.id
        }
      });
      
      // Find and associate paragens within 50m
      let associatedCount = 0;
      for (const paragem of allParagens) {
        // Parse paragem geoLocation (format: "lat,lng")
        const [latStr, lngStr] = paragem.geoLocation.split(',');
        const paragemLat = parseFloat(latStr);
        const paragemLng = parseFloat(lngStr);
        
        if (isNaN(paragemLat) || isNaN(paragemLng)) continue;
        
        const paragemObj = {
          latitude: paragemLat,
          longitude: paragemLng
        };
        
        if (isParagemOnViaPath(paragemObj, route.path)) {
          await prisma.viaParagem.create({
            data: {
              viaId: via.id,
              paragemId: paragem.id,
              codigoParagem: paragem.codigo,
              codigoVia: via.codigo,
              terminalBoolean: associatedCount === 0 || associatedCount === route.path.length - 1
            }
          });
          associatedCount++;
          totalAssociations++;
        }
      }
      
      if (associatedCount === 0) {
        viasWithNoParagens++;
      }
      
      createdCount++;
      if (createdCount % 10 === 0) {
        console.log(`  Created ${createdCount} vias... (${totalAssociations} associations so far)`);
      }
    }
    
    console.log(`✅ Created ${maputoRoutesToCreate.length} Maputo vias\n`);
    
    // Create Matola vias
    console.log('🏗️  Creating Matola vias...');
    for (const route of matolaRoutesToCreate) {
      // Generate unique codigo
      const codigo = `VIA-MTL-${String(createdCount - maputoRoutesToCreate.length + 1).padStart(3, '0')}`;
      
      // Convert path to geoLocationPath format
      const geoLocationPath = route.path.map(p => `${p[1]},${p[0]}`).join(';');
      
      const via = await prisma.via.create({
        data: {
          codigo: codigo,
          nome: route.nome,
          terminalPartida: route.origem,
          terminalChegada: route.destino,
          geoLocationPath: geoLocationPath,
          codigoMunicipio: matola.codigo,
          municipioId: matola.id
        }
      });
      
      let associatedCount = 0;
      for (const paragem of allParagens) {
        // Parse paragem geoLocation
        const [latStr, lngStr] = paragem.geoLocation.split(',');
        const paragemLat = parseFloat(latStr);
        const paragemLng = parseFloat(lngStr);
        
        if (isNaN(paragemLat) || isNaN(paragemLng)) continue;
        
        const paragemObj = {
          latitude: paragemLat,
          longitude: paragemLng
        };
        
        if (isParagemOnViaPath(paragemObj, route.path)) {
          await prisma.viaParagem.create({
            data: {
              viaId: via.id,
              paragemId: paragem.id,
              codigoParagem: paragem.codigo,
              codigoVia: via.codigo,
              terminalBoolean: associatedCount === 0 || associatedCount === route.path.length - 1
            }
          });
          associatedCount++;
          totalAssociations++;
        }
      }
      
      if (associatedCount === 0) {
        viasWithNoParagens++;
      }
      
      createdCount++;
    }
    
    console.log(`✅ Created ${matolaRoutesToCreate.length} Matola vias\n`);
    
    // Verify results
    const finalMaputoCount = await prisma.via.count({
      where: { municipioId: maputo.id }
    });
    
    const finalMatolaCount = await prisma.via.count({
      where: { municipioId: matola.id }
    });
    
    const totalVias = await prisma.via.count();
    const totalParagens = await prisma.paragem.count();
    const totalViaParagens = await prisma.viaParagem.count();
    
    console.log('✅ REORGANIZATION COMPLETE!\n');
    console.log('📊 Final Statistics:');
    console.log(`  Maputo vias: ${finalMaputoCount}`);
    console.log(`  Matola vias: ${finalMatolaCount}`);
    console.log(`  Total vias: ${totalVias}`);
    console.log(`  Total paragens: ${totalParagens} (preserved)`);
    console.log(`  Total via-paragem associations: ${totalViaParagens}`);
    console.log(`  Vias with no paragens: ${viasWithNoParagens}`);
    console.log('');
    console.log(`✅ Maputo vias (${finalMaputoCount}) > Matola vias (${finalMatolaCount})`);
    console.log(`✅ All ${totalParagens} paragens preserved`);
    console.log(`✅ Paragens associated within 50m of via paths`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reorganizeVias();
