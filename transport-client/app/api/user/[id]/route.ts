import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const utente = await prisma.utente.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        mISSION: true,
        subscrito: true,
        dataSubscricao: true,
        createdAt: true,
      },
    });

    if (!utente) {
      return NextResponse.json(
        { error: 'Utilizador não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(utente);
  } catch (error) {
    console.error('Erro ao buscar utilizador:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar utilizador' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { nome } = await request.json();

    if (!nome || !nome.trim()) {
      return NextResponse.json(
        { error: "Nome é obrigatório" },
        { status: 400 }
      );
    }

    const utente = await prisma.utente.update({
      where: { id },
      data: { nome: nome.trim() },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        mISSION: true,
        subscrito: true,
        dataSubscricao: true,
        createdAt: true,
      },
    });

    return NextResponse.json(utente);
  } catch (error) {
    console.error("Erro ao atualizar utilizador:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar utilizador" },
      { status: 500 }
    );
  }
}
