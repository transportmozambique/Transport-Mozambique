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

    // Buscar utente pelo telefone, com ou sem o prefixo +258 (contas do USSD têm o prefixo)
    const digits = String(telefone).replace(/\s+/g, '');
    const local = digits.replace(/^\+?258/, '');
    const utente = await prisma.utente.findFirst({
      where: { telefone: { in: [digits, local, `+258${local}`, `258${local}`] } },
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

    // Conta criada pelo USSD, ainda sem senha
    if (!/^\$2[aby]\$/.test(utente.senha)) {
      return NextResponse.json(
        { error: 'Este número ainda não tem senha. Faça o registo para criar uma.' },
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
