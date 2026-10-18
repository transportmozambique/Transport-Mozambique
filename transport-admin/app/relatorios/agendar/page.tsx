"use client";

import { useRouter } from "next/navigation";

export default function AgendarRelatorios() {
  const router = useRouter();

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/relatorios')}
            className="p-2 rounded-xl hover:bg-slate-100"
          >
            <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Agendar Relatórios</h2>
            <p className="text-slate-600 mt-1">Configure relatórios automáticos periódicos</p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Funcionalidade em Desenvolvimento</h3>
            <p className="text-slate-600 mb-6">
              O agendador de relatórios automáticos está em desenvolvimento.
            </p>
            <button
              onClick={() => router.push('/relatorios')}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium"
            >
              Voltar para Relatórios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
