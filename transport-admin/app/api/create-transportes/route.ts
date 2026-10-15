import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { count = 111 } = body;
    
    console.log(`🚀 Creating ${count} transportes...`);
    
    // Get existing count
    const existingCount = await prisma.transporte.count();
    const needed = count - existingCount;
    
    if (needed <= 0) {
      return NextResponse.json({
        success: true,
        message: `Already have ${existingCount} transportes. No need to create more.`,
        existing: existingCount,
        created: 0
      });
    }
    
    console.log(`Need to create ${needed} more transportes`);
    
    // Get a proprietario to assign
    const proprietarios = await prisma.proprietario.findMany();
    if (proprietarios.length === 0) {
      return NextResponse.json(
        { error: 'No proprietarios found. Please create proprietarios first.' },
        { status: 400 }
      );
    }
    
    // Get all vias for codigoVia
    const vias = await prisma.via.findMany();
    if (vias.length === 0) {
      return NextResponse.json(
        { error: 'No vias found. Please create vias first.' },
        { status: 400 }
      );
    }
    
    // Create transportes
    const created = [];
    const startCode = existingCount + 1;
    
    const marcas = ['Toyota', 'Mercedes-Benz', 'Volvo', 'Scania', 'Isuzu', 'Mitsubishi', 'Nissan', 'Hino'];
    const modelos = ['Hiace', 'Sprinter', 'Coaster', 'Rosa', 'Canter', 'Urvan', 'Dutro', 'Liesse'];
    const cores = ['Branco', 'Azul', 'Vermelho', 'Amarelo', 'Verde', 'Cinza', 'Preto'];
    
    for (let i = 0; i < needed; i++) {
      const codigo = startCode + i;
      const marca = marcas[i % marcas.length];
      const modelo = modelos[i % modelos.length];
      const cor = cores[i % cores.length];
      const lotacao = 14 + (i % 3) * 2; // 14, 16, or 18
      
      // Generate matricula (format: AAA-123-MP)
      const letter1 = String.fromCharCode(65 + Math.floor(i / 676) % 26);
      const letter2 = String.fromCharCode(65 + Math.floor(i / 26) % 26);
      const letter3 = String.fromCharCode(65 + i % 26);
      const number = String(100 + (i % 900)).padStart(3, '0');
      const matricula = `${letter1}${letter2}${letter3}-${number}-MP`;
      
      // Assign to via (cycle through vias)
      const via = vias[i % vias.length];
      
      const transporte = await prisma.transporte.create({
        data: {
          codigo,
          matricula,
          marca,
          modelo,
          cor,
          lotacao,
          codigoVia: via.codigo,
          viaId: via.id,
          currGeoLocation: null // Will be set by assignment script
        }
      });
      
      // Assign to proprietario
      const proprietario = proprietarios[i % proprietarios.length];
      await prisma.transporteProprietario.create({
        data: {
          codigoTransporte: codigo,
          idProprietario: proprietario.id,
          transporteId: transporte.id,
          proprietarioId: proprietario.id
        }
      });
      
      created.push(transporte);
      
      if ((i + 1) % 10 === 0) {
        console.log(`Created ${i + 1}/${needed} transportes...`);
      }
    }
    
    console.log(`✅ Created ${created.length} transportes`);
    
    // Get final count
    const finalCount = await prisma.transporte.count();
    
    return NextResponse.json({
      success: true,
      message: `Successfully created ${created.length} transportes`,
      existing: existingCount,
      created: created.length,
      total: finalCount,
      samples: created.slice(0, 5).map(t => ({
        codigo: t.codigo,
        matricula: t.matricula,
        marca: t.marca,
        modelo: t.modelo
      }))
    });
    
  } catch (error) {
    console.error('Error creating transportes:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create transportes', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
