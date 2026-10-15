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
    // Check if user is authenticated
    const adminData = localStorage.getItem("admin");
    
    if (adminData) {
      try {
        setAdmin(JSON.parse(adminData));
      } catch (error) {
        console.error("Error parsing admin data:", error);
        localStorage.removeItem("admin");
      }
    }
    
    setLoading(false);
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
