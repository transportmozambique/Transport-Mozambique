const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function restoreMaputoMunicipio() {
  try {
    console.log('🔄 Restoring Maputo município...\n');

    // Get Maputo província
    const maputo = await prisma.provincia.findFirst({
      where: { nome: 'Maputo' }
    });

    if (!maputo) {
      console.error('❌ Maputo província not found!');
      return;
    }

    // Get Cidade de Maputo
    const cidadeMaputo = await prisma.cidade.findFirst({
      where: { nome: 'Cidade de Maputo' }
    });

    // Get admin
    const admin = await prisma.administrador.findFirst();

    // Check if Maputo município already exists
    const existingMunicipio = await prisma.municipio.findFirst({
      where: { 
        OR: [
          { codigo: 'MUN-MP-01' },
          { nome: 'Maputo' }
        ]
      }
    });

    if (existingMunicipio) {
      console.log('✅ Maputo município already exists!');
      console.log('   ID:', existingMunicipio.id);
      console.log('   Nome:', existingMunicipio.nome);
      console.log('   Código:', existingMunicipio.codigo);
      return;
    }

    // Create Maputo município
    const municipioMaputo = await prisma.municipio.create({
      data: {
        nome: 'Maputo',
        codigo: 'MUN-MP-01',
        geoLocation: '32.5892,-25.9655', // Center of Maputo
        endereco: 'Av. Julius Nyerere',
        contacto1: 842345678,
        provinciaId: maputo.id,
        cidadeId: cidadeMaputo?.id,
        administradorId: admin?.id,
      },
    });

    console.log('✅ Maputo município restored successfully!');
    console.log('   ID:', municipioMaputo.id);
    console.log('   Nome:', municipioMaputo.nome);
    console.log('   Código:', municipioMaputo.codigo);
    console.log('   Província:', maputo.nome);

  } catch (error) {
    console.error('❌ Error restoring Maputo município:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreMaputoMunicipio();
