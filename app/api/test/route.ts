import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test if we can import Prisma
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Try to connect and query
    const count = await prisma.municipio.count();
    
    await prisma.$disconnect();
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      municipioCount: count,
    });
  } catch (error: any) {
    console.error('Database test error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
