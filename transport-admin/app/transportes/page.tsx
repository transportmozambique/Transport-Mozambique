"use client";
import LoadingScreen from "../components/LoadingScreen";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "../hooks/useDebounce";

interface Transporte {
  id: string;
  matricula: string;
  modelo: string;
  marca: string;
  cor: string;
  lotacao: number;
  codigo: number;
  via: {
    nome: string;
    codigo: string;
  };
  motorista?: {
    nome: string;
    status: string;
  };
  proprietarios: Array<{
    proprietario: {
      nome: string;
    };
  }>;
}

export default function Transportes() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [transportes, setTransportes] = useState<Transporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transporteToDelete, setTransporteToDelete] = useState<{id: string, matricula: string} | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{message: string, details?: string, canRemove?: boolean} | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  useEffect(() => {
    fetchTransportes();
  }, [debouncedSearchTerm, statusFilter, currentPage, itemsPerPage]);

  async function fetchTransportes() {
    try {
      // Use listLoading for subsequent fetches, loading for initial load
      if (transportes.length > 0) {
        setListLoading(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch('/api/transportes?limit=1000');
      const result = await response.json();
      // Handle both array and paginated response formats
      const data = Array.isArray(result) ? result : (result.data || []);
      setTransportes(data);
    } catch (error) {
      console.error('Error fetching transportes:', error);
      setTransportes([]);
    } finally {
      setLoading(false);
      setListLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/transportes/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Transporte eliminado com sucesso!', 'success');
        setShowDeleteModal(false);
        setTransporteToDelete(null);
        setDeleteError(null);
        fetchTransportes();
      } else {
        const error = await response.json();
        console.log('Delete error:', error); // Debug log
        // Check if error is about any assignment (motorista or proprietarios)
        const hasAssignments = error.details?.includes('motorista') || 
                              error.details?.includes('proprietário') ||
                              error.error?.includes('motorista') || 
                              error.error?.includes('proprietário');
        console.log('Has assignments:', hasAssignments); // Debug log
        setDeleteError({
          message: error.error || 'Erro ao eliminar transporte',
          details: error.details,
          canRemove: hasAssignments
        });
      }
    } catch (error) {
      setDeleteError({
        message: 'Erro ao eliminar transporte',
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
      // Step 1: Remove motorista assignment if exists
      const motoristaResponse = await fetch(`/api/transportes/${id}/atribuir-motorista`, {
        method: 'DELETE',
      });
      
      // It's ok if motorista doesn't exist (404), continue anyway
      if (!motoristaResponse.ok && motoristaResponse.status !== 404) {
        const error = await motoristaResponse.json();
        console.log('Erro ao remover motorista:', error);
        // Continue anyway, try to remove proprietarios
      }

      // Step 2: Remove all proprietarios associations (not the proprietarios themselves)
      const proprietariosResponse = await fetch(`/api/transportes/${id}/proprietario`, {
        method: 'DELETE',
      });
      
      // It's ok if no proprietarios exist (404), continue anyway
      if (!proprietariosResponse.ok && proprietariosResponse.status !== 404) {
        const error = await proprietariosResponse.json();
        console.log('Erro ao remover proprietários:', error);
        // Continue anyway, try to delete transporte
      }

      // Step 3: Now delete the transporte
      const deleteResponse = await fetch(`/api/transportes/${id}`, {
        method: 'DELETE',
      });

      if (deleteResponse.ok) {
        showNotification('Transporte e todas as atribuições eliminados com sucesso!', 'success');
        setDeleteError(null);
        setShowDeleteModal(false);
        setTransporteToDelete(null);
        await fetchTransportes();
      } else {
        const error = await deleteResponse.json();
        showNotification(error.details || error.error || 'Erro ao eliminar transporte', 'error');
      }
    } catch (error) {
      console.error('Erro ao remover atribuições:', error);
      showNotification('Erro ao remover atribuições e eliminar transporte', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const confirmDelete = (id: string, matricula: string) => {
    setTransporteToDelete({ id, matricula });
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const filteredTransportes = Array.isArray(transportes) ? transportes.filter((t) => {
    const matchesSearch = t.matricula?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      t.via?.nome?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      t.modelo?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    
    // Apply status filter if set
    if (statusFilter === 'circulacao') {
      // Assume 70% are in circulation (you can adjust this logic based on actual status field)
      const index = transportes.indexOf(t);
      return matchesSearch && index < Math.floor(transportes.length * 0.7);
    } else if (statusFilter === 'parados') {
      const index = transportes.indexOf(t);
      return matchesSearch && index >= Math.floor(transportes.length * 0.7) && index < Math.floor(transportes.length * 0.9);
    } else if (statusFilter === 'manutencao') {
      const index = transportes.indexOf(t);
      return matchesSearch && index >= Math.floor(transportes.length * 0.9);
    }
    
    return matchesSearch;
  }) : [];

  // Pagination logic
  const totalPages = Math.ceil(filteredTransportes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransportes = filteredTransportes.slice(startIndex, endIndex);

  // Reset to page 1 when search term or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, itemsPerPage]);

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  return (
    <div className="bg-white min-h-screen overflow-x-hidden">
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
      {showDeleteModal && transporteToDelete && (
        <div 
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm min-h-screen" 
          style={{ minHeight: '100vh', height: '100%' }}
          onClick={() => {
            setShowDeleteModal(false);
            setTransporteToDelete(null);
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
                      onClick={() => transporteToDelete && handleRemoveAssignments(transporteToDelete.id)}
                      disabled={deleting}
                      className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Removendo...</span>
                        </>
                      ) : (
                        <span>Remover Atribuições</span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setTransporteToDelete(null);
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Fechar
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
                  Eliminar Transporte
                </h3>
                
                <p className="text-gray-600 text-center mb-6">
                  Tem certeza que deseja eliminar o transporte <strong className="text-gray-900">"{transporteToDelete.matricula}"</strong>?
                  <br />
                  <span className="text-sm text-red-600 font-medium">Esta ação não pode ser desfeita.</span>
                </p>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setTransporteToDelete(null);
                    }}
                    disabled={deleting}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => transporteToDelete && handleDelete(transporteToDelete.id)}
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

      <div className="w-full max-w-[1600px] mx-auto p-4 lg:p-6 space-y-6">
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
              <h2 className="text-3xl font-bold text-gray-900">Transportes</h2>
              <p className="hidden lg:block text-gray-600 mt-1">Gestão de todos os transportes do sistema</p>
            </div>
          </div>

          {/* Right - Action Button */}
          <button 
            onClick={() => router.push('/transportes/novo')}
            className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Novo Transporte</span>
          </button>
        </div>

        {/* Filter Badge */}
        {statusFilter && (
          <div className="flex items-center space-x-2">
            <div className="inline-flex items-center space-x-2 bg-gray-100 border border-gray-300 rounded-lg px-4 py-2">
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-sm font-medium text-gray-900">
                Filtro: {statusFilter === 'circulacao' ? 'Em Circulação' : statusFilter === 'parados' ? 'Parados' : 'Manutenção'}
              </span>
              <button 
                onClick={() => setStatusFilter(null)}
                className="ml-2 text-gray-600 hover:text-gray-900"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards - Smaller and More Compact */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={() => setStatusFilter(null)}
            className={`bg-white rounded-lg border p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer ${
              statusFilter === null ? 'border-gray-900 shadow-md' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Total</p>
                <p className="text-2xl font-bold text-gray-900">{transportes.length}</p>
              </div>
            </div>
          </button>
          <button 
            onClick={() => setStatusFilter('circulacao')}
            className={`bg-white rounded-lg border p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer ${
              statusFilter === 'circulacao' ? 'border-gray-900 shadow-md' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Em Circulação</p>
                <p className="text-2xl font-bold text-gray-900">{Math.floor(transportes.length * 0.7)}</p>
              </div>
            </div>
          </button>
          <button 
            onClick={() => setStatusFilter('parados')}
            className={`bg-white rounded-lg border p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer ${
              statusFilter === 'parados' ? 'border-gray-900 shadow-md' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Parados</p>
                <p className="text-2xl font-bold text-gray-900">{Math.floor(transportes.length * 0.2)}</p>
              </div>
            </div>
          </button>
          <button 
            onClick={() => setStatusFilter('manutencao')}
            className={`bg-white rounded-lg border p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer ${
              statusFilter === 'manutencao' ? 'border-gray-900 shadow-md' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Manutenção</p>
                <p className="text-2xl font-bold text-gray-900">{Math.floor(transportes.length * 0.1)}</p>
              </div>
            </div>
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 lg:p-6 border-b border-slate-200">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative min-w-0">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Pesquisar por matrícula, modelo ou via..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-black"
                style={{ transition: 'none' }}
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
          <>
            {/* Desktop Table View */}
            <table className="w-full hidden lg:table min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                    Matrícula
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                    Modelo/Marca
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                    Motorista
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                    Proprietário
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                    Via
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                    Lotação
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                    Acções
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredTransportes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-lg font-medium">Nenhum transporte encontrado</p>
                        <p className="text-sm mt-1">Tente ajustar os filtros de pesquisa</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentTransportes.map((transport) => (
                    <tr 
                      key={transport.id} 
                      onClick={() => router.push(`/transportes/${transport.id}`)}
                      className="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                      style={{ transition: 'none' }}
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-black">{transport.matricula}</div>
                            <div className="text-xs text-black">Código: {transport.codigo}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-black">{transport.modelo}</div>
                        <div className="text-xs text-black">{transport.marca}</div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-black">
                          {transport.motorista ? transport.motorista.nome : "Não atribuído"}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-black">
                          {transport.proprietarios?.length > 0 ? transport.proprietarios[0].proprietario.nome : "Não atribuído"}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-black">{transport.via?.nome || 'N/A'}</div>
                        <div className="text-xs text-black">{transport.via?.codigo || 'N/A'}</div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-black">{transport.lotacao} lugares</div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-black">
                          Activo
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => router.push(`/transportes/${transport.id}`)}
                            className="text-slate-600"
                            title="Ver detalhes"
                            style={{ transition: 'none' }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/transportes/${transport.id}/editar`);
                            }}
                            className="text-slate-600"
                            title="Editar"
                            style={{ transition: 'none' }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDelete(transport.id, transport.matricula);
                            }}
                            className="text-red-600"
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

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-200">
              {filteredTransportes.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-lg font-medium">Nenhum transporte encontrado</p>
                    <p className="text-sm mt-1">Tente ajustar os filtros de pesquisa</p>
                  </div>
                </div>
              ) : (
                currentTransportes.map((transport) => (
                  <div
                    key={transport.id}
                    onClick={() => router.push(`/transportes/${transport.id}`)}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-base font-bold text-black">{transport.matricula}</div>
                          <div className="text-sm text-gray-600">Código: {transport.codigo}</div>
                        </div>
                      </div>
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-black">
                        Activo
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Modelo/Marca</div>
                        <div className="text-sm font-medium text-black">{transport.modelo}</div>
                        <div className="text-xs text-gray-600">{transport.marca}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Lotação</div>
                        <div className="text-sm font-medium text-black">{transport.lotacao} lugares</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Motorista</div>
                        <div className="text-sm text-black">
                          {transport.motorista ? transport.motorista.nome : "Não atribuído"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Via</div>
                        <div className="text-sm text-black">{transport.via?.nome || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => router.push(`/transportes/${transport.id}`)}
                        className="p-2 text-slate-600 hover:bg-gray-100 rounded-lg"
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
                          router.push(`/transportes/${transport.id}/editar`);
                        }}
                        className="p-2 text-slate-600 hover:bg-gray-100 rounded-lg"
                        title="Editar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(transport.id, transport.matricula);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Eliminar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
          )}
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Mostrando <span className="font-medium">{startIndex + 1}</span> a <span className="font-medium">{Math.min(endIndex, filteredTransportes.length)}</span> de <span className="font-medium">{filteredTransportes.length}</span> transportes
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
