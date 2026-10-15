const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/transport\.via\./g, 'transport.via!.');
  // Also any via.paragens that might be null
  // Let's just fix transport.via!.
  fs.writeFileSync(file, content);
}

fixFile('transport-client/app/api/ussd/route.ts');
fixFile('transport-client/app/api/ussd-telerivet/route.ts');
console.log('Fixed transport.via bug');
