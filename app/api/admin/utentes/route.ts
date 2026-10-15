import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const utentes = await prisma.utente.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        mISSION: true,
        geoLocation: true,
        subscrito: true,
        dataSubscricao: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const response = NextResponse.json(utentes);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error) {
    console.error('Error fetching utentes:', error);
    const response = NextResponse.json([]);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } finally {
    await prisma.$disconnect();
  }
}