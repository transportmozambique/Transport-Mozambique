"use client";

import { useRouter, useParams } from "next/navigation";

export default function PreviewRelatorio() {
  const router = useRouter();
  const params = useParams();

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
            <h2 className="text-3xl font-bold text-gray-900">Pré-visualização do Relatório</h2>
            <p className="text-gray-600 mt-1">Visualizar relatório antes de gerar</p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Página em Desenvolvimento</h3>
            <p className="text-gray-600 mb-6">A funcionalidade de pré-visualização de relatório está em desenvolvimento.</p>
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
