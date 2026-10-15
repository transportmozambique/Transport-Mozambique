const fs = require('fs');

let content = fs.readFileSync('transport-client/app/api/ussd/route.ts', 'utf8');

// Replacements for menus
content = content.replace(
/let locationMenu = \`CON Onde você está agora\?\\n\`;[\\s\\S]*?return locationMenu;/g,
'return paginateList("Onde você está agora?", availableLocations, currPg, 6);'
);

content = content.replace(
/let originMenu = \`CON Procurar Rotas - Escolha origem:\\n\`;[\\s\\S]*?return originMenu;/g,
'return paginateList("Procurar Rotas - Escolha origem:", availableOrigins, currPg, 6);'
);

content = content.replace(
/let areaMenu = \`CON Paragens Próximas - Escolha área:\\n\`;[\\s\\S]*?return areaMenu;/g,
'return paginateList("Paragens Próximas - Escolha área:", availableAreas, currPg, 6);'
);

content = content.replace(
/let fareMenu = \`CON Calcular Tarifa\\nEscolha sua origem:\\n\`;[\\s\\S]*?return fareMenu;/g,
'return paginateList("Calcular Tarifa - Escolha origem:", fareLocations, currPg, 6);'
);

content = content.replace(
/let payMenu = \`CON Pagamento\\nEscolha sua origem:\\n\`;[\\s\\S]*?return payMenu;/g,
'return paginateList("Pagamento - Escolha origem:", payLocations, currPg, 6);'
);

content = content.replace(
/let destMenu = \`CON Pagamento: \$\{origin\}\\nPara onde\?\\n\`;[\\s\\S]*?return destMenu;/g,
'return paginateList(`Pagamento: ${origin} - Para onde?`, destinations, currPg, 6);'
);

content = content.replace(
/let destMenu = \`CON Procurar Rotas: \$\{origin\}\\nPara onde\?\\n\`;[\\s\\S]*?return destMenu;/g,
'return paginateList(`Procurar Rotas: ${origin} - Para onde?`, destinations, currPg, 6);'
);

content = content.replace(
/let destMenu = \`CON Calcular Tarifa: \$\{origin\}\\nPara onde\?\\n\`;[\\s\\S]*?return destMenu;/g,
'return paginateList(`Calcular Tarifa: ${origin} - Para onde?`, destinations, currPg, 6);'
);

content = content.replace(
/let destMenu = \`CON Transporte: \$\{currentLocation\}\\nPara onde\?\\n\`;[\\s\\S]*?return destMenu;/g,
'return paginateList(`Transporte: ${currentLocation} - Para onde?`, destinations, currPg, 6);'
);

// Replacements for input processing (removing '8' condition and calculating index correctly)

// Option 1
content = content.replace(
/if \(userInput === '8' \|\| parseInt\(userInput\) > locations.slice\(0, 7\).length\) {\\s*return \`CON Digite sua localização:\`;\\s*}\\s*const locationIndex = parseInt\(userInput\) - 1;/g,
'const locationIndex = pages[1] * 6 + parseInt(userInput) - 1;'
);

content = content.replace(
/if \(secondChoice === '8' \|\| parseInt\(secondChoice\) > destinations.slice\(0, 7\).length\) {\\s*return \`CON Digite seu destino:\`;\\s*}\\s*const destIndex = parseInt\(secondChoice\) - 1;/g,
'const destIndex = pages[2] * 6 + parseInt(secondChoice) - 1;'
);

content = content.replace(
/if \(thirdInput === '8' \|\| parseInt\(thirdInput\) > destinations.slice\(0, 7\).length\) {\\s*return \`CON Digite o destino:\`;\\s*}\\s*const destIndex = parseInt\(thirdInput\) - 1;/g,
'const destIndex = pages[2] * 6 + parseInt(thirdInput) - 1;'
);

// Option 2
content = content.replace(
/if \(userInput === '9' \|\| parseInt\(userInput\) > origins.slice\(0, 8\).length\) {\\s*return \`CON Digite o nome da origem:\`;\\s*}\\s*const originIndex = parseInt\(userInput\) - 1;/g,
'const originIndex = pages[1] * 6 + parseInt(userInput) - 1;'
);

// Option 3
content = content.replace(
/if \(userInput === '9' \|\| parseInt\(userInput\) > areas.slice\(0, 8\).length\) {\\s*return \`CON Digite o nome da área:\`;\\s*}\\s*const areaIndex = parseInt\(userInput\) - 1;/g,
'const areaIndex = pages[1] * 6 + parseInt(userInput) - 1;'
);

// Option 4
content = content.replace(
/if \(userInput === '8' \|\| parseInt\(userInput\) > locations.slice\(0, 7\).length\) {\\s*return \`CON Digite a origem:\`;\\s*}\\s*const locationIndex = parseInt\(userInput\) - 1;/g,
'const locationIndex = pages[1] * 6 + parseInt(userInput) - 1;'
);

// Option 5
content = content.replace(
/if \(userInput === '8' \|\| parseInt\(userInput\) > locations.slice\(0, 7\).length\) {\\s*return \`CON Digite a origem:\`;\\s*}\\s*const locationIndex = parseInt\(userInput\) - 1;/g,
'const locationIndex = pages[1] * 6 + parseInt(userInput) - 1;'
);

content = content.replace(
/if \(thirdInput === '8' \|\| parseInt\(thirdInput\) > destinations.slice\(0, 7\).length\) {\\s*return \`CON Digite o destino:\`;\\s*}\\s*const destIndex = parseInt\(thirdInput\) - 1;/g,
'const destIndex = pages[2] * 6 + parseInt(thirdInput) - 1;'
);

// For destinations in option 4 & 5 & 2
content = content.replace(
/if \(secondChoice === '8' \|\| parseInt\(secondChoice\) > destinations.slice\(0, 7\).length\) {\\s*return \`CON Digite o destino:\`;\\s*}\\s*const destIndex = parseInt\(secondChoice\) - 1;/g,
'const destIndex = pages[2] * 6 + parseInt(secondChoice) - 1;'
);

// We should also replace the custom manual text inputs like:
/*
  // LEVEL 4: Handle route/stop selection after custom input
*/
// The user doesn't want custom input, so we can ignore those branches entirely because the user will never be prompted for them.
// But we still need to make sure index logic is correctly bound to `pages[X] * 6`.

fs.writeFileSync('transport-client/app/api/ussd/route.ts', content);
console.log('Replaced menus and indexes with pagination logic.');
