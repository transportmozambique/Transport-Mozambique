"use client";
import LoadingScreen from "../components/LoadingScreen";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "../hooks/useDebounce";

interface Paragem {
  id: string;
  nome: string;
  codigo: string;
  geoLocation: string;
  vias: Array<{
    via: {
      nome: string;
      codigo: string;
    };
    terminalBoolean: boolean;
  }>;
}

export default function Paragens() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [paragens, setParagens] = useState<Paragem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [terminais, setTerminais] = useState(0);
  const [paragensRegulares, setParagensRegulares] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [paragemToDelete, setParagemToDelete] = useState<{id: string, nome: string} | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{message: string, details?: string, canRemove?: boolean} | null>(null);

  useEffect(() => {
    fetchCounts();
  }, []);

  useEffect(() => {
    fetchParagens();
  }, [currentPage, itemsPerPage, debouncedSearchTerm]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  async function fetchCounts() {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/paragens?countOnly=true&_=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await response.json();
      setTotalCount(data.total);
      setTerminais(data.terminais);
      setParagensRegulares(data.paragensRegulares);
    } catch (error) {
      console.error('Erro ao carregar contagens:', error);
    }
  }

  async function fetchParagens() {
    try {
      // Use listLoading for subsequent fetches, loading for initial load
      if (paragens.length > 0) {
        setListLoading(true);
      } else {
        setLoading(true);
      }
      
      // Add cache busting to ensure fresh data
      const timestamp = new Date().getTime();
      const response = await fetch(
        `/api/paragens?page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(debouncedSearchTerm)}&_=${timestamp}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      );
      const data = await response.json();
      setParagens(data.data);
      setTotalCount(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Erro ao carregar paragens:', error);
      showNotification('Erro ao carregar paragens', 'error');
    } finally {
      setLoading(false);
      setListLoading(false);
    }
  }

  // Reset to page 1 when search term or items per page changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm, itemsPerPage]);

  const handleView = (id: string) => {
    router.push(`/paragens/${id}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/paragens/${id}/editar`);
  };

  const confirmDelete = (id: string, nome: string) => {
    console.log('confirmDelete called with:', { id, nome });
    setParagemToDelete({ id, nome });
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const handleDelete = async (id: string) => {
    console.log('handleDelete called with id:', id);
    setDeleting(true);
    setDeleteError(null);
    try {
      console.log('Sending DELETE request to:', `/api/paragens/${id}`);
      const response = await fetch(`/api/paragens/${id}`, {
        method: 'DELETE',
      });

      console.log('DELETE response status:', response.status);
      console.log('DELETE response ok:', response.ok);

      if (response.ok) {
        console.log('Delete successful, refreshing list...');
        showNotification('Paragem eliminada com sucesso!', 'success');
        setShowDeleteModal(false);
        setParagemToDelete(null);
        setDeleteError(null);
        await fetchParagens();
        await fetchCounts();
        console.log('List refreshed');
      } else {
        const error = await response.json();
        console.log('DELETE error response:', error);
        // Check if error is about vias associations
        const hasVias = error.details?.includes('vias') || error.error?.includes('vias');
        setDeleteError({
          message: error.error || 'Erro ao eliminar paragem',
          details: error.details || 'Esta paragem pode ter vias associadas.',
          canRemove: hasVias
        });
      }
    } catch (error) {
      console.error('Exception during delete:', error);
      setDeleteError({
        message: 'Erro ao eliminar paragem',
        details: 'Ocorreu um erro inesperado. Tente novamente.',
        canRemove: false
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveAssignments = async (id: string) => {
    setDeleting(true);
    try {
      // Step 1: Remove all ParagemVia associations
      // The API should handle cascade deletion of ParagemVia records
      // when the paragem is deleted, so we just delete the paragem
      const deleteResponse = await fetch(`/api/paragens/${id}?force=true`, {
        method: 'DELETE',
      });

      if (deleteResponse.ok) {
        showNotification('Paragem e todas as associações eliminadas com sucesso!', 'success');
        setDeleteError(null);
        setShowDeleteModal(false);
        setParagemToDelete(null);
        await fetchParagens();
        await fetchCounts();
      } else {
        const error = await deleteResponse.json();
        showNotification(error.details || error.error || 'Erro ao eliminar paragem', 'error');
      }
    } catch (error) {
      console.error('Erro ao remover associações:', error);
      showNotification('Erro ao remover associações e eliminar paragem', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = () => {
    router.push('/paragens/novo');
  };

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-lg shadow-lg p-4 min-w-[300px] ${
            notification.type === 'success' ? 'bg-green-50 border border-green-200' :
            notification.type === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-green-800' :
                notification.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {notification.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && paragemToDelete && (
        <div 
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm min-h-screen" 
          style={{ minHeight: '100vh', height: '100%' }}
          onClick={() => {
            setShowDeleteModal(false);
            setParagemToDelete(null);
          }}
        >
          <div className="flex items-center justify-center min-h-screen p-4">
            <div 
              className="relative z-[101] bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-gray-200 my-8"
              onClick={(e) => e.stopPropagation()}
            >
            {deleteError ? (
              <>
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                  Não é Possível Eliminar
                </h3>
                
                <p className="text-gray-600 text-center mb-4">
                  {deleteError.details || deleteError.message}
                </p>

                <div className="flex flex-col space-y-2">
                  {deleteError.canRemove && (
                    <button
                      onClick={() => paragemToDelete && handleRemoveAssignments(paragemToDelete.id)}
                      disabled={deleting}
                      className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Removendo e Eliminando...</span>
                        </>
                      ) : (
                        <span>Remover Associações e Eliminar</span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setParagemToDelete(null);
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                  Eliminar Paragem
                </h3>
                
                <p className="text-gray-600 text-center mb-6">
                  Tem certeza que deseja eliminar a paragem <strong className="text-gray-900">"{paragemToDelete.nome}"</strong>?
                  <br />
                  <span className="text-sm text-red-600 font-medium">Esta ação não pode ser desfeita.</span>
                </p>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setParagemToDelete(null);
                    }}
                    disabled={deleting}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => paragemToDelete && handleDelete(paragemToDelete.id)}
                    disabled={deleting}
                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        {/* Header - 2 Columns Layout */}
        <div className="flex items-center justify-between gap-4">
          {/* Left - Title and Description */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0"
            >
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Paragens</h2>
              <p className="hidden lg:block text-gray-600 mt-1">Gestão de todas as paragens e terminais do sistema</p>
            </div>
          </div>

          {/* Right - Action Button */}
          <button 
            onClick={handleCreate}
            className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Nova Paragem</span>
          </button>
        </div>

        {/* Stats Cards - Smaller and More Compact */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={(e) => {
              e.preventDefault();
              console.log('Card clicked: Total Paragens, current path:', window.location.pathname);
              window.location.href = '/paragens';
            }}
            type="button"
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Paragens</p>
                <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              </div>
            </div>
          </button>

          <button 
            onClick={(e) => {
              e.preventDefault();
              console.log('Card clicked: Terminais, current path:', window.location.pathname);
              window.location.href = '/paragens';
            }}
            type="button"
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Terminais</p>
                <p className="text-2xl font-bold text-gray-900">{terminais}</p>
              </div>
            </div>
          </button>

          <button 
            onClick={(e) => {
              e.preventDefault();
              console.log('Card clicked: Paragens Regulares, current path:', window.location.pathname);
              window.location.href = '/paragens';
            }}
            type="button"
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Paragens Regulares</p>
                <p className="text-2xl font-bold text-gray-900">{paragensRegulares}</p>
              </div>
            </div>
          </button>

          <button 
            onClick={(e) => {
              e.preventDefault();
              console.log('Card clicked: Média Vias/Paragem, navigating to /vias');
              window.location.href = '/vias';
            }}
            type="button"
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Média Vias/Paragem</p>
                <p className="text-2xl font-bold text-gray-900">
                  {totalCount > 0 && paragens.length > 0 ? Math.round(paragens.reduce((sum, p) => sum + p.vias.length, 0) / paragens.length) : 0}
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {listLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Paragem
                  </th>
                  <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Vias
                  </th>
                  <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Coordenadas
                  </th>
                  <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Acções
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paragens.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-lg font-medium">Nenhuma paragem encontrada</p>
                        <p className="text-sm mt-1">Tente ajustar os filtros de pesquisa</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paragens.map((paragem) => {
                    const isTerminal = paragem.vias.some(v => v.terminalBoolean);
                    const coords = paragem.geoLocation.split(',');
                    
                    return (
                      <tr 
                        key={paragem.id} 
                        onClick={() => handleView(paragem.id)}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-4 lg:px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{paragem.nome}</div>
                              <div className="text-xs text-gray-500">Código: {paragem.codigo}</div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {paragem.vias.slice(0, 2).map((v, idx) => (
                              <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
                                {v.via.nome}
                              </span>
                            ))}
                            {paragem.vias.length > 2 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md font-medium">
                                +{paragem.vias.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            isTerminal
                              ? "bg-gray-900 text-white"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {isTerminal ? "Terminal" : "Paragem"}
                          </span>
                        </td>
                        <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 font-mono">
                            {coords[0]?.trim()}, {coords[1]?.trim()}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2 lg:space-x-3">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleView(paragem.id);
                              }}
                              className="text-gray-600 hover:text-gray-900"
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
                                handleEdit(paragem.id);
                              }}
                              className="hidden lg:inline-block text-gray-600 hover:text-gray-900"
                              title="Editar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDelete(paragem.id, paragem.nome);
                              }}
                              className="hidden lg:inline-block text-gray-600 hover:text-gray-900"
                              title="Eliminar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            )}
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Mostrando <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalCount)}</span> de <span className="font-medium">{totalCount}</span> paragens
              </div>
              <div className="hidden lg:flex items-center space-x-2">
                <label className="text-sm text-gray-900 font-medium">Itens por página:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
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
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Page numbers */}
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
                      className={`px-4 py-2 rounded-lg font-medium ${
                        currentPage === pageNum
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
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
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
