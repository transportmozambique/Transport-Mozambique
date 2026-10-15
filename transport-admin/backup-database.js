const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, 'backups');
  const backupFile = path.join(backupDir, `database-backup-${timestamp}.json`);

  try {
    console.log('🔄 Starting database backup...\n');

    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Fetch all data from all tables
    const [
      provincias,
      municipios,
      vias,
      paragens,
      viasParagens,
      transportes,
      proprietarios,
      transporteProprietarios,
      motoristas,
      administradores,
      utentes,
      missoes
    ] = await Promise.all([
      prisma.provincia.findMany({ include: { municipios: true } }),
      prisma.municipio.findMany({ include: { vias: true } }),
      prisma.via.findMany({ include: { paragens: true, transportes: true } }),
      prisma.paragem.findMany({ include: { vias: true } }),
      prisma.viaParagem.findMany(),
      prisma.transporte.findMany({ include: { motorista: true, via: true, proprietarios: true } }),
      prisma.proprietario.findMany({ include: { transportes: true } }),
      prisma.transporteProprietario.findMany(),
      prisma.motorista.findMany({ include: { transporte: true } }),
      prisma.administrador.findMany(),
      prisma.utente.findMany({ include: { missoes: true } }),
      prisma.mISSION.findMany()
    ]);

    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: 'transport-tracking-system',
        totalRecords: {
          provincias: provincias.length,
          municipios: municipios.length,
          vias: vias.length,
          paragens: paragens.length,
          viasParagens: viasParagens.length,
          transportes: transportes.length,
          proprietarios: proprietarios.length,
          transporteProprietarios: transporteProprietarios.length,
          motoristas: motoristas.length,
          administradores: administradores.length,
          utentes: utentes.length,
          missoes: missoes.length
        }
      },
      data: {
        provincias,
        municipios,
        vias,
        paragens,
        viasParagens,
        transportes,
        proprietarios,
        transporteProprietarios,
        motoristas,
        administradores: administradores.map(admin => ({
          ...admin,
          senha: '[REDACTED]' // Don't backup passwords in plain text
        })),
        utentes: utentes.map(user => ({
          ...user,
          senha: user.senha ? '[REDACTED]' : null
        })),
        missoes
      }
    };

    // Write backup to file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

    console.log('✅ Database backup completed successfully!\n');
    console.log('📊 Backup Statistics:');
    console.log(`   Províncias: ${provincias.length}`);
    console.log(`   Municípios: ${municipios.length}`);
    console.log(`   Vias: ${vias.length}`);
    console.log(`   Paragens: ${paragens.length}`);
    console.log(`   Vias-Paragens: ${viasParagens.length}`);
    console.log(`   Transportes: ${transportes.length}`);
    console.log(`   Proprietários: ${proprietarios.length}`);
    console.log(`   Transporte-Proprietários: ${transporteProprietarios.length}`);
    console.log(`   Motoristas: ${motoristas.length}`);
    console.log(`   Administradores: ${administradores.length}`);
    console.log(`   Utentes: ${utentes.length}`);
    console.log(`   Missões: ${missoes.length}`);
    console.log(`\n📁 Backup saved to: ${backupFile}`);
    console.log(`📦 File size: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('❌ Error creating backup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();
