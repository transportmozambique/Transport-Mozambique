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
    // The server session (HttpOnly cookie) decides who is logged in;
    // localStorage only keeps the profile shown in the UI
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
      .catch((error) => console.error("Error checking session:", error))
      .finally(() => setLoading(false));
  }, []);

  // A 401 from the admin API means the session expired: log out so the user is sent to /login
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
        // Not authenticated and trying to access protected route
        router.push("/login");
      } else if (admin && (isLoginPage || isRootPage)) {
        // Authenticated and on login/root page
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
        console.error("Error parsing admin data:", error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ admin, loading, logout, refreshAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}
