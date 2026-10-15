import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const provincias = await prisma.provincia.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
        geoLocation: true
      },
      orderBy: { nome: 'asc' }
    });

    const response = NextResponse.json(provincias);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error) {
    console.error('Error fetching provincias:', error);
    const response = NextResponse.json([]);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } finally {
    await prisma.$disconnect();
  }
}