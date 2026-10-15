"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "../components/UserAvatar";

interface Mission {
  id: string;
  mISSIONUtente: string;
  geoLocationUtente: string;
  geoLocationParagem: string;
  createdAt: string;
  paragem: {
    nome: string;
    codigo: string;
    geoLocation: string;
  };
  transporteId: string | null;
}

interface Utente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
}

export default function MyTransportsPage() {
  const router = useRouter();
  const [utente, setUtente] = useState<Utente | null>(null);
  const [missoes, setMissoes] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se o utente está logado
    const utenteData = localStorage.getItem("utente");
    if (!utenteData) {
      router.push("/auth");
      return;
    }

    const parsedUtente = JSON.parse(utenteData);
    setUtente(parsedUtente);

    // Buscar missões do utente
    fetchMissions(parsedUtente.id);
  }, [router]);

  const fetchMissions = async (utenteId: string) => {
    try {
      const response = await fetch(`/api/user/missions?utenteId=${utenteId}`);
      const data = await response.json();
      setMissoes(data.missoes || []);
    } catch (error) {
      console.error("Erro ao buscar missões:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("utente");
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <svg
                className="w-6 h-6 transition-transform hover:-translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span className="text-lg font-medium">Voltar</span>
            </button>
            <UserAvatar />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Info */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
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
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{utente?.nome}</h1>
              <p className="text-slate-600">{utente?.email}</p>
              <p className="text-slate-500 text-sm">{utente?.telefone}</p>
            </div>
          </div>
        </div>

        {/* Missions */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Meus Transportes
          </h2>

          {missoes.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-slate-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-slate-600 mb-4">
                Ainda não tem transportes registados
              </p>
              <button
                onClick={() => router.push("/search")}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-colors"
              >
                Buscar Transporte
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {missoes.map((missao) => (
                <div
                  key={missao.id}
                  className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 mb-2">
                        {missao.paragem.nome}
                      </h3>
                      <p className="text-sm text-slate-600 mb-1">
                        Código: {missao.paragem.codigo}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(missao.createdAt).toLocaleString("pt-MZ")}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (missao.transporteId) {
                          router.push(`/track/${missao.transporteId}?paragem=${missao.paragem.geoLocation}`);
                        } else {
                          alert('Nenhum transporte disponível para esta paragem');
                        }
                      }}
                      disabled={!missao.transporteId}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Ver no Mapa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
