import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const municipios = await prisma.municipio.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
        endereco: true,
        contacto1: true,
        provinciaId: true
      },
      orderBy: { nome: 'asc' }
    });

    const response = NextResponse.json(municipios);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error) {
    console.error('Error fetching municipios:', error);
    const response = NextResponse.json([]);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } finally {
    await prisma.$disconnect();
  }
}