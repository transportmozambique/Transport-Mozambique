"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface Admin {
  id: string;
  nome: string;
  email: string;
  role: string;
}

interface AuthContextType {
  admin: Admin | null;
  loading: boolean;
  logout: () => void;
  refreshAdmin: () => void;
}

const AuthContext = createContext<AuthContextType>({
  admin: null,
  loading: true,
  logout: () => {},
  refreshAdmin: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // A sessão no servidor (cookie HttpOnly) decide quem tem sessão;
    // o localStorage só guarda o perfil mostrado na interface
    fetch("/api/auth/admin/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.admin) {
          localStorage.setItem("admin", JSON.stringify(data.admin));
          setAdmin(data.admin);
        } else {
          localStorage.removeItem("admin");
          setAdmin(null);
        }
      })
      .catch((error) => console.error("Erro ao verificar a sessão:", error))
      .finally(() => setLoading(false));
  }, []);

  // Um 401 da API do painel quer dizer que a sessão expirou: sair, para o utilizador ir para /login
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const input = args[0];
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (response.status === 401 && url.includes("/api/") && !url.includes("/api/auth/admin/")) {
        localStorage.removeItem("admin");
        setAdmin(null);
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    // Redirect logic
    if (!loading) {
      const isLoginPage = pathname === "/login";
      const isRootPage = pathname === "/";
      
      if (!admin && !isLoginPage && !isRootPage) {
        // Sem sessão e a tentar abrir uma página protegida
        router.push("/login");
      } else if (admin && (isLoginPage || isRootPage)) {
        // Com sessão e na página de entrada ou na raiz
        router.push("/dashboard");
      }
    }
  }, [admin, loading, pathname, router]);

  const logout = () => {
    fetch("/api/auth/admin/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("admin");
    setAdmin(null);
    router.push("/login");
  };

  const refreshAdmin = () => {
    const adminData = localStorage.getItem("admin");
    if (adminData) {
      try {
        setAdmin(JSON.parse(adminData));
      } catch (error) {
        console.error("Erro ao ler os dados do administrador:", error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ admin, loading, logout, refreshAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}
