import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createUserToken } from '@/lib/userSession';
import { findUtenteIdByPhone } from '@/lib/phones';

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

    // Buscar utente pelo telefone, com ou sem o prefixo +258 e com ou sem espaços
    // (contas do USSD têm o prefixo; contas antigas do site guardaram os espaços)
    const id = await findUtenteIdByPhone(telefone);
    const utente = id && await prisma.utente.findUnique({
      where: { id },
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

    // Remover senha do retorno; o token de sessão vai com o utente (guardado no browser)
    const { senha: _, ...utenteData } = utente;
    const token = createUserToken(utente.id);
    if (!token) {
      console.error('USER_SESSION_SECRET is not set');
      return NextResponse.json({ error: 'Sessão indisponível. Tente mais tarde.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      utente: { ...utenteData, token },
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer login' },
      { status: 500 }
    );
  }
}
