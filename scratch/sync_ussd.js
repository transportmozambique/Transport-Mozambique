const fs = require('fs');
const path = require('path');

const ussdFile = path.resolve('transport-client/app/api/ussd/route.ts');
const telerivetFile = path.resolve('transport-client/app/api/ussd-telerivet/route.ts');

let ussdContent = fs.readFileSync(ussdFile, 'utf8');
let teleContent = fs.readFileSync(telerivetFile, 'utf8');

// The ussdContent has export async function POST(request: NextRequest) { ... }
// After the POST function, handleUSSD begins.
const match = ussdContent.match(/async function handleUSSD[\s\S]*/);
if (match) {
  const sharedLogic = match[0];
  
  // Replace the logic in telerivetFile
  const teleMatch = teleContent.match(/(\/\/ Reuse existing USSD logic\s*)async function handleUSSD[\s\S]*/);
  if (teleMatch) {
    const newTeleContent = teleContent.substring(0, teleMatch.index) + teleMatch[1] + sharedLogic;
    
    // Also make sure to add the import for sendSMS at the top of telerivetFile if not exists
    let finalTeleContent = newTeleContent;
    if (!finalTeleContent.includes("import { sendSMS }")) {
      finalTeleContent = finalTeleContent.replace("import { prisma } from '@/lib/prisma';", "import { prisma } from '@/lib/prisma';\nimport { sendSMS } from '@/lib/notifications';");
    }
    
    fs.writeFileSync(telerivetFile, finalTeleContent);
    console.log('Successfully synced handleUSSD logic to Telerivet endpoint.');
  } else {
    console.log('Could not find handleUSSD in telerivet file.');
  }
} else {
  console.log('Could not find handleUSSD in ussd file.');
}
