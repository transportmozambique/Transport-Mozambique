"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Report {
  id: string;
  titulo: string;
  descricao: string;
  icon: string;
  categoria: string;
  entity: string;
}

interface EntityData {
  [key: string]: any[];
}

interface StatsData {
  totalTransportes?: number;
  totalVias?: number;
  totalParagens?: number;
  totalProprietarios?: number;
  totalMotoristas?: number;
  totalProvincias?: number;
  totalMunicipios?: number;
  totalUtentes?: number;
  transportComMotorista?: number;
  transportSemMotorista?: number;
  motoristasAtivos?: number;
  utentesSubscritos?: number;
}

// Most records a report loads (the table shows the first 100)
const REPORT_LIMIT = 5000;

export default function Relatorios() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState("Todos");
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportData, setReportData] = useState<EntityData>({});
  const [stats, setStats] = useState<StatsData>({});
  const [isLoadingData, setIsLoadingData] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const relatorios: Report[] = [
    {
      id: "transportes",
      titulo: "Transportes",
      descricao: "Relatorio completo de todos os transportes registados no sistema",
      icon: "bus",
      categoria: "Transportes",
      entity: "transportes"
    },
    {
      id: "vias",
      titulo: "Vias / Rotas",
      descricao: "Listagem completa de todas as vias e rotas de transporte",
      icon: "route",
      categoria: "Vias",
      entity: "vias"
    },
    {
      id: "paragens",
      titulo: "Paragens",
      descricao: "Relatorio de todos os pontos de paragem existentes",
      icon: "stop",
      categoria: "Paragens",
      entity: "paragens"
    },
    {
      id: "proprietarios",
      titulo: "Proprietarios",
      descricao: "Lista de todos os proprietarios de transportes registados",
      icon: "owner",
      categoria: "Proprietarios",
      entity: "proprietarios"
    },
    {
      id: "motoristas",
      titulo: "Motoristas",
      descricao: "Relatorio completo de motoristas com as suas atribuicoes",
      icon: "driver",
      categoria: "Motoristas",
      entity: "motoristas"
    },
    {
      id: "provincias",
      titulo: "Provincias",
      descricao: "Lista de todas as provincias do pais",
      icon: "province",
      categoria: "Provincias",
      entity: "provincias"
    },
    {
      id: "municipios",
      titulo: "Municipios",
      descricao: "Relatorio de todos os municipios por provincia",
      icon: "city",
      categoria: "Municipios",
      entity: "municipios"
    },
    {
      id: "utentes",
      titulo: "Utentes",
      descricao: "Lista de todos os utentes/subscritores do sistema",
      icon: "users",
      categoria: "Utentes",
      entity: "utentes"
    },
    {
      id: "estatisticas",
      titulo: "Estatisticas Gerais",
      descricao: "Relatorio geral com todas as estatisticas e metricas do sistema",
      icon: "stats",
      categoria: "Geral",
      entity: "estatisticas"
    },
  ];

  const categorias = ["Todos", "Transportes", "Vias", "Paragens", "Proprietários", "Motoristas", "Províncias", "Municípios", "Utentes", "Geral"];

  const filteredRelatorios = relatorios.filter((r) => {
    const matchesSearch = r.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = selectedCategoria === "Todos" || r.categoria === selectedCategoria;
    return matchesSearch && matchesCategoria;
  });

  const fetchReportData = async (report: Report) => {
    setIsLoadingData(true);

    if (report.entity === 'estatisticas') {
      try {
        const statsRes = await fetch('/api/relatorios/stats');
        if (!statsRes.ok) {
          throw new Error(`HTTP error! status: ${statsRes.status}`);
        }
        const statsData = await statsRes.json();
        setStats(statsData);
        setShowReportModal(true);
        setSelectedReport(report);
      } catch (error) {
        console.error("Error fetching stats:", error);
        showNotification("Erro ao carregar estatísticas", "error");
      } finally {
        setIsLoadingData(false);
      }
      return;
    }

    // This dashboard's own API (the session cookie authorises it); every list returns { data }
    const url = `/api/${report.entity}?limit=${REPORT_LIMIT}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      const data: any[] = Array.isArray(jsonData.data) ? jsonData.data : [];

      setReportData({ [report.entity]: data });
      setShowReportModal(true);
      setSelectedReport(report);
    } catch (error) {
      console.error("Error fetching data:", error);
      showNotification("Erro ao carregar dados do relatório: " + (error as Error).message, "error");
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleGenerateReport = async (report: Report) => {
    setIsGenerating(report.id);
    showNotification(`A gerar relatório: ${report.titulo}...`, 'info');

    try {
      await fetchReportData(report);
      showNotification(`Relatório "${report.titulo}" carregado com sucesso!`, 'success');
    } catch (error) {
      showNotification(`Erro ao gerar relatório "${report.titulo}"`, "error");
    } finally {
      setIsGenerating(null);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showNotification("Por favor permita popups para imprimir", "error");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedReport?.titulo || 'Relatório'} - TransportMZ</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #fff; }
            h1 { color: #000; border-bottom: 2px solid #000; padding-bottom: 10px; }
            h2 { color: #333; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
            th { background-color: #333; color: #fff; }
            tr:nth-child(even) { background-color: #f5f5f5; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
            .stat-box { border: 1px solid #ccc; padding: 15px; text-align: center; border-radius: 8px; }
            .stat-number { font-size: 24px; font-bold; color: #000; }
            .stat-label { font-size: 12px; color: #666; }
            .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('pt-MZ', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const renderTableData = (data: any[], entity: string) => {
    if (!data || data.length === 0) {
      return <p className="text-slate-500">Sem dados disponíveis</p>;
    }

    const getValue = (item: any, key: string) => {
      const value = item[key];
      if (value === null || value === undefined) return '-';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    };

    const getHeaders = () => {
      const keys = new Set<string>();
      data.forEach(item => {
        Object.keys(item).forEach(key => {
          if (key !== 'password' && key !== 'senha') {
            keys.add(key);
          }
        });
      });
      return Array.from(keys).slice(0, 8);
    };

    const headers = getHeaders();
    const labelMap: { [key: string]: string } = {
      id: 'ID',
      nome: 'Nome',
      nomeCompleto: 'Nome Completo',
      email: 'Email',
      telefone: 'Telefone',
      bi: 'BI',
      matricula: 'Matrícula',
      marca: 'Marca',
      modelo: 'Modelo',
      cor: 'Cor',
      lotacao: 'Lotação',
      codigo: 'Código',
      estado: 'Estado',
      categoria: 'Categoria',
      experienciaAnos: 'Anos Experiência',
      dataNascimento: 'Data Nascimento',
      nacionalidade: 'Nacionalidade',
      endereco: 'Endereço',
      contactos: 'Contactos',
      municipio: 'Município',
      provincia: 'Provínica',
      terminalPartida: 'Terminal Partida',
      terminalChegada: 'Terminal Chegada',
      geoLocation: 'Localização',
      currGeoLocation: 'Localização Atual',
      routePath: 'Rota',
    };

    const getLabel = (key: string) => labelMap[key] || key;

    return (
      <table className="min-w-full divide-y divide-slate-300">
        <thead className="bg-slate-200">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                {getLabel(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-300">
          {data.slice(0, 100).map((item, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              {headers.map((header) => (
                <td key={header} className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap">
                  {getValue(item, header)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-xl shadow-lg p-4 min-w-[300px] ${
            notification.type === 'success' ? 'bg-slate-800 border border-slate-700' :
            notification.type === 'error' ? 'bg-slate-900 border border-slate-800' :
            'bg-slate-700 border border-slate-600'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className="text-sm font-medium text-white">
                {notification.message}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-xl hover:bg-slate-200 flex-shrink-0"
            >
              <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Relatórios</h2>
              <p className="hidden lg:block text-slate-600 mt-1">Gere relatórios e análises do sistema</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => router.push('/relatorios/historico')}
              className="bg-slate-800 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Histórico</span>
            </button>
            <button
              onClick={() => router.push('/relatorios/agendar')}
              className="bg-slate-800 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Agendar</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-300 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium mb-1">Relatórios Disponíveis</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">{relatorios.length}</p>
              </div>
              <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-300 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium mb-1">Entidades</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">8</p>
              </div>
              <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-300 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium mb-1">Categorias</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">{categorias.length - 1}</p>
              </div>
              <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-300 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium mb-1">Exportação</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">PDF</p>
              </div>
              <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-300 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Pesquisar relatórios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-900"
              />
            </div>
            <div>
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
              >
                {categorias.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRelatorios.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
              <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">Nenhum relatório encontrado</p>
              <p className="text-sm mt-1">Tente ajustar os filtros de pesquisa</p>
            </div>
          ) : (
            filteredRelatorios.map((relatorio) => (
              <div
                key={relatorio.id}
                className="bg-white rounded-2xl border border-slate-300 hover:border-slate-900 hover:shadow-lg transition-all duration-200 p-6 flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="px-3 py-1 text-xs font-medium bg-slate-200 text-slate-700 rounded-full">
                    {relatorio.categoria}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{relatorio.titulo}</h3>
                <p className="text-sm text-slate-600 mb-4 flex-grow">{relatorio.descricao}</p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleGenerateReport(relatorio)}
                    disabled={isGenerating === relatorio.id}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isGenerating === relatorio.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    <span>{isGenerating === relatorio.id ? 'A gerar...' : 'Gerar PDF'}</span>
                  </button>
                  <button
                    onClick={() => handleGenerateReport(relatorio)}
                    className="p-2.5 border border-slate-300 rounded-xl hover:bg-slate-100"
                    title="Ver dados"
                  >
                    <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl border border-slate-300 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Entidades Disponiveis para Relatorio</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "bus", name: "Transportes", desc: "Veiculos registados" },
              { icon: "route", name: "Vias", desc: "Rotas e caminhos" },
              { icon: "stop", name: "Paragens", desc: "Pontos de paragem" },
              { icon: "owner", name: "Proprietarios", desc: "Donos de veiculos" },
              { icon: "driver", name: "Motoristas", desc: "Condutores" },
              { icon: "province", name: "Provincias", desc: "Regioes do pais" },
              { icon: "city", name: "Municipios", desc: "Cidades e vilas" },
              { icon: "users", name: "Utentes", desc: "Utilizadores" },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && selectedReport && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-300 bg-slate-100">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{selectedReport.titulo}</h2>
                <p className="text-slate-600">Dados do sistema</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrint}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-medium flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-xl"
                >
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {isLoadingData ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="w-8 h-8 animate-spin text-slate-700" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : selectedReport.entity === 'estatisticas' ? (
                <div ref={printRef}>
                  <div className="text-center mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Estatísticas Gerais do Sistema</h1>
                    <p className="text-slate-600">Data de geração: {formatDate()}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-6 text-center border border-slate-300">
                      <p className="text-4xl font-bold text-slate-900">{stats.totalTransportes || 0}</p>
                      <p className="text-sm text-slate-600 mt-1">Transportes</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 text-center border border-slate-300">
                      <p className="text-4xl font-bold text-slate-900">{stats.totalVias || 0}</p>
                      <p className="text-sm text-slate-600 mt-1">Vias</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 text-center border border-slate-300">
                      <p className="text-4xl font-bold text-slate-900">{stats.totalParagens || 0}</p>
                      <p className="text-sm text-slate-600 mt-1">Paragens</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 text-center border border-slate-300">
                      <p className="text-4xl font-bold text-slate-900">{stats.totalMotoristas || 0}</p>
                      <p className="text-sm text-slate-600 mt-1">Motoristas</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 text-center border border-slate-300">
                      <p className="text-4xl font-bold text-slate-900">{stats.totalProprietarios || 0}</p>
                      <p className="text-sm text-slate-600 mt-1">Proprietários</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 text-center border border-slate-300">
                      <p className="text-4xl font-bold text-slate-900">{stats.totalProvincias || 0}</p>
                      <p className="text-sm text-slate-600 mt-1">Províncias</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 text-center border border-slate-300">
                      <p className="text-4xl font-bold text-slate-900">{stats.totalMunicipios || 0}</p>
                      <p className="text-sm text-slate-600 mt-1">Municípios</p>
                    </div>
                    <div className="bg-white rounded-xl p-6 text-center border border-slate-300">
                      <p className="text-4xl font-bold text-slate-900">{stats.totalUtentes || 0}</p>
                      <p className="text-sm text-slate-600 mt-1">Utentes</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 border border-slate-300">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Métricas Adicionais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border">
                        <span className="text-slate-600">Transportes com Motorista</span>
                        <span className="font-bold text-slate-900">{stats.transportComMotorista || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border">
                        <span className="text-slate-600">Transportes sem Motorista</span>
                        <span className="font-bold text-slate-900">{stats.transportSemMotorista || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border">
                        <span className="text-slate-600">Motoristas Ativos</span>
                        <span className="font-bold text-slate-900">{stats.motoristasAtivos || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border">
                        <span className="text-slate-600">Utentes Subscritos</span>
                        <span className="font-bold text-slate-900">{stats.utentesSubscritos || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 text-center text-slate-500 text-sm">
                    <p>Relatório gerado por TransportMZ em {formatDate()}</p>
                  </div>
                </div>
              ) : (
                <div ref={printRef}>
                  <div className="text-center mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">{selectedReport.titulo}</h1>
                    <p className="text-slate-600">Data de geração: {formatDate()}</p>
                  </div>

                  {reportData[selectedReport.entity] ? (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-slate-600">Total de registos: {reportData[selectedReport.entity].length}</p>
                      </div>
                      {renderTableData(reportData[selectedReport.entity], selectedReport.entity)}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">Sem dados disponíveis para este relatório</p>
                  )}

                  <div className="mt-6 text-center text-slate-500 text-sm">
                    <p>Relatório gerado por TransportMZ em {formatDate()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}