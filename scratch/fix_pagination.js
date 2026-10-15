const fs = require('fs');

const routeFile = 'transport-client/app/api/ussd/route.ts';
let content = fs.readFileSync(routeFile, 'utf8');

const helpers = `
function paginateList(title: string, list: string[], currentPage: number, itemsPerPage: number = 6) {
  const totalPages = Math.ceil(list.length / itemsPerPage);
  const start = currentPage * itemsPerPage;
  const pageItems = list.slice(start, start + itemsPerPage);
  
  let menu = \`CON \${title}\\n\`;
  pageItems.forEach((item, i) => {
    menu += \`\${i + 1}. \${item}\\n\`;
  });
  
  if (currentPage < totalPages - 1) {
    menu += \`98. Proximo\\n\`;
  }
  if (currentPage > 0) {
    menu += \`99. Anterior\\n\`;
  }
  menu += \`0. Voltar\`;
  return menu;
}
`;

if (!content.includes('function paginateList')) {
  content = content.replace(
    'async function handleUSSD(sessionId: string, phoneNumber: string, text: string): Promise<string> {',
    helpers + '\nasync function handleUSSD(sessionId: string, phoneNumber: string, text: string): Promise<string> {'
  );
}

const oldSplit = `  // Split user input by * to track navigation
  const inputs = text === '' ? [] : text.split('*');
  const level = inputs.length;`;

const newSplit = `  // Split user input by * to track navigation and pagination
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
  const level = inputs.length;`;

content = content.replace(oldSplit, newSplit);

fs.writeFileSync(routeFile, content);
console.log('Pagination injected');
