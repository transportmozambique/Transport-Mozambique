const URL = 'https://transport-system-client.vercel.app/api/ussd';
const PHONE = '+258841234567';
const SESSION = `test-crawl-${Date.now()}`;

async function sendUssd(text) {
  const params = new URLSearchParams();
  params.append('sessionId', SESSION);
  params.append('serviceCode', '*384*1#');
  params.append('phoneNumber', PHONE);
  params.append('text', text);

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    return await res.text();
  } catch (error) {
    return `ERROR: ${error.message}`;
  }
}

// Parses a USSD menu response and extracts available option numbers
function getAvailableOptions(response) {
  if (response.startsWith('END')) return [];
  
  const options = [];
  const lines = response.split('\n');
  for (const line of lines) {
    const match = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (match) {
      options.push(match[1]);
    }
  }
  return options;
}

const visited = new Set();
const errors = [];
const validPaths = [];

async function crawl(path) {
  if (visited.has(path)) return;
  visited.add(path);
  
  console.log(`Testing path: [ ${path || 'ROOT'} ]`);
  const response = await sendUssd(path);
  
  if (response.includes('Opção inválida') || response.includes('inválida') || response.includes('ERROR')) {
    errors.push({ path, response });
    console.error(`❌ INVALID END on path ${path}`);
    return;
  }
  
  if (response.startsWith('END')) {
    validPaths.push({ path, response });
    console.log(`✅ Valid END on path ${path}`);
    return;
  }
  
  // It's a CON. Extract options and explore.
  const options = getAvailableOptions(response);
  if (options.length === 0) {
    // If it's a CON but has no options (e.g. asking for typing), we stop here for the crawler
    console.log(`⚠️ CON without options on path ${path} (typing required)`);
    return;
  }
  
  for (const opt of options) {
    if (opt === '0' || opt === '7' || opt === '8') continue;
    
    // Construct new path
    const nextPath = path ? `${path}*${opt}` : opt;
    await crawl(nextPath);
  }
}

async function main() {
  console.log('Starting USSD Crawler against localhost:3000...');
  console.log('NOTE: Please make sure your local Next.js server is running (npm run dev)');
  
  // Start from root
  await crawl('');
  
  console.log('\n=======================================');
  console.log(`Crawler finished. Visited ${visited.size} paths.`);
  console.log(`✅ Valid ENDs found: ${validPaths.length}`);
  console.log(`❌ Errors (Opção inválida): ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n--- ERROR DETAILS ---');
    errors.forEach(e => {
      console.log(`Path: ${e.path}`);
      console.log(`Response: ${e.response}`);
      console.log('---------------------------');
    });
  }
}

main();
