"use client";
import LoadingScreen from "../components/LoadingScreen";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "../hooks/useDebounce";

interface Proprietario {
  id: string;
  nome: string;
  bi: string;
  nacionalidade: string;
  endereco: string;
  contacto1: number;
  contacto2?: number;
  tipoProprietario?: string;
  transportes: Array<{
    transporte: {
      id: string;
      matricula: string;
    };
  }>;
  createdAt: string;
}

export default function Proprietarios() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [proprietarios, setProprietarios] = useState<Proprietario[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [proprietarioToDelete, setProprietarioToDelete] = useState<{id: string, nome: string} | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{message: string, details?: string, canRemove?: boolean} | null>(null);

  useEffect(() => {
    fetchProprietarios();
  }, [debouncedSearchTerm]);

  async function fetchProprietarios() {
    try {
      // Use listLoading for subsequent fetches, loading for initial load
      if (proprietarios.length > 0) {
        setListLoading(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch('/api/proprietarios?limit=1000');
      const result = await response.json();
      // Handle both array and paginated response formats
      const data = Array.isArray(result) ? result : (result.data || []);
      setProprietarios(data);
    } catch (error) {
      console.error('Erro ao carregar proprietários:', error);
      setProprietarios([]);
    } finally {
      setLoading(false);
      setListLoading(false);
    }
  }

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const confirmDelete = (id: string, nome: string) => {
    setProprietarioToDelete({ id, nome });
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  async function handleDelete(id: string) {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/proprietarios/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Proprietário eliminado com sucesso!', 'success');
        setShowDeleteModal(false);
        setProprietarioToDelete(null);
        setDeleteError(null);
        fetchProprietarios();
      } else {
        const error = await response.json();
        // Check if error is about transportes associations
        const hasTransportes = error.details?.includes('transportes') || error.error?.includes('transportes');
        setDeleteError({
          message: error.error || 'Erro ao eliminar proprietário',
          details: error.details || 'Este proprietário pode ter transportes associados.',
          canRemove: hasTransportes
        });
      }
    } catch (error) {
      setDeleteError({
        message: 'Erro ao eliminar proprietário',
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
      // Step 1: Remove all TransporteProprietario associations (not the proprietario itself)
      const response = await fetch(`/api/proprietarios/${id}/transportes`, {
        method: 'DELETE',
      });
      
      // It's ok if no associations exist (404), continue anyway
      if (!response.ok && response.status !== 404) {
        const error = await response.json();
        console.log('Erro ao remover associações:', error);
        // Continue anyway, try to delete proprietario
      }

      // Step 2: Now delete the proprietario
      const deleteResponse = await fetch(`/api/proprietarios/${id}`, {
        method: 'DELETE',
      });

      if (deleteResponse.ok) {
        showNotification('Proprietário e todas as associações eliminados com sucesso!', 'success');
        setDeleteError(null);
        setShowDeleteModal(false);
        setProprietarioToDelete(null);
        await fetchProprietarios();
      } else {
        const error = await deleteResponse.json();
        showNotification(error.details || error.error || 'Erro ao eliminar proprietário', 'error');
      }
    } catch (error) {
      console.error('Erro ao remover associações:', error);
      showNotification('Erro ao remover associações e eliminar proprietário', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const filteredProprietarios = Array.isArray(proprietarios) ? proprietarios.filter((p) =>
    p.nome?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    p.bi?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    p.nacionalidade?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  ) : [];

  const totalTransportes = proprietarios.reduce((sum, p) => sum + (p.transportes?.length || 0), 0);
  const empresas = proprietarios.filter(p => p.tipoProprietario?.toLowerCase() === 'empresa').length;
  const individuos = proprietarios.length - empresas;

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
      {showDeleteModal && proprietarioToDelete && (
        <div 
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm min-h-screen" 
          style={{ minHeight: '100vh', height: '100%' }}
          onClick={() => {
            setShowDeleteModal(false);
            setProprietarioToDelete(null);
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
                      onClick={() => proprietarioToDelete && handleRemoveAssignments(proprietarioToDelete.id)}
                      disabled={deleting}
                      className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Removendo...</span>
                        </>
                      ) : (
                        <span>Remover Associações e Eliminar</span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setProprietarioToDelete(null);
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteError.canRemove ? 'Cancelar' : 'Fechar'}
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
                  Eliminar Proprietário
                </h3>
                
                <p className="text-gray-600 text-center mb-6">
                  Tem certeza que deseja eliminar o proprietário <strong className="text-gray-900">"{proprietarioToDelete.nome}"</strong>?
                  <br />
                  <span className="text-sm text-red-600 font-medium">Esta ação não pode ser desfeita.</span>
                </p>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setProprietarioToDelete(null);
                    }}
                    disabled={deleting}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => proprietarioToDelete && handleDelete(proprietarioToDelete.id)}
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
              <h2 className="text-3xl font-bold text-gray-900">Proprietários</h2>
              <p className="hidden lg:block text-gray-600 mt-1">Gestão de todos os proprietários do sistema</p>
            </div>
          </div>

          {/* Right - Action Button */}
          <button 
            onClick={() => router.push('/proprietarios/novo')}
            className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Novo Proprietário</span>
          </button>
        </div>

        {/* Stats Cards - Smaller and More Compact */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={() => router.push('/proprietarios')}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Total</p>
                <p className="text-2xl font-bold text-gray-900">{proprietarios.length}</p>
              </div>
            </div>
          </button>
          <button 
            onClick={() => router.push('/proprietarios')}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Empresas</p>
                <p className="text-2xl font-bold text-gray-900">{empresas}</p>
              </div>
            </div>
          </button>
          <button 
            onClick={() => router.push('/proprietarios')}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Indivíduos</p>
                <p className="text-2xl font-bold text-gray-900">{individuos}</p>
              </div>
            </div>
          </button>
          <button 
            onClick={() => router.push('/transportes')}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Transportes</p>
                <p className="text-2xl font-bold text-gray-900">{totalTransportes}</p>
              </div>
            </div>
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Pesquisar por nome, BI ou nacionalidade..."
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
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    BI/NUIT
                  </th>
                  <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Nacionalidade
                  </th>
                  <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Transportes
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Acções
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredProprietarios.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-12 h-12 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-black font-medium">Nenhum proprietário encontrado</p>
                        <p className="text-sm text-black mt-1">Tente ajustar os filtros de pesquisa</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProprietarios.map((prop) => (
                    <tr 
                      key={prop.id} 
                      onClick={() => router.push(`/proprietarios/${prop.id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      style={{ transition: 'none' }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mr-3">
                            {prop.tipoProprietario?.toLowerCase() === 'empresa' ? (
                              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-black">{prop.nome}</div>
                            <div className="text-xs text-black">{prop.endereco}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-black">
                          {prop.tipoProprietario || 'N/A'}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-black font-mono">{prop.bi}</div>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-black">+258 {prop.contacto1}</div>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-black">{prop.nacionalidade}</div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-black">{prop.transportes?.length || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/proprietarios/${prop.id}`);
                            }}
                            className="text-gray-600 hover:text-gray-900"
                            style={{ transition: 'none' }}
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
                              router.push(`/proprietarios/${prop.id}/editar`);
                            }}
                            className="hidden lg:inline-block text-gray-600 hover:text-gray-900"
                            style={{ transition: 'none' }}
                            title="Editar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDelete(prop.id, prop.nome);
                            }}
                            className="hidden lg:inline-block text-gray-600 hover:text-gray-900"
                            style={{ transition: 'none' }}
                            title="Eliminar"
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
        </div>
      </div>
    </div>
  );
}
