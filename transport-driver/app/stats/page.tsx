"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StatsPage() {
  const router = useRouter();
  const [motorista, setMotorista] = useState<any>(null);
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");

  useEffect(() => {
    const motoristaData = localStorage.getItem("motorista");
    if (!motoristaData) {
      router.push("/");
      return;
    }

    setMotorista(JSON.parse(motoristaData));
  }, [router]);

  if (!motorista) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const stats = {
    today: {
      trips: 8,
      passengers: 112,
      distance: 145,
      hours: 7.5,
      revenue: 2240,
    },
    week: {
      trips: 45,
      passengers: 623,
      distance: 812,
      hours: 42,
      revenue: 12460,
    },
    month: {
      trips: 187,
      passengers: 2589,
      distance: 3378,
      hours: 174,
      revenue: 51780,
    },
  };

  const currentStats = stats[period];

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
              <h1 className="text-xl font-bold text-gray-900">Estatísticas</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Period Selector */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Período</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setPeriod("today")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  period === "today"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Hoje
              </button>
              <button
                onClick={() => setPeriod("week")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  period === "week"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Esta Semana
              </button>
              <button
                onClick={() => setPeriod("month")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  period === "month"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Este Mês
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🚌</span>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Viagens</h3>
            <p className="text-3xl font-bold text-gray-900">{currentStats.trips}</p>
            <p className="text-xs text-green-600 mt-2">↑ 12% vs período anterior</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Passageiros</h3>
            <p className="text-3xl font-bold text-gray-900">{currentStats.passengers}</p>
            <p className="text-xs text-green-600 mt-2">↑ 8% vs período anterior</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📍</span>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Distância</h3>
            <p className="text-3xl font-bold text-gray-900">{currentStats.distance} km</p>
            <p className="text-xs text-green-600 mt-2">↑ 5% vs período anterior</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⏱️</span>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Horas de Serviço</h3>
            <p className="text-3xl font-bold text-gray-900">{currentStats.hours}h</p>
            <p className="text-xs text-green-600 mt-2">↑ 3% vs período anterior</p>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl shadow-lg p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 mb-2">Receita Estimada</p>
              <p className="text-4xl font-bold">{currentStats.revenue.toLocaleString()} MT</p>
              <p className="text-green-100 text-sm mt-2">
                Média: {Math.round(currentStats.revenue / currentStats.trips)} MT por viagem
              </p>
            </div>
            <div className="text-6xl">💰</div>
          </div>
        </div>

        {/* Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Desempenho</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Taxa de Ocupação</span>
                  <span className="text-sm font-bold text-gray-900">87%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: "87%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Pontualidade</span>
                  <span className="text-sm font-bold text-gray-900">92%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: "92%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Satisfação</span>
                  <span className="text-sm font-bold text-gray-900">4.8/5.0</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: "96%" }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Horários de Pico</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌅</span>
                  <div>
                    <p className="font-medium text-gray-900">Manhã</p>
                    <p className="text-xs text-gray-600">06:00 - 09:00</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-blue-600">45%</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">☀️</span>
                  <div>
                    <p className="font-medium text-gray-900">Tarde</p>
                    <p className="text-xs text-gray-600">12:00 - 15:00</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-gray-600">25%</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌆</span>
                  <div>
                    <p className="font-medium text-gray-900">Fim de Tarde</p>
                    <p className="text-xs text-gray-600">17:00 - 20:00</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-orange-600">30%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trips */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Viagens Recentes</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Horário</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rota</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Passageiros</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  { date: "28/04/2026", time: "17:30", route: "Zimpeto - Baixa", passengers: 14, revenue: 280 },
                  { date: "28/04/2026", time: "15:45", route: "Baixa - Zimpeto", passengers: 12, revenue: 240 },
                  { date: "28/04/2026", time: "13:20", route: "Zimpeto - Baixa", passengers: 15, revenue: 300 },
                  { date: "28/04/2026", time: "11:00", route: "Baixa - Zimpeto", passengers: 13, revenue: 260 },
                  { date: "28/04/2026", time: "08:30", route: "Zimpeto - Baixa", passengers: 15, revenue: 300 },
                ].map((trip, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{trip.date}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{trip.time}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{trip.route}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{trip.passengers}</td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600">{trip.revenue} MT</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
