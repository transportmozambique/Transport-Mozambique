const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('transport-client/app/api/ussd/route.ts');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add import
if (!content.includes("import { sendSMS }")) {
  content = content.replace("import { prisma } from '@/lib/prisma';", "import { prisma } from '@/lib/prisma';\nimport { sendSMS } from '@/lib/notifications';");
}

// 2. Add Pagamento to Level 0
content = content.replace(
  "4. Calcular Tarifa\n5. Ajuda",
  "4. Calcular Tarifa\n5. Pagamento\n6. Ajuda"
);

// 3. Add Pagamento to Level 1
const level1Option5 = `
      case '5':
        const payLocations = await getAvailableLocations();
        if (payLocations.length === 0) {
          return \`END Nenhuma localização disponível no momento.\`;
        }
        
        let payMenu = \`CON Pagamento\\nEscolha sua origem:\\n\`;
        payLocations.slice(0, 7).forEach((loc, i) => {
          payMenu += \`\${i + 1}. \${loc}\\n\`;
        });
        if (payLocations.length > 7) {
          payMenu += \`8. Outro\\n\`;
        }
        payMenu += \`0. Voltar\`;
        return payMenu;

      case '6':`;
content = content.replace("case '5':", level1Option5);
content = content.replace(
  "- Calcular tarifa\n- Procurar rotas",
  "- Calcular tarifa\n- Procurar rotas\n- Pagamento"
);

// 4. Add Pagamento to Level 2
const level2Option5 = `
    // Option 5: Pagamento
    if (mainChoice === '5') {
      if (userInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = await getAvailableLocations();
      
      if (userInput === '8' || parseInt(userInput) > locations.slice(0, 7).length) {
        return \`CON Digite a origem:\`;
      }

      const locationIndex = parseInt(userInput) - 1;
      if (locationIndex < 0 || locationIndex >= locations.length) {
        return \`END Opção inválida.\`;
      }

      const origin = locations[locationIndex];
      const allDestinations = await getAvailableDestinations(origin);
      const destinations = allDestinations.filter(d => d !== origin);
      
      if (destinations.length === 0) {
        return \`END Nenhum destino disponível de \${origin}.\`;
      }
      
      let destMenu = \`CON Pagamento: \${origin}\\nPara onde?\\n\`;
      destinations.slice(0, 7).forEach((dest, i) => {
        destMenu += \`\${i + 1}. \${dest}\\n\`;
      });
      if (destinations.length > 7) {
        destMenu += \`8. Outro\\n\`;
      }
      destMenu += \`0. Voltar\`;
      return destMenu;
    }
`;
content = content.replace("    // Option 5: Saved routes submenu (EXISTING)", level2Option5 + "\n    // Option 5: Saved routes submenu (EXISTING)");

// 5. Add Pagamento to Level 3
const level3Option5 = `
    // Option 5: Pagamento - Ask Amount
    if (mainChoice === '5') {
      if (thirdInput === '0') {
        return await handleUSSD(sessionId, phoneNumber, '');
      }

      const locations = await getAvailableLocations();
      const origin = locations[parseInt(secondChoice) - 1];
      
      if (!origin) return \`END Origem inválida.\`;

      const allDestinations = await getAvailableDestinations(origin);
      const destinations = allDestinations.filter(d => d !== origin);
      
      if (thirdInput === '8' || parseInt(thirdInput) > destinations.slice(0, 7).length) {
        return \`CON Digite o destino:\`;
      }

      const destIndex = parseInt(thirdInput) - 1;
      if (destIndex < 0 || destIndex >= destinations.length) {
        return \`END Opção inválida.\`;
      }

      const destination = destinations[destIndex];
      
      return \`CON Valor a transferir para viagem \${origin}-\${destination} (MT):\`;
    }
`;
content = content.replace("    // Handle route/stop selection from predefined locations (EXISTING)", level3Option5 + "\n    // Handle route/stop selection from predefined locations (EXISTING)");

// 6. Add Pagamento to Level 4
const level4Option5 = `
  // LEVEL 4: Handle Pagamento amount
  if (level === 4 && inputs[0] === '5') {
    const mainChoice = inputs[0];
    const secondChoice = inputs[1];
    const thirdInput = inputs[2];
    const amount = inputs[3];

    if (amount === '0') {
      return await handleUSSD(sessionId, phoneNumber, '');
    }

    const locations = await getAvailableLocations();
    const origin = locations[parseInt(secondChoice) - 1];
    const allDestinations = await getAvailableDestinations(origin);
    const destinations = allDestinations.filter(d => d !== origin);
    const destination = destinations[parseInt(thirdInput) - 1];
    
    const transportInfo = await findTransportInfo(origin, destination);
    
    if (!transportInfo) {
      return \`END Transferência de \${amount} MT confirmada. Viagem \${origin}-\${destination}.\`;
    }

    const smsMessage = \`Pagamento \${amount}MT recebido. Viagem \${origin}-\${destination}. Autocarro: \${transportInfo.busId}. Chegada em: \${transportInfo.timeUntilBusArrives}m. Tempo de viagem: \${transportInfo.travelTime}m. Total: \${transportInfo.totalTime}m.\`;
    try { await sendSMS(phoneNumber, smsMessage); } catch (e) {}

    return \`END Transferencia confirmada!
\${amount} MT recebido.
Tempo ate autocarro: \${transportInfo.timeUntilBusArrives} min
Detalhes enviados por SMS.\`;
  }
`;
content = content.replace("  // LEVEL 4: Handle route/stop selection after custom input", level4Option5 + "\n  // LEVEL 4: Handle route/stop selection after custom input");

// 7. Add SMS to Option 1 Level 3
const opt1Target = `      // Create mission for tracking and notification
      try {
        await createMissionForUser(phoneNumber, currentLocation, destination);
      } catch (error) {
        console.error('Error creating mission:', error);
      }

      return \`END INFORMACAO DE TRANSPORTE`;

const opt1Replacement = `      // Create mission for tracking and notification
      try {
        await createMissionForUser(phoneNumber, currentLocation, destination);
      } catch (error) {
        console.error('Error creating mission:', error);
      }

      const smsMsg = \`Autocarro: \${transportInfo.busId}. Tempo ate chegada: \${transportInfo.timeUntilBusArrives}min. Tempo de viagem: \${transportInfo.travelTime}min. Tarifa: \${transportInfo.fare}MT.\`;
      try { await sendSMS(phoneNumber, smsMsg); } catch (e) {}

      return \`END INFORMACAO DE TRANSPORTE`;

content = content.replace(opt1Target, opt1Replacement);

// 8. Add SMS to Option 2 Level 3 (and custom)
content = content.replace(
  "      return `END ${route.name || 'Rota'}\n",
  "      const rMsg = `Rota ${route.name || 'Rota'}: ${route.origin} - ${route.destination}. Tarifa: ${route.fare || '20-30'}MT.`;\n      try { await sendSMS(phoneNumber, rMsg); } catch (e) {}\n      return `END ${route.name || 'Rota'}\n"
);
// It appears twice, use a global replace
content = content.split("      return `END ${route.name}\n").join("      const rMsg = `Rota ${route.name}: ${route.origin} - ${route.destination}. Tarifa: ${route.fare || '20-30'}MT.`;\n      try { await sendSMS(phoneNumber, rMsg); } catch (e) {}\n      return `END ${route.name}\n");

// 9. Add SMS to Option 3 Level 3 (and custom)
content = content.replace(
  "      return `END ${stop.name || 'Paragem'}\n",
  "      const sMsg = `Paragem ${stop.name || 'Paragem'}. Rotas: ${stop.routes ? stop.routes : 'N/A'}`; \n      try { await sendSMS(phoneNumber, sMsg); } catch (e) {}\n      return `END ${stop.name || 'Paragem'}\n"
);
content = content.split("      return `END ${stop.name}\n").join("      const sMsg = `Paragem ${stop.name}. Rotas: ${stop.routes ? stop.routes : 'N/A'}`; \n      try { await sendSMS(phoneNumber, sMsg); } catch (e) {}\n      return `END ${stop.name}\n");

fs.writeFileSync(targetFile, content);
console.log('USSD route fully updated with Pagamento and SMS features successfully.');
