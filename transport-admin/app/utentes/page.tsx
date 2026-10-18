"use client";
import LoadingScreen from "../components/LoadingScreen";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "../hooks/useDebounce";

interface Utente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  mISSION: string;
  subscrito: boolean;
  dataSubscricao: string | null;
  geoLocation: string | null;
  createdAt: string;
  _count?: {
    missoes: number;
  };
}

interface ModalState {
  show: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
}

export default function UtentesPage() {
  const router = useRouter();
  const [utentes, setUtentes] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [modal, setModal] = useState<ModalState>({
    show: false,
    title: '',
    message: '',
  });

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    fetchUtentes();
  }, [debouncedSearchTerm, currentPage, itemsPerPage]);

  async function fetchUtentes() {
    try {
      setLoading(true);
      const timestamp = Date.now();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: debouncedSearchTerm,
        _: timestamp.toString(),
      });

      const response = await fetch(`/api/utentes?${params}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUtentes(data.data || []);
        setTotalPages(data.totalPages || 0);
        setTotalCount(data.total || 0);
      } else {
        showNotification('Erro ao carregar utentes', 'error');
      }
    } catch (error) {
      console.error('Erro ao carregar utentes:', error);
      showNotification('Erro ao carregar utentes', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading && utentes.length === 0) {
    return <LoadingScreen layout="admin" />;
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Notification Toast */}
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

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Utentes</h1>
            <p className="text-slate-600 mt-1">
              {totalCount} {totalCount === 1 ? 'utente registado' : 'utentes registados'}
            </p>
          </div>
          <button
            onClick={() => router.push('/utentes/criar')}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Novo Utente</span>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Pesquisar por nome, email, telefone ou MISSION..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-slate-600 whitespace-nowrap">Mostrar:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Utentes Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
          ) : utentes.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-slate-900 uppercase tracking-wider">
                        Utente
                      </th>
                      <th className="hidden md:table-cell px-4 py-4 text-left text-xs font-semibold text-slate-900 uppercase tracking-wider">
                        Contacto
                      </th>
                      <th className="hidden 2xl:table-cell px-4 py-4 text-left text-xs font-semibold text-slate-900 uppercase tracking-wider">
                        MISSION
                      </th>
                      <th className="hidden sm:table-cell px-4 py-4 text-left text-xs font-semibold text-slate-900 uppercase tracking-wider">
                        Subscrição
                      </th>
                      <th className="hidden xl:table-cell px-4 py-4 text-left text-xs font-semibold text-slate-900 uppercase tracking-wider">
                        Missões
                      </th>
                      <th className="hidden xl:table-cell px-4 py-4 text-left text-xs font-semibold text-slate-900 uppercase tracking-wider">
                        Registado
                      </th>
                      <th className="px-4 py-4 text-right text-xs font-semibold text-slate-900 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {utentes.map((utente) => (
                      <tr 
                        key={utente.id} 
                        onClick={() => router.push(`/utentes/${utente.id}`)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="hidden sm:flex w-10 h-10 bg-slate-100 rounded-full items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div>
                              <p className="max-w-[140px] truncate font-semibold text-slate-900 sm:max-w-none">{utente.nome}</p>
                              <p className="max-w-[140px] truncate text-sm text-slate-500 sm:max-w-none">{utente.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-4">
                          <p className="text-sm text-slate-900">{utente.telefone}</p>
                        </td>
                        <td className="hidden 2xl:table-cell px-4 py-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-900 rounded-lg text-xs font-mono">
                            {utente.mISSION}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-4">
                          {utente.subscrito ? (
                            <div>
                              <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold">
                                Subscrito
                              </span>
                              {utente.dataSubscricao && (
                                <p className="text-xs text-slate-500 mt-1">
                                  {new Date(utente.dataSubscricao).toLocaleDateString('pt-PT')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold">
                              Não subscrito
                            </span>
                          )}
                        </td>
                        <td className="hidden xl:table-cell px-4 py-4">
                          <span className="text-sm font-semibold text-slate-900">
                            {utente._count?.missoes || 0}
                          </span>
                        </td>
                        <td className="hidden xl:table-cell px-4 py-4">
                          <p className="text-sm text-slate-600">
                            {new Date(utente.createdAt).toLocaleDateString('pt-PT')}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/utentes/${utente.id}`);
                              }}
                              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                              title="Ver detalhes"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/utentes/${utente.id}/editar`);
                              }}
                              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                              title="Editar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModal({
                                  show: true,
                                  title: 'Eliminar Utente',
                                  message: `Tem certeza que deseja eliminar o utente "${utente.nome}"?`,
                                  onConfirm: () => {
                                    setModal({ show: false, title: '', message: '' });
                                    fetch(`/api/utentes/${utente.id}`, { method: 'DELETE' })
                                      .then(res => res.json())
                                      .then(data => {
                                        if (data.success) {
                                          showNotification('Utente eliminado com sucesso!', 'success');
                                          fetchUtentes();
                                        } else {
                                          showNotification(data.error || 'Erro ao eliminar utente', 'error');
                                        }
                                      })
                                      .catch(() => showNotification('Erro ao eliminar utente', 'error'));
                                  },
                                });
                              }}
                              className="p-2 text-slate-900 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                              title="Eliminar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                  <div className="text-sm text-slate-600">
                    Página {currentPage} de {totalPages} • Total: {totalCount} {totalCount === 1 ? 'utente' : 'utentes'}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-slate-900 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-slate-900 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Nenhum utente encontrado</h3>
              <p className="text-slate-600 mb-4">
                {searchTerm ? 'Tente ajustar os termos de pesquisa' : 'Comece criando um novo utente'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => router.push('/utentes/criar')}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium inline-flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Criar Primeiro Utente</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {modal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            onClick={() => setModal({ show: false, title: '', message: '' })}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-slate-900 mb-3">
              {modal.title}
            </h3>
            <p className="text-slate-700 mb-6">
              {modal.message}
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setModal({ show: false, title: '', message: '' })}
                className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => modal.onConfirm?.()}
                className="flex-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
