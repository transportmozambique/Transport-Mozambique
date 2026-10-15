const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateParagensForVias() {
  try {
    console.log('🔍 Finding vias without paragens...\n');

    const vias = await prisma.via.findMany({
      where: {
        paragens: {
          none: {},
        },
      },
      include: {
        municipio: true,
      },
    });

    console.log(`Found ${vias.length} vias without paragens\n`);

    if (vias.length === 0) {
      console.log('✅ All vias already have paragens!');
      return;
    }

    let totalParagensCreated = 0;
    let viasProcessed = 0;

    for (const via of vias) {
      console.log(`\n📍 Processing: ${via.codigo} - ${via.nome}`);
      
      if (!via.geoLocationPath || via.geoLocationPath.length === 0) {
        console.log('   ⚠️  No geographic path - skipping');
        continue;
      }

      // Parse the path coordinates
      const coordinates = via.geoLocationPath.split(';').map(coord => {
        const [lng, lat] = coord.split(',').map(Number);
        return { lng, lat };
      }).filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

      if (coordinates.length < 2) {
        console.log(`   ⚠️  Insufficient coordinates (${coordinates.length}) - skipping`);
        continue;
      }

      // Generate stops along the route
      // Strategy: Create stops at regular intervals (every ~10-15 coordinates)
      const stopInterval = Math.max(5, Math.floor(coordinates.length / 15)); // Aim for ~10-15 stops per via
      const stopCoordinates = [];
      
      // Always include start and end
      stopCoordinates.push(coordinates[0]);
      
      // Add intermediate stops
      for (let i = stopInterval; i < coordinates.length - stopInterval; i += stopInterval) {
        stopCoordinates.push(coordinates[i]);
      }
      
      // Always include end
      if (coordinates.length > 1) {
        stopCoordinates.push(coordinates[coordinates.length - 1]);
      }

      console.log(`   📊 Route has ${coordinates.length} coordinates`);
      console.log(`   🚏 Creating ${stopCoordinates.length} stops`);

      let stopsCreated = 0;

      for (let i = 0; i < stopCoordinates.length; i++) {
        const coord = stopCoordinates[i];
        const isTerminal = i === 0 || i === stopCoordinates.length - 1;
        
        // Generate stop name
        let stopName;
        if (i === 0) {
          stopName = `${via.terminalPartida} (Partida)`;
        } else if (i === stopCoordinates.length - 1) {
          stopName = `${via.terminalChegada} (Chegada)`;
        } else {
          stopName = `${via.nome} - Paragem ${i}`;
        }

        // Generate unique code
        const stopCode = `${via.codigo}-P${String(i + 1).padStart(2, '0')}`;

        try {
          // Check if stop already exists
          const existingStop = await prisma.paragem.findUnique({
            where: { codigo: stopCode },
          });

          let paragem;
          if (existingStop) {
            paragem = existingStop;
            console.log(`   ✓ Using existing stop: ${stopCode}`);
          } else {
            // Create the stop
            paragem = await prisma.paragem.create({
              data: {
                nome: stopName,
                codigo: stopCode,
                geoLocation: `${coord.lat},${coord.lng}`,
              },
            });
            console.log(`   ✅ Created stop: ${stopCode} - ${stopName}`);
          }

          // Link stop to via
          await prisma.viaParagem.create({
            data: {
              viaId: via.id,
              paragemId: paragem.id,
              codigoVia: via.codigo,
              codigoParagem: paragem.codigo,
              terminalBoolean: isTerminal,
            },
          });

          stopsCreated++;
        } catch (error) {
          if (error.code === 'P2002') {
            console.log(`   ⚠️  Stop ${stopCode} already exists - linking to via`);
            // Try to find and link existing stop
            const existingStop = await prisma.paragem.findUnique({
              where: { codigo: stopCode },
            });
            if (existingStop) {
              try {
                await prisma.viaParagem.create({
                  data: {
                    viaId: via.id,
                    paragemId: existingStop.id,
                    codigoVia: via.codigo,
                    codigoParagem: existingStop.codigo,
                    terminalBoolean: isTerminal,
                  },
                });
                stopsCreated++;
              } catch (linkError) {
                console.log(`   ⚠️  Already linked`);
              }
            }
          } else {
            console.error(`   ❌ Error creating stop ${stopCode}:`, error.message);
          }
        }
      }

      totalParagensCreated += stopsCreated;
      viasProcessed++;
      console.log(`   ✅ Created ${stopsCreated} stops for ${via.codigo}`);
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Vias processed: ${viasProcessed}`);
    console.log(`   Total paragens created: ${totalParagensCreated}`);
    console.log(`   Average paragens per via: ${(totalParagensCreated / viasProcessed).toFixed(1)}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateParagensForVias();
