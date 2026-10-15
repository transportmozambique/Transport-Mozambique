import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { telefone, senha } = await request.json();

    // Validar campos obrigatórios
    if (!telefone || !senha) {
      return NextResponse.json(
        { error: 'Telefone e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar utente pelo telefone
    const utente = await prisma.utente.findUnique({
      where: { telefone },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        senha: true,
        subscrito: true,
        createdAt: true,
      },
    });

    if (!utente) {
      return NextResponse.json(
        { error: 'Telefone ou senha incorretos' },
        { status: 401 }
      );
    }

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, utente.senha);

    if (!senhaValida) {
      return NextResponse.json(
        { error: 'Telefone ou senha incorretos' },
        { status: 401 }
      );
    }

    // Remover senha do retorno
    const { senha: _, ...utenteData } = utente;

    return NextResponse.json({
      success: true,
      utente: utenteData,
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer login' },
      { status: 500 }
    );
  }
}
