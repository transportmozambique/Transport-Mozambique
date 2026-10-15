import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test 1: Simple count
    const municipioCount = await prisma.municipio.count();
    console.log(`✅ Municipios count: ${municipioCount}`);
    
    const viaCount = await prisma.via.count();
    console.log(`✅ Vias count: ${viaCount}`);
    
    const transporteCount = await prisma.transporte.count();
    console.log(`✅ Transportes count: ${transporteCount}`);
    
    // Test 2: Get all municipios
    const municipios = await prisma.municipio.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
    });
    console.log(`✅ Fetched ${municipios.length} municipios`);
    
    // Test 3: Get all vias with municipioId
    const vias = await prisma.via.findMany({
      select: {
        id: true,
        nome: true,
        municipioId: true,
      },
      take: 10,
    });
    console.log(`✅ Fetched ${vias.length} vias (sample)`);
    console.log('Sample via:', vias[0]);
    
    // Test 4: Try the complex query from available-routes
    try {
      const municipiosWithBuses = await prisma.municipio.findMany({
        where: {
          vias: {
            some: {
              transportes: {
                some: {}
              }
            }
          }
        },
        select: {
          id: true,
          nome: true,
          codigo: true
        }
      });
      console.log(`✅ Complex query succeeded: ${municipiosWithBuses.length} municipios with buses`);
      
      return NextResponse.json({
        success: true,
        counts: {
          municipios: municipioCount,
          vias: viaCount,
          transportes: transporteCount,
        },
        municipios,
        sampleVias: vias,
        municipiosWithBuses,
      });
    } catch (complexError: any) {
      console.error('❌ Complex query failed:', complexError.message);
      return NextResponse.json({
        success: false,
        error: 'Complex query failed',
        message: complexError.message,
        counts: {
          municipios: municipioCount,
          vias: viaCount,
          transportes: transporteCount,
        },
        municipios,
        sampleVias: vias,
      });
    }
    
  } catch (error: any) {
    console.error('❌ Database test failed:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Database connection failed',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
