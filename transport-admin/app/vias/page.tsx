"use client";
import LoadingScreen from "../components/LoadingScreen";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "../hooks/useDebounce";

interface Via {
  id: string;
  nome: string;
  codigo: string;
  cor: string;
  /** Só as rotas activas aparecem na web, no USSD e nos SMS */
  ativa: boolean;
  terminalPartida: string;
  terminalChegada: string;
  municipio: {
    nome: string;
  };
  _count: {
    paragens: number;
    transportes: number;
  };
}

export default function Vias() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [vias, setVias] = useState<Via[]>([]);
  const [uniqueParagensCount, setUniqueParagensCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // Contadores de todas as vias que coincidem (os totais da API), não só da página mostrada
  const [totals, setTotals] = useState({ transportes: 0, paragens: 0 });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [viaToDelete, setViaToDelete] = useState<Via | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{message: string, details?: string, canRemove?: boolean} | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  // Por omissão só as rotas activas (as que os passageiros vêem); "todas" mostra também as desactivadas
  const [estado, setEstado] = useState<'true' | 'false' | ''>('true');
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetchVias();
    fetchUniqueParagensCount();
  }, [currentPage, itemsPerPage, debouncedSearchTerm, estado]);

  async function fetchVias() {
    try {
      // listLoading para os pedidos seguintes, initialLoading para a primeira carga
      if (vias.length > 0) {
        setListLoading(true);
      } else {
        setInitialLoading(true);
      }
      
      const response = await fetch(`/api/vias?page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(debouncedSearchTerm)}${estado ? `&ativa=${estado}` : ''}`);
      const result = await response.json();
      
      // Resposta paginada
      if (result.data && Array.isArray(result.data)) {
        setVias(result.data);
        setTotalCount(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
        if (result.totals) setTotals(result.totals);
      } else if (Array.isArray(result)) {
        // Recurso para a resposta antiga sem paginação
        setVias(result);
        setTotalCount(result.length);
      } else {
        setVias([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Erro ao carregar vias:', error);
      setVias([]);
      setTotalCount(0);
    } finally {
      setInitialLoading(false);
      setListLoading(false);
    }
  }

  async function fetchUniqueParagensCount() {
    try {
      const response = await fetch('/api/paragens?countOnly=true');
      const data = await response.json();
      setUniqueParagensCount(data.total || 0);
    } catch (error) {
      console.error('Erro ao carregar contagem de paragens:', error);
      setUniqueParagensCount(0);
    }
  }

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  /** Activa ou desactiva uma rota: uma rota desactivada sai do mapa, das viagens, do USSD e dos SMS */
  const toggleAtiva = async (via: Via, e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(via.id);
    try {
      const response = await fetch(`/api/vias/${via.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativa: !via.ativa }),
      });
      if (!response.ok) throw new Error();
      showNotification(via.ativa ? `Rota ${via.codigo} desactivada` : `Rota ${via.codigo} activada`, 'success');
      await fetchVias();
    } catch {
      showNotification('Não foi possível mudar o estado da rota', 'error');
    } finally {
      setToggling(null);
    }
  };

  const handleDeleteClick = (via: Via, e: React.MouseEvent) => {
    e.stopPropagation();
    setViaToDelete(via);
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  async function handleDelete() {
    if (!viaToDelete) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/vias/${viaToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Via eliminada com sucesso!', 'success');
        setShowDeleteModal(false);
        setViaToDelete(null);
        setDeleteError(null);
        fetchVias();
      } else {
        const error = await response.json();
        const hasDependencies = error.details?.includes('transportes') || 
                               error.details?.includes('paragens') ||
                               error.error?.includes('transportes') || 
                               error.error?.includes('paragens');
        setDeleteError({
          message: error.error || 'Erro ao eliminar via',
          details: error.details || 'Esta via pode ter transportes ou paragens associadas.',
          canRemove: hasDependencies
        });
      }
    } catch (error) {
      console.error('Erro ao eliminar via:', error);
      setDeleteError({
        message: 'Erro ao eliminar via',
        details: 'Ocorreu um erro inesperado. Tente novamente.',
        canRemove: false
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemoveAssignments(id: string) {
    setDeleting(true);
    try {
      // Passo 1: ler todos os transportes desta via
      const transportesResponse = await fetch(`/api/transportes?limit=1000`);
      if (transportesResponse.ok) {
        const result = await transportesResponse.json();
        const transportes = Array.isArray(result) ? result : (result.data || []);
        const transportesToUpdate = transportes.filter((t: any) => t.viaId === id);
        
        // Tirar a ligação à via dos transportes (viaId a null, SEM apagar os transportes)
        for (const transporte of transportesToUpdate) {
          try {
            // Tirar a ligação ao motorista (a null)
            await fetch(`/api/transportes/${transporte.id}/atribuir-motorista`, {
              method: 'DELETE',
            }).catch(() => {});
            
            // Tirar as ligações aos proprietários
            await fetch(`/api/transportes/${transporte.id}/proprietario`, {
              method: 'DELETE',
            }).catch(() => {});
            
            // Tirar a ligação à via (viaId a null, SEM apagar o transporte)
            await fetch(`/api/transportes/${transporte.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ viaId: null })
            }).catch(() => {});
          } catch (error) {
            console.error(`Erro ao remover associações do transporte ${transporte.id}:`, error);
          }
        }
      }

      // Passo 2: tirar todas as ligações a paragens (tabela ViaParagem)
      // Isto é tratado pela API ao apagar a via
      
      // Passo 3: apagar a via
      const deleteResponse = await fetch(`/api/vias/${id}`, {
        method: 'DELETE',
      });

      if (deleteResponse.ok) {
        showNotification('Via e todas as associações removidas com sucesso!', 'success');
        setDeleteError(null);
        setShowDeleteModal(false);
        setViaToDelete(null);
        fetchVias();
      } else {
        const error = await deleteResponse.json();
        showNotification(error.details || error.error || 'Erro ao eliminar via', 'error');
      }
    } catch (error) {
      console.error('Erro ao remover associações:', error);
      showNotification('Erro ao remover associações e eliminar via', 'error');
    } finally {
      setDeleting(false);
    }
  }

  // Voltar à página 1 quando a pesquisa ou o número de itens por página mudam
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm, itemsPerPage]);

  if (initialLoading) {
    return <LoadingScreen layout="admin" />;
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Notificação */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-xl shadow-lg p-4 min-w-[300px] ${
            notification.type === 'success' ? 'bg-slate-50 border border-slate-200' :
            notification.type === 'error' ? 'bg-slate-100 border border-slate-400' :
            'bg-slate-50 border border-slate-200'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <p className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-slate-800' :
                notification.type === 'error' ? 'text-slate-900' :
                'text-slate-800'
              }`}>
                {notification.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de confirmação do apagar */}
      {showDeleteModal && viaToDelete && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm min-h-screen" 
          style={{ minHeight: '100vh', height: '100%' }}
          onClick={() => {
            setShowDeleteModal(false);
            setViaToDelete(null);
          }}
        >
          <div className="flex items-center justify-center min-h-screen p-4">
            <div 
              className="relative z-[101] bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-slate-200 my-8"
              onClick={(e) => e.stopPropagation()}
            >
            {deleteError ? (
              <>
                <div className="flex items-center justify-center w-12 h-12 bg-slate-200 rounded-full mx-auto mb-4">
                  <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
                  Não é Possível Eliminar
                </h3>
                
                <p className="text-slate-600 text-center mb-4">
                  {deleteError.details || deleteError.message}
                </p>

                <div className="flex flex-col space-y-2">
                  {deleteError.canRemove && (
                    <button
                      onClick={() => viaToDelete && handleRemoveAssignments(viaToDelete.id)}
                      disabled={deleting}
                      className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Removendo e Eliminando...</span>
                        </>
                      ) : (
                        <span>Remover Dependências e Eliminar</span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setViaToDelete(null);
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-12 h-12 bg-slate-200 rounded-full mx-auto mb-4">
                  <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
                  Eliminar Via
                </h3>
                
                <p className="text-slate-600 text-center mb-6">
                  Tem certeza que deseja eliminar a via <strong className="text-slate-900">"{viaToDelete.nome}"</strong>?
                  <br />
                  <span className="text-sm text-slate-900 font-medium">Esta ação não pode ser desfeita.</span>
                </p>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setViaToDelete(null);
                    }}
                    disabled={deleting}
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Eliminando...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Eliminar</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Cabeçalho em 2 colunas */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Esquerda: título e descrição */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-xl hover:bg-slate-100 flex-shrink-0"
            >
              <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Vias</h2>
              <p className="hidden lg:block text-slate-600 mt-1">Gestão de todas as vias do sistema</p>
            </div>
          </div>

          {/* À direita: botão de acção */}
          <button 
            onClick={() => router.push('/vias/novo')}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium flex items-center space-x-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Nova Via</span>
          </button>
        </div>

        {/* Cartões de estatísticas, pequenos e compactos */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={() => router.push('/vias')}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-900 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium">Total</p>
                <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
              </div>
            </div>
          </button>
          <button 
            onClick={() => router.push('/paragens')}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-900 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium">Paragens</p>
                <p className="text-2xl font-bold text-slate-900">{uniqueParagensCount}</p>
              </div>
            </div>
          </button>
          <button 
            onClick={() => router.push('/transportes')}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-900 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium">Transportes</p>
                <p className="text-2xl font-bold text-slate-900">{totals.transportes}</p>
              </div>
            </div>
          </button>
          <button 
            onClick={() => router.push('/vias')}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-900 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium">Média Paragens</p>
                <p className="text-2xl font-bold text-slate-900">{totalCount > 0 ? Math.round(totals.paragens / totalCount) : 0}</p>
              </div>
            </div>
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Pesquisar por nome, código ou município..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-900"
                  style={{ transition: 'none' }}
                />
              </div>
              <select
                value={estado}
                onChange={(e) => { setEstado(e.target.value as typeof estado); setCurrentPage(1); }}
                aria-label="Estado das rotas"
                className="py-2.5 px-3 border border-slate-300 rounded-xl text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="true">Activas</option>
                <option value="false">Desactivadas</option>
                <option value="">Todas</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {listLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
              </div>
            ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Nome da Via
                  </th>
                  <th className="hidden xl:table-cell px-4 py-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Município
                  </th>
                  <th className="hidden xl:table-cell px-4 py-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Rota
                  </th>
                  <th className="hidden xl:table-cell px-4 py-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Cor
                  </th>
                  <th className="hidden md:table-cell px-4 py-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Paragens
                  </th>
                  <th className="hidden md:table-cell px-4 py-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Transportes
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Acções
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {vias.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <p className="text-lg font-medium">Nenhuma via encontrada</p>
                        <p className="text-sm mt-1">Tente ajustar os filtros de pesquisa</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  vias.map((via) => (
                    <tr 
                      key={via.id} 
                      onClick={() => router.push(`/vias/${via.id}`)}
                      className="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                      style={{ transition: 'none' }}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mr-3">
                            <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{via.codigo}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-slate-900">{via.nome}</div>
                      </td>
                      <td className="hidden xl:table-cell px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{via.municipio?.nome || 'N/A'}</div>
                      </td>
                      <td className="hidden xl:table-cell px-4 py-4">
                        <div className="text-sm text-slate-900">
                          {via.terminalPartida} → {via.terminalChegada}
                        </div>
                      </td>
                      <td className="hidden xl:table-cell px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className="w-6 h-6 rounded-full mr-2 border-2 border-white shadow-sm"
                            style={{ backgroundColor: via.cor || '#3B82F6' }}
                          ></div>
                          <span className="text-sm text-slate-900 font-mono">{via.cor}</span>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900 font-medium">{via._count?.paragens || 0}</div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900 font-medium">{via._count?.transportes || 0}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          onClick={(e) => toggleAtiva(via, e)}
                          disabled={toggling === via.id}
                          title={via.ativa ? 'Desactivar: deixa de aparecer aos passageiros' : 'Activar: aparece aos passageiros'}
                          data-testid="via-ativa"
                          className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${via.ativa ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          {via.ativa ? 'Activa' : 'Desactivada'}
                        </button>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2 lg:space-x-3">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard?via=${via.id}`);
                            }}
                            className="hidden lg:inline-block text-slate-600 hover:text-slate-900"
                            title="Ver no mapa"
                            style={{ transition: 'none' }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/vias/${via.id}`);
                            }}
                            className="text-slate-600 hover:text-slate-900"
                            title="Ver detalhes"
                            style={{ transition: 'none' }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button 
                            onClick={(e) => handleDeleteClick(via, e)}
                            className="hidden lg:inline-block text-slate-900 hover:text-slate-900"
                            title="Eliminar"
                            style={{ transition: 'none' }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )}
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-slate-600">
                Mostrando <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalCount)}</span> de <span className="font-medium">{totalCount}</span> vias
              </div>
              <div className="hidden lg:flex items-center space-x-2">
                <label className="text-sm text-slate-900 font-medium">Itens por página:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-slate-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Números das páginas */}
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-4 py-2 rounded-xl font-medium ${
                        currentPage === pageNum
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-300 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-slate-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
