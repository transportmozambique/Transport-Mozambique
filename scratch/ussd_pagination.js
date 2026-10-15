const fs = require('fs');

let content = fs.readFileSync('transport-client/app/api/ussd/route.ts', 'utf8');

// The user wants NO text input. We will remove all "Outro", "Digite...", etc., and replace with pagination.

const paginationHelper = `
function parseUSSDInputs(rawInputs: string[]) {
  const logical = [];
  let currentPage = 0;
  
  for (let i = 0; i < rawInputs.length; i++) {
    const input = rawInputs[i];
    if (input === '98') {
      currentPage++;
    } else if (input === '99') {
      currentPage = Math.max(0, currentPage - 1);
    } else {
      logical.push(input);
      currentPage = 0;
    }
  }
  
  // The current page is determined by the trailing 98s/99s after the last logical input.
  // We already calculated it because currentPage only resets when a non-pagination input occurs.
  return { logicalInputs: logical, currentPage };
}

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

// Now we need to replace `const inputs = text === '' ? [] : text.split('*');\n  const level = inputs.length;`
// with the new parser.
