import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/adminSession";

export async function POST(request: NextRequest) {
  try {
    const { email, senha } = await request.json();

    // Validate input
    if (!email || !senha) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    // Encontrar o administrador pelo email
    const admin = await prisma.administrador.findUnique({
      where: { email },
      select: {
        id: true,
        nome: true,
        email: true,
        senha: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Email ou senha incorretos" },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(senha, admin.senha);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Email ou senha incorretos" },
        { status: 401 }
      );
    }

    const token = createSessionToken(admin.id);
    if (!token) {
      console.error("ADMIN_SESSION_SECRET não está definido");
      return NextResponse.json(
        { error: "Servidor sem configuração de sessão" },
        { status: 500 }
      );
    }

    // Devolver os dados do administrador (sem a palavra-passe) e abrir a sessão
    const response = NextResponse.json({
      admin: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        role: "admin", // papel por omissão (a tabela ainda não tem papéis)
      },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    console.error("Erro ao fazer login:", error);
    return NextResponse.json(
      { error: "Erro ao processar login" },
      { status: 500 }
    );
  }
}
