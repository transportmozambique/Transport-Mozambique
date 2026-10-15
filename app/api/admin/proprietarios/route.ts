import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const proprietarios = await prisma.proprietario.findMany({
      select: {
        id: true,
        nome: true,
        bi: true,
        nacionalidade: true,
        birthDate: true,
        endereco: true,
        contacto1: true,
        contacto2: true,
        tipoProprietario: true,
        createdAt: true
      },
      orderBy: { nome: 'asc' }
    });

    const response = NextResponse.json(proprietarios);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error) {
    console.error('Error fetching proprietarios:', error);
    const response = NextResponse.json([]);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } finally {
    await prisma.$disconnect();
  }
}