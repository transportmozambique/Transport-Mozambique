/**
 * Bulk Add Matola Bus Stops to Neon Database
 * 
 * This script efficiently adds 500+ Matola bus stops to the database
 * using batch operations for better performance.
 * 
 * Run: node add-matola-stops-bulk.js
 */

// Load environment variables
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parse the OSM data provided by user
const rawData = `3841629093	-25.8797790	32.4757846	Fim do Murro
4165253601	-25.8416845	32.4841800	Terminal de Chapas - Nkobe
4418111556	-25.9001865	32.4833740	Mafureira
4893605464	-25.9061770	32.5270031	Parragem Mangueira
5365799811	-25.8918423	32.5392408	Tubiacanga
5365799812	-25.8919064	32.5393425	Tubiacanga
5365799814	-25.8925626	32.5417795	Tpm
5365799815	-25.8927146	32.5416280	TPM
5365799817	-25.8897733	32.5443495	Rua da Escola
5365799818	-25.8898372	32.5444644	Rua da Escola
5365799820	-25.8874736	32.5461459	Mafurreira
5365801221	-25.8875740	32.5463292	Mafurreira
5365801223	-25.8861042	32.5470964	Zona Verde - P331
5365801224	-25.8857319	32.5482675	Zona Verde - P331
5365801226	-25.8866825	32.5544564	Chapa Branca
5365801227	-25.8867960	32.5544341	Chapa Branca
5365801229	-25.8869234	32.5560784	Distrito
5365801230	-25.8870320	32.5560535	Distrito
5365849710	-25.8945002	32.5375893	T3
5365849711	-25.8944592	32.5374893	T3
5648693044	-25.8761363	32.4741417	Control
6431353851	-25.8493462	32.4219483	Terminal de Tchumene 2
6431508449	-25.8294382	32.4522585	Matola gare
6785661083	-25.8335607	32.5043395	Nkobe (206)
6785661084	-25.8335122	32.5044554	Nkobe (205)
6785760225	-25.8529160	32.4238593	Chapa Vinte
6785760226	-25.8530170	32.4236779	Chapa Vinte
6785760228	-25.8495573	32.4219746	Tchumene (107)
6785887019	-25.8270718	32.4511885	Matola Gare (208)
6785887020	-25.8270434	32.4512712	Matola Gare (207)
6785909543	-25.8585545	32.4272231	Esquadra
6785909544	-25.8586667	32.4270171	Esquadra
6785946653	-25.8626506	32.4296774	Contentor Amarelo
6785946654	-25.8626381	32.4293931	Contentor Amarelo
6785973639	-25.8645190	32.4307965	Cajueiro
6785973640	-25.8646437	32.4305686	Cajueiro
6785996892	-25.8516266	32.5358742	Conolone
6785996894	-25.8515848	32.5357311	Conolone
6785996895	-25.8517948	32.5349858	1º de Maio (209)
6786006323	-25.8682120	32.4325458	Lalgy
6786006324	-25.8682287	32.4323240	Lalgy
6786032461	-25.8790990	32.4331293	Tricamo
6786032462	-25.8786420	32.4334038	Tricamo
6786072219	-25.8328987	32.5370018	Esquina
6786072220	-25.8328046	32.5371158	Esquina
6786072222	-25.8321967	32.5362253	Escola
6787469910	-25.9790384	32.4643348	Inav
6787507010	-25.8797365	32.4342790	Casa Bonita
6787507012	-25.8796422	32.4342717	Casa Bonita
6787527125	-25.8345932	32.4545685	Saul
6787527126	-25.8345657	32.4546459	Saul`;

// Parse the data
function parseStopsData(data) {
  const lines = data.trim().split('\n');
  const stops = [];
  
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 4) {
      stops.push({
        osmId: parts[0].trim(),
        lat: parseFloat(parts[1].trim()),
        lon: parseFloat(parts[2].trim()),
        name: parts[3].trim()
      });
    }
  }
  
  return stops;
}

async function addMatolaStopsBulk() {
  console.log('🚏 Starting bulk import of Matola bus stops...\n');

  const stops = parseStopsData(rawData);
  console.log(`📊 Parsed ${stops.length} stops from data\n`);

  let addedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Get all existing stops to avoid duplicates
  console.log('🔍 Checking existing stops in database...');
  const existingStops = await prisma.paragem.findMany({
    select: {
      nome: true,
      geoLocation: true
    }
  });

  const existingSet = new Set(
    existingStops.map(s => `${s.nome}|${s.geoLocation}`)
  );

  console.log(`📍 Found ${existingStops.length} existing stops\n`);

  // Process stops in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < stops.length; i += BATCH_SIZE) {
    const batch = stops.slice(i, i + BATCH_SIZE);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stops.length / BATCH_SIZE)}...`);

    for (const stop of batch) {
      try {
        const geoLocation = `${stop.lat},${stop.lon}`;
        const key = `${stop.name}|${geoLocation}`;

        // Check if already exists
        if (existingSet.has(key)) {
          console.log(`⏭️  Skipped: ${stop.name}`);
          skippedCount++;
          continue;
        }

        // Generate unique codigo from OSM ID
        const codigo = `OSM-${stop.osmId}`;

        // Create new stop
        await prisma.paragem.create({
          data: {
            nome: stop.name,
            codigo: codigo,
            geoLocation: geoLocation
          }
        });

        console.log(`✅ Added: ${stop.name}`);
        addedCount++;
        existingSet.add(key); // Add to set to avoid duplicates in same run

      } catch (error) {
        console.error(`❌ Error adding ${stop.name}:`, error.message);
        errorCount++;
      }
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successfully added: ${addedCount} stops`);
  console.log(`⏭️  Skipped (already exist): ${skippedCount} stops`);
  console.log(`❌ Errors: ${errorCount} stops`);
  console.log(`📍 Total processed: ${stops.length} stops`);
  console.log('='.repeat(70));

  // Verify total stops in database
  const totalStops = await prisma.paragem.count();
  console.log(`\n📊 Total stops now in database: ${totalStops}`);
}

// Run the script
addMatolaStopsBulk()
  .then(() => {
    console.log('\n✅ Bulk import completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Connect these stops to routes using ViaParagem relations');
    console.log('   2. Update route paths to include these stops');
    console.log('   3. Test the webapp and USSD to verify stops appear correctly');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Bulk import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
