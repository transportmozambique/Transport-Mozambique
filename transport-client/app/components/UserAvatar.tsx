"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Utente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  subscrito: boolean;
}

export default function UserAvatar() {
  const router = useRouter();
  const [utente, setUtente] = useState<Utente | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load user from localStorage
    const utenteData = localStorage.getItem("utente");
    if (utenteData) {
      setUtente(JSON.parse(utenteData));
    }
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const getInitials = (nome: string) => {
    const names = nome.trim().split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    localStorage.removeItem("utente");
    router.push("/auth");
  };

  const handlePerfil = () => {
    setShowDropdown(false);
    router.push("/user-info?tab=perfil");
  };

  const handleMissoes = () => {
    setShowDropdown(false);
    router.push("/user-info?tab=missoes");
  };

  const handleSeguranca = () => {
    setShowDropdown(false);
    router.push("/user-info?tab=seguranca");
  };

  if (!utente) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-sm">
            {getInitials(utente.nome)}
          </span>
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold text-slate-900">{utente.nome}</p>
          <p className="text-xs text-slate-600">{utente.telefone}</p>
        </div>
        <svg
          className={`w-4 h-4 text-slate-600 transition-transform ${
            showDropdown ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
          {/* Menu Items - styled like admin sidebar */}
          <div className="p-2">
            <button
              onClick={handlePerfil}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="font-medium">Perfil</span>
            </button>

            <button
              onClick={handleMissoes}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              <span className="font-medium">Missões</span>
            </button>

            <button
              onClick={handleSeguranca}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span className="font-medium">Segurança</span>
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-200 pt-2 px-2">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center space-x-3 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
