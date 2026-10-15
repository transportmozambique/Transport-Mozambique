"use client";

import { useRouter } from "next/navigation";

export default function RelatorioPersonalizado() {
  const router = useRouter();

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/relatorios')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Relatório Personalizado</h2>
            <p className="text-gray-600 mt-1">Crie um relatório personalizado com filtros avançados</p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Funcionalidade em Desenvolvimento</h3>
            <p className="text-gray-600 mb-6">
              O criador de relatórios personalizados está em desenvolvimento.
            </p>
            <button
              onClick={() => router.push('/relatorios')}
              className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-lg font-medium"
            >
              Voltar para Relatórios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
