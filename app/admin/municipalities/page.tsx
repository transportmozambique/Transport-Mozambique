"use client";

import { useRouter } from "next/navigation";

export default function AdminMunicipalitiesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium text-lg">Voltar ao Painel</span>
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Gerir Municípios</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🏙️</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Gestão de Municípios</h2>
          <p className="text-slate-600 mb-6">
            Esta página permitirá configurar municípios e áreas com mapa interativo.
          </p>
          <p className="text-sm text-slate-500">Em desenvolvimento...</p>
        </div>
      </div>
    </div>
  );
}
