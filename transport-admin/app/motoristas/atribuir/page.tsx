"use client";
import LoadingScreen from "../../components/LoadingScreen";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Transporte {
  id: string;
  matricula: string;
  modelo: string;
  marca: string;
  codigo: number;
  via: {
    nome: string;
    cor: string;
  };
}

interface Motorista {
  id: string;
  nome: string;
  bi: string;
  cartaConducao: string;
  telefone: string;
  email: string;
}

interface Stats {
  totalMotoristas: number;
  motoristasAtivos: number;
  motoristasComTransporte: number;
  motoristasDisponiveis: number;
  transportesSemMotorista: number;
}

export default function AtribuirMotoristasPage() {
  const router = useRouter();
  const [transportes, setTransportes] = useState<Transporte[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalMotoristas: 0,
    motoristasAtivos: 0,
    motoristasComTransporte: 0,
    motoristasDisponiveis: 0,
    transportesSemMotorista: 0
  });
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [searchTransporte, setSearchTransporte] = useState("");
  const [searchMotorista, setSearchMotorista] = useState("");
  const [selectedTransporte, setSelectedTransporte] = useState<string | null>(null);
  const [selectedMotorista, setSelectedMotorista] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/motoristas/atribuir');
      const data = await response.json();
      setTransportes(data.transportesSemMotorista || []);
      setMotoristas(data.motoristasDisponiveis || []);
      setStats(data.stats || {});
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAtribuir = async () => {
    if (!selectedTransporte || !selectedMotorista) {
      alert('Selecione um transporte e um motorista');
      return;
    }

    try {
      setAssigning(true);
      const response = await fetch('/api/motoristas/atribuir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motoristaId: selectedMotorista,
          transporteId: selectedTransporte
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Motorista atribuído com sucesso!');
        setSelectedTransporte(null);
        setSelectedMotorista(null);
        fetchData(); // Recarregar dados
      } else {
        alert(data.error || 'Erro ao atribuir motorista');
      }
    } catch (error) {
      console.error('Erro ao atribuir motorista:', error);
      alert('Erro ao atribuir motorista');
    } finally {
      setAssigning(false);
    }
  };

  const filteredTransportes = transportes.filter(t =>
    t.matricula.toLowerCase().includes(searchTransporte.toLowerCase()) ||
    t.modelo.toLowerCase().includes(searchTransporte.toLowerCase()) ||
    t.marca.toLowerCase().includes(searchTransporte.toLowerCase()) ||
    t.codigo.toString().includes(searchTransporte) ||
    t.via.nome.toLowerCase().includes(searchTransporte.toLowerCase())
  );

  const filteredMotoristas = motoristas.filter(m =>
    m.nome.toLowerCase().includes(searchMotorista.toLowerCase()) ||
    m.bi.toLowerCase().includes(searchMotorista.toLowerCase()) ||
    m.cartaConducao.toLowerCase().includes(searchMotorista.toLowerCase()) ||
    m.telefone.includes(searchMotorista)
  );

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Atribuir Motoristas</h1>
              <p className="text-sm text-slate-500 mt-1">
                Atribua motoristas disponíveis aos transportes sem motorista
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              ← Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-600 mb-1">Total Motoristas</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalMotoristas}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-600 mb-1">Motoristas Ativos</p>
            <p className="text-2xl font-bold text-green-600">{stats.motoristasAtivos}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-600 mb-1">Com Transporte</p>
            <p className="text-2xl font-bold text-blue-600">{stats.motoristasComTransporte}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-600 mb-1">Disponíveis</p>
            <p className="text-2xl font-bold text-purple-600">{stats.motoristasDisponiveis}</p>
          </div>
          <div className="bg-white rounded-lg border border-orange-200 p-4 bg-orange-50">
            <p className="text-xs text-orange-700 mb-1">Sem Motorista</p>
            <p className="text-2xl font-bold text-orange-600">{stats.transportesSemMotorista}</p>
          </div>
        </div>

        {/* Alert */}
        {stats.transportesSemMotorista > 0 && stats.motoristasDisponiveis === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-900">
                  Não há motoristas disponíveis para atribuição
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Todos os motoristas ativos já estão atribuídos a transportes. Registe novos motoristas ou liberte motoristas existentes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transportes sem Motorista */}
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4">
                Transportes sem Motorista ({filteredTransportes.length})
              </h2>
              <input
                type="text"
                placeholder="Pesquisar por matrícula, modelo, marca, código ou via..."
                value={searchTransporte}
                onChange={(e) => setSearchTransporte(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
              {filteredTransportes.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-slate-500 font-medium">Todos os transportes têm motorista!</p>
                </div>
              ) : (
                filteredTransportes.map((transporte) => (
                  <button
                    key={transporte.id}
                    onClick={() => setSelectedTransporte(transporte.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedTransporte === transporte.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900">{transporte.matricula}</span>
                      <span className="text-xs font-medium text-slate-600">#{transporte.codigo}</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">
                      {transporte.marca} {transporte.modelo}
                    </p>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: transporte.via.cor }}
                      ></div>
                      <span className="text-xs text-slate-500">{transporte.via.nome}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Motoristas Disponíveis */}
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4">
                Motoristas Disponíveis ({filteredMotoristas.length})
              </h2>
              <input
                type="text"
                placeholder="Pesquisar por nome, BI, carta ou telefone..."
                value={searchMotorista}
                onChange={(e) => setSearchMotorista(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
              {filteredMotoristas.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="text-slate-500 font-medium">Nenhum motorista disponível</p>
                  <p className="text-xs text-slate-400 mt-1">Registe novos motoristas ou liberte motoristas existentes</p>
                </div>
              ) : (
                filteredMotoristas.map((motorista) => (
                  <button
                    key={motorista.id}
                    onClick={() => setSelectedMotorista(motorista.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedMotorista === motorista.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold mr-3 text-sm">
                        {motorista.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-900">{motorista.nome}</p>
                        <p className="text-xs text-slate-500">BI: {motorista.bi}</p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>Carta: {motorista.cartaConducao}</p>
                      <p>Tel: {motorista.telefone}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900 mb-1">
                {selectedTransporte && selectedMotorista
                  ? 'Pronto para atribuir'
                  : 'Selecione um transporte e um motorista'}
              </p>
              <p className="text-xs text-slate-500">
                {!selectedTransporte && !selectedMotorista && 'Selecione ambos para continuar'}
                {selectedTransporte && !selectedMotorista && 'Agora selecione um motorista'}
                {!selectedTransporte && selectedMotorista && 'Agora selecione um transporte'}
                {selectedTransporte && selectedMotorista && 'Clique no botão para confirmar a atribuição'}
              </p>
            </div>
            <button
              onClick={handleAtribuir}
              disabled={!selectedTransporte || !selectedMotorista || assigning}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {assigning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Atribuindo...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Atribuir Motorista</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
