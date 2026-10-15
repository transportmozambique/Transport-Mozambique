"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ReportPage() {
  const router = useRouter();
  const [motorista, setMotorista] = useState<any>(null);
  const [reportType, setReportType] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const motoristaData = localStorage.getItem("motorista");
    if (!motoristaData) {
      router.push("/");
      return;
    }

    setMotorista(JSON.parse(motoristaData));
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simular envio
    setTimeout(() => {
      setSubmitted(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    }, 1000);
  };

  if (!motorista) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Relatório Enviado!</h2>
          <p className="text-gray-600">Sua ocorrência foi registada com sucesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Voltar
              </Link>
              <div className="w-px h-6 bg-gray-300"></div>
              <h1 className="text-xl font-bold text-gray-900">Reportar Ocorrência</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Quick Reports */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Relatórios Rápidos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => setReportType("acidente")}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-colors ${
                reportType === "acidente" ? "bg-red-100 border-2 border-red-500" : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <span className="text-3xl">🚨</span>
              <span className="text-sm font-medium text-gray-900">Acidente</span>
            </button>

            <button
              onClick={() => setReportType("avaria")}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-colors ${
                reportType === "avaria" ? "bg-orange-100 border-2 border-orange-500" : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <span className="text-3xl">🔧</span>
              <span className="text-sm font-medium text-gray-900">Avaria</span>
            </button>

            <button
              onClick={() => setReportType("transito")}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-colors ${
                reportType === "transito" ? "bg-yellow-100 border-2 border-yellow-500" : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <span className="text-3xl">🚦</span>
              <span className="text-sm font-medium text-gray-900">Trânsito</span>
            </button>

            <button
              onClick={() => setReportType("outro")}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-colors ${
                reportType === "outro" ? "bg-blue-100 border-2 border-blue-500" : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <span className="text-3xl">📝</span>
              <span className="text-sm font-medium text-gray-900">Outro</span>
            </button>
          </div>
        </div>

        {/* Report Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Detalhes da Ocorrência</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Ocorrência *
              </label>
              <select
                required
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione o tipo</option>
                <option value="acidente">🚨 Acidente</option>
                <option value="avaria">🔧 Avaria Mecânica</option>
                <option value="transito">🚦 Problema de Trânsito</option>
                <option value="passageiro">👥 Incidente com Passageiro</option>
                <option value="roubo">🚔 Roubo/Assalto</option>
                <option value="outro">📝 Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridade *
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setPriority("low")}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                    priority === "low"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Baixa
                </button>
                <button
                  type="button"
                  onClick={() => setPriority("medium")}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                    priority === "medium"
                      ? "bg-yellow-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Média
                </button>
                <button
                  type="button"
                  onClick={() => setPriority("high")}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                    priority === "high"
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Alta
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição *
              </label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Descreva o que aconteceu..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">ℹ️</span>
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Informação Automática</p>
                  <p>Sua localização, transporte e horário serão incluídos automaticamente no relatório.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Enviar Relatório
              </button>
            </div>
          </div>
        </form>

        {/* Emergency Contact */}
        <div className="mt-6 bg-red-50 border-2 border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-2xl text-white">🚨</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-900 mb-2">Emergência?</h3>
              <p className="text-sm text-red-800 mb-3">
                Em caso de emergência, ligue imediatamente:
              </p>
              <div className="space-y-2">
                <a
                  href="tel:119"
                  className="block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-center"
                >
                  📞 Polícia: 119
                </a>
                <a
                  href="tel:117"
                  className="block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-center"
                >
                  🚑 Ambulância: 117
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
