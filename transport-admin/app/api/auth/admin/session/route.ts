import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/adminSession";

// O administrador de uma sessão válida (o proxy.ts já recusa os pedidos sem sessão)
export async function GET(request: NextRequest) {
  const adminId = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const admin = adminId
    ? await prisma.administrador.findUnique({
        where: { id: adminId },
        select: { id: true, nome: true, email: true },
      })
    : null;

  if (!admin) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }
  return NextResponse.json({ admin: { ...admin, role: "admin" } });
}
