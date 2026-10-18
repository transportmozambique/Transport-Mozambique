import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/adminSession";

// Rotas da API que se podem chamar sem sessão
const PUBLIC_API = new Set(["/api/auth/admin/login", "/api/auth/admin/logout"]);

// Cada chamada à API do painel precisa de um cookie de sessão válido (posto na entrada)
export function proxy(request: NextRequest) {
  if (PUBLIC_API.has(request.nextUrl.pathname)) return NextResponse.next();

  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json(
      { error: "Sessão expirada. Inicie sessão novamente." },
      { status: 401 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
