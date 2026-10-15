import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const tests = {
    connection: false,
    read: false,
    write: false,
    update: false,
    delete: false,
    details: {} as any,
  };

  try {
    // Test 1: Connection
    console.log('Testing database connection...');
    await prisma.$connect();
    tests.connection = true;
    console.log('✓ Connection successful');

    // Test 2: Read
    console.log('Testing read operation...');
    const viaCount = await prisma.via.count();
    tests.read = true;
    tests.details.viaCount = viaCount;
    console.log(`✓ Read successful - ${viaCount} vias found`);

    // Test 3: Write (create test record)
    console.log('Testing write operation...');
    const firstMunicipio = await prisma.municipio.findFirst();
    const testVia = await prisma.via.create({
      data: {
        nome: 'TEST_VIA_DELETE_ME',
        codigo: `TEST_${Date.now()}`,
        codigoMunicipio: firstMunicipio?.codigo || 'TEST',
        cor: '#FF0000',
        terminalPartida: 'Test Start',
        terminalChegada: 'Test End',
        geoLocationPath: JSON.stringify([[0, 0], [1, 1]]),
        municipioId: firstMunicipio?.id || 'unknown',
      },
    });
    tests.write = true;
    tests.details.createdId = testVia.id;
    console.log(`✓ Write successful - created via ${testVia.id}`);

    // Test 4: Update
    console.log('Testing update operation...');
    await prisma.via.update({
      where: { id: testVia.id },
      data: { nome: 'TEST_VIA_UPDATED' },
    });
    tests.update = true;
    console.log('✓ Update successful');

    // Test 5: Delete
    console.log('Testing delete operation...');
    await prisma.via.delete({
      where: { id: testVia.id },
    });
    tests.delete = true;
    console.log('✓ Delete successful');

    return NextResponse.json({
      success: true,
      message: 'All database operations working correctly',
      tests,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database test failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Database test failed',
        tests,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  } finally {
    if (process.env.NODE_ENV === 'production') {
      await prisma.$disconnect();
    }
  }
}
