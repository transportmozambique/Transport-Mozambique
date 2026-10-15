import re

file_path = "transport-client/app/api/ussd/route.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace the input splitting logic
old_split = r"  // Split user input by \* to track navigation\s*const inputs = text === '' \? \[\] : text\.split\('\*'\);\s*const level = inputs\.length;"
new_split = """  // Split user input by * to track navigation and pagination
  const rawInputs = text === '' ? [] : text.split('*');
  const inputs: string[] = [];
  const pages: number[] = [];
  let currPg = 0;
  for (const val of rawInputs) {
    if (val === '98') currPg++;
    else if (val === '99') currPg = Math.max(0, currPg - 1);
    else {
      inputs.push(val);
      pages.push(currPg);
      currPg = 0;
    }
  }
  const level = inputs.length;"""

content = re.sub(old_split, new_split, content, flags=re.MULTILINE)

# 2. Replace all the menus in Level 1
def replace_menu(pattern, repl):
    global content
    content = re.sub(pattern, repl, content, flags=re.MULTILINE)

replace_menu(
    r"let locationMenu = `CON Onde você está agora\?\\n`;[\s\S]*?return locationMenu;",
    'return paginateList("Onde você está agora?", availableLocations, currPg, 6);'
)

replace_menu(
    r"let originMenu = `CON Procurar Rotas - Escolha origem:\\n`;[\s\S]*?return originMenu;",
    'return paginateList("Procurar Rotas - Escolha origem:", availableOrigins, currPg, 6);'
)

replace_menu(
    r"let areaMenu = `CON Paragens Próximas - Escolha área:\\n`;[\s\S]*?return areaMenu;",
    'return paginateList("Paragens Próximas - Escolha área:", availableAreas, currPg, 6);'
)

replace_menu(
    r"let fareMenu = `CON Calcular Tarifa\\nEscolha sua origem:\\n`;[\s\S]*?return fareMenu;",
    'return paginateList("Calcular Tarifa - Escolha origem:", fareLocations, currPg, 6);'
)

replace_menu(
    r"let payMenu = `CON Pagamento\\nEscolha sua origem:\\n`;[\s\S]*?return payMenu;",
    'return paginateList("Pagamento - Escolha origem:", payLocations, currPg, 6);'
)

# Replace destinations in Level 2
replace_menu(
    r"let destMenu = `CON Pagamento: \$\{origin\}\\nPara onde\?\\n`;[\s\S]*?return destMenu;",
    'return paginateList(`Pagamento: ${origin} - Para onde?`, destinations, currPg, 6);'
)

replace_menu(
    r"let destMenu = `CON Procurar Rotas: \$\{origin\}\\nPara onde\?\\n`;[\s\S]*?return destMenu;",
    'return paginateList(`Procurar Rotas: ${origin} - Para onde?`, destinations, currPg, 6);'
)

replace_menu(
    r"let destMenu = `CON Calcular Tarifa: \$\{origin\}\\nPara onde\?\\n`;[\s\S]*?return destMenu;",
    'return paginateList(`Calcular Tarifa: ${origin} - Para onde?`, destinations, currPg, 6);'
)

replace_menu(
    r"let destMenu = `CON Transporte: \$\{currentLocation\}\\nPara onde\?\\n`;[\s\S]*?return destMenu;",
    'return paginateList(`Transporte: ${currentLocation} - Para onde?`, destinations, currPg, 6);'
)

# Option 1 index calculation
replace_menu(
    r"if \(userInput === '8' \|\| parseInt\(userInput\) > locations\.slice\(0, 7\)\.length\) \{[\s\S]*?\}\s*const locationIndex = parseInt\(userInput\) - 1;",
    'const locationIndex = pages[1] * 6 + parseInt(userInput) - 1;\n      if (locationIndex >= locations.length) return `END Opção inválida.`;'
)

# Option 2 index calculation
replace_menu(
    r"if \(userInput === '9' \|\| parseInt\(userInput\) > origins\.slice\(0, 8\)\.length\) \{[\s\S]*?\}\s*const originIndex = parseInt\(userInput\) - 1;",
    'const originIndex = pages[1] * 6 + parseInt(userInput) - 1;\n      if (originIndex >= origins.length) return `END Opção inválida.`;'
)

# Option 3 index calculation
replace_menu(
    r"if \(userInput === '9' \|\| parseInt\(userInput\) > areas\.slice\(0, 8\)\.length\) \{[\s\S]*?\}\s*const areaIndex = parseInt\(userInput\) - 1;",
    'const areaIndex = pages[1] * 6 + parseInt(userInput) - 1;\n      if (areaIndex >= areas.length) return `END Opção inválida.`;'
)

# For nested destination parsing (Option 1, 2, 4, 5) where `secondChoice` is used
replace_menu(
    r"if \(secondChoice === '8' \|\| parseInt\(secondChoice\) > destinations\.slice\(0, 7\)\.length\) \{[\s\S]*?\}\s*const destIndex = parseInt\(secondChoice\) - 1;",
    'const destIndex = pages[2] * 6 + parseInt(secondChoice) - 1;\n      if (destIndex >= destinations.length) return `END Opção inválida.`;'
)

# For nested destination parsing where `thirdInput` is used
replace_menu(
    r"if \(thirdInput === '8' \|\| parseInt\(thirdInput\) > destinations\.slice\(0, 7\)\.length\) \{[\s\S]*?\}\s*const destIndex = parseInt\(thirdInput\) - 1;",
    'const destIndex = pages[2] * 6 + parseInt(thirdInput) - 1;\n      if (destIndex >= destinations.length) return `END Opção inválida.`;'
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("USSD logic successfully updated!")
