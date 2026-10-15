"use client";
import LoadingScreen from "../../components/LoadingScreen";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useDebounce } from "@/app/hooks/useDebounce";

interface TransporteItem {
  id: string;
  matricula: string;
  modelo: string;
  marca: string;
  codigo: number;
  via?: {
    nome: string;
    codigo: string;
  };
}

interface Transporte {
  transporte: TransporteItem;
}

interface Proprietario {
  id: string;
  nome: string;
  bi: string;
  nacionalidade: string;
  birthDate: string;
  endereco: string;
  contacto1: number;
  contacto2?: number;
  tipoProprietario?: string;
  foto?: string;
  certificado?: string;
  transportes: Transporte[];
  createdAt: string;
}

export default function ProprietarioDetalhes() {
  const router = useRouter();
  const params = useParams();
  const [proprietario, setProprietario] = useState<Proprietario | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  
  // Transportes pagination and search
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filteredTransportes, setFilteredTransportes] = useState<Transporte[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  
  // Modal para associar transportes
  const [showAssociarModal, setShowAssociarModal] = useState(false);
  const [availableTransportes, setAvailableTransportes] = useState<TransporteItem[]>([]);
  const [selectedTransportesIds, setSelectedTransportesIds] = useState<string[]>([]);
  const [associating, setAssociating] = useState(false);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  
  // Modal para eliminar
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hasAssociations, setHasAssociations] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchProprietario(params.id as string);
    }
  }, [params.id]);

  useEffect(() => {
    if (proprietario) {
      filterAndPaginateTransportes();
    }
  }, [proprietario, debouncedSearchTerm, currentPage, itemsPerPage]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  async function fetchProprietario(id: string) {
    try {
      const response = await fetch(`/api/proprietarios/${id}`);
      const data = await response.json();
      setProprietario(data);
    } catch (error) {
      console.error('Erro ao carregar proprietário:', error);
      showNotification('Erro ao carregar proprietário', 'error');
    } finally {
      setLoading(false);
    }
  }

  function filterAndPaginateTransportes() {
    if (!proprietario) return;

    let filtered = proprietario.transportes || [];

    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(tp =>
        tp.transporte.matricula.toLowerCase().includes(searchLower) ||
        tp.transporte.modelo.toLowerCase().includes(searchLower) ||
        tp.transporte.marca.toLowerCase().includes(searchLower) ||
        tp.transporte.codigo.toString().includes(searchLower)
      );
    }

    // Calculate pagination
    const total = Math.ceil(filtered.length / itemsPerPage);
    setTotalPages(total);

    // Apply pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filtered.slice(startIndex, endIndex);

    setFilteredTransportes(paginated);
  }

  async function fetchAvailableTransportes() {
    setLoadingAvailable(true);
    try {
      const response = await fetch('/api/transportes?limit=1000');
      const result = await response.json();
      const allTransportes = result.data || [];

      // Filter: transportes sem proprietário
      const available = allTransportes.filter((t: any) => 
        !t.proprietarios || t.proprietarios.length === 0
      );

      setAvailableTransportes(available);
    } catch (error) {
      console.error('Erro ao carregar transportes:', error);
      showNotification('Erro ao carregar transportes disponíveis', 'error');
    } finally {
      setLoadingAvailable(false);
    }
  }

  async function handleAssociarTransportes() {
    if (selectedTransportesIds.length === 0 || !proprietario) return;

    setAssociating(true);
    try {
      // Associar todos os transportes selecionados
      const promises = selectedTransportesIds.map(transporteId =>
        fetch(`/api/transportes/${transporteId}/proprietario`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proprietarioId: proprietario.id }),
        })
      );

      const results = await Promise.all(promises);
      const allSuccessful = results.every(r => r.ok);

      if (allSuccessful) {
        showNotification(
          `${selectedTransportesIds.length} transporte(s) associado(s) com sucesso!`,
          'success'
        );
        setShowAssociarModal(false);
        setSelectedTransportesIds([]);
        fetchProprietario(params.id as string); // Refresh data
      } else {
        showNotification('Erro ao associar alguns transportes', 'error');
      }
    } catch (error) {
      console.error('Erro ao associar transportes:', error);
      showNotification('Erro ao associar transportes', 'error');
    } finally {
      setAssociating(false);
    }
  }

  async function handleDesassociarTransporte(transporteId: string) {
    try {
      const response = await fetch(`/api/transportes/${transporteId}/proprietario`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Transporte desassociado com sucesso!', 'success');
        fetchProprietario(params.id as string); // Refresh data
      } else {
        showNotification('Erro ao desassociar transporte', 'error');
      }
    } catch (error) {
      console.error('Erro ao desassociar transporte:', error);
      showNotification('Erro ao desassociar transporte', 'error');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    setHasAssociations(false);
    
    try {
      const response = await fetch(`/api/proprietarios/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Proprietário eliminado com sucesso!', 'success');
        setTimeout(() => router.push('/proprietarios'), 1500);
      } else {
        const error = await response.json();
        
        // Check if error is about transportes associations
        if (error.error && error.error.includes('transportes')) {
          setDeleteError(error.details || error.error);
          setHasAssociations(true);
        } else {
          showNotification(error.error || 'Erro ao eliminar proprietário', 'error');
          setShowDeleteModal(false);
        }
      }
    } catch (error) {
      showNotification('Erro ao eliminar proprietário', 'error');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemoveAssociationsAndDelete() {
    setDeleting(true);
    
    try {
      // Force delete with associations removal
      const response = await fetch(`/api/proprietarios/${params.id}?force=true`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Proprietário eliminado com sucesso!', 'success');
        setTimeout(() => router.push('/proprietarios'), 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao eliminar proprietário', 'error');
      }
    } catch (error) {
      showNotification('Erro ao eliminar proprietário', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  if (!proprietario) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-[1600px] mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-gray-900 text-lg">Proprietário não encontrado</p>
            <button 
              onClick={() => router.push('/proprietarios')} 
              className="mt-4 px-6 py-3 bg-gray-900 text-white rounded-lg font-medium"
            >
              Voltar para lista
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isEmpresa = proprietario.tipoProprietario?.toLowerCase() === 'empresa';
  const totalTransportes = proprietario.transportes?.length || 0;

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
      {showDeleteModal && (
        <div 
          className="fixed inset-0 z-50 backdrop-blur-sm min-h-screen" 
          style={{ minHeight: '100vh', height: '100%' }}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div className="flex items-center justify-center min-h-screen p-4">
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-gray-200 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4 ${
                hasAssociations ? 'bg-gradient-to-br from-red-50 to-red-100/30' : 'bg-red-100'
              }`}>
                <svg className={`w-6 h-6 ${hasAssociations ? 'text-red-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {hasAssociations ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  )}
                </svg>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                {hasAssociations ? 'Remover Associações' : 'Eliminar Proprietário'}
              </h3>
              
              {hasAssociations ? (
                <div className="space-y-4">
                  <p className="text-gray-600 text-center">
                    {deleteError}
                  </p>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-red-600 text-center font-medium">
                      Clique em <strong>"Remover e Eliminar"</strong> para remover as associações e eliminar o proprietário.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                        setDeleteError(null);
                        setHasAssociations(false);
                      }}
                      disabled={deleting}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleRemoveAssociationsAndDelete}
                      disabled={deleting}
                      className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Remover e Eliminar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-600 text-center mb-6">
                    Tem certeza que deseja eliminar o proprietário <strong className="text-gray-900">"{proprietario?.nome}"</strong>?
                    <br />
                    <span className="text-sm text-red-600 font-medium">Esta ação não pode ser desfeita.</span>
                  </p>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      disabled={deleting}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDelete}
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

      {/* Modal Associar Transportes */}
      {showAssociarModal && (
        <div 
          className="fixed inset-0 z-50 backdrop-blur-sm min-h-screen" 
          style={{ minHeight: '100vh', height: '100%' }}
          onClick={() => {
            setShowAssociarModal(false);
            setSelectedTransportesIds([]);
          }}
        >
          <div className="flex items-center justify-center min-h-screen p-4">
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-scale-in border border-gray-200 max-h-[80vh] flex flex-col my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Associar Transportes</h3>
                <button
                  onClick={() => {
                    setShowAssociarModal(false);
                    setSelectedTransportesIds([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-2">
                Selecione um ou mais transportes disponíveis (sem proprietário)
              </p>
              
              {selectedTransportesIds.length > 0 && (
                <p className="text-sm font-medium text-gray-900 mb-4">
                  {selectedTransportesIds.length} transporte(s) selecionado(s)
                </p>
              )}

              <div className="flex-1 overflow-y-auto mb-4">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : availableTransportes.length > 0 ? (
                  <div className="space-y-2">
                    {availableTransportes.map((transporte) => {
                      const isSelected = selectedTransportesIds.includes(transporte.id);
                      return (
                        <div
                          key={transporte.id}
                          onClick={() => {
                            setSelectedTransportesIds(prev =>
                              prev.includes(transporte.id)
                                ? prev.filter(id => id !== transporte.id)
                                : [...prev, transporte.id]
                            );
                          }}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? 'border-gray-900 bg-gray-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-5 h-5 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                              />
                              <div>
                                <p className="font-bold text-gray-900">{transporte.matricula}</p>
                                <p className="text-sm text-gray-600">
                                  {transporte.modelo} - {transporte.marca}
                                </p>
                              </div>
                            </div>
                            <span className="px-2 py-1 bg-gray-100 text-gray-900 rounded text-xs font-mono">
                              #{transporte.codigo}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-600">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <p className="font-medium">Nenhum transporte disponível</p>
                    <p className="text-sm mt-1">Todos os transportes já têm proprietário</p>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowAssociarModal(false);
                    setSelectedTransportesIds([]);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAssociarTransportes}
                  disabled={selectedTransportesIds.length === 0 || associating}
                  className="flex-1 px-4 py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {associating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Associando...</span>
                    </>
                  ) : (
                    <span>Associar {selectedTransportesIds.length > 0 ? `(${selectedTransportesIds.length})` : ''}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/proprietarios')}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{proprietario.nome}</h2>
              <p className="text-gray-600 mt-1">Detalhes do proprietário</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/proprietarios/${params.id}/editar`)}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Editar</span>
            </button>
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Foto e Info Rápida - Coluna Esquerda (1/4) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Foto */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex flex-col items-center">
                <div className="w-40 h-40 bg-gray-100 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                  {proprietario.foto ? (
                    <img src={proprietario.foto} alt={proprietario.nome} className="w-full h-full object-cover" />
                  ) : isEmpresa ? (
                    <svg className="w-20 h-20 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  ) : (
                    <svg className="w-20 h-20 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">{proprietario.nome}</h3>
                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-900 mb-4">
                  {proprietario.tipoProprietario || 'Empresa'}
                </span>
                <div className="w-full space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-900 font-medium">Transportes</span>
                    <span className="text-gray-900 font-bold">{totalTransportes}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-900 font-medium">Nacionalidade</span>
                    <span className="text-gray-600">{proprietario.nacionalidade || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">Status</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-gray-900 font-semibold mb-1">Tipo</label>
                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-900">
                    {proprietario.tipoProprietario || 'Empresa'}
                  </span>
                </div>
                <div>
                  <label className="block text-gray-900 font-semibold mb-1">Registado em</label>
                  <p className="text-gray-600">
                    {proprietario.createdAt ? new Date(proprietario.createdAt).toLocaleDateString('pt-PT') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Informações Detalhadas - Colunas Direita (3/4) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Informações Pessoais */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">Informações Pessoais</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Nome Completo</label>
                  <p className="text-gray-600">{proprietario.nome || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Data de Nascimento/Fundação</label>
                  <p className="text-gray-600">
                    {proprietario.birthDate ? new Date(proprietario.birthDate).toLocaleDateString('pt-PT') : 'N/A'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Nacionalidade</label>
                  <p className="text-gray-600">{proprietario.nacionalidade || 'N/A'}</p>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Endereço</label>
                  <p className="text-gray-600">{proprietario.endereco || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Documentos */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">Documentos</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">NUIT</label>
                  <p className="text-gray-600">{proprietario.bi || 'N/A'}</p>
                </div>

                {proprietario.certificado && proprietario.certificado !== 'http://example.com' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Certificado de Autenticidade</label>
                    <button
                      onClick={() => {
                        // Check if it's a base64 string
                        if (proprietario.certificado?.startsWith('data:application/pdf;base64,')) {
                          // Convert base64 to blob and open in new tab
                          const base64Data = proprietario.certificado.split(',')[1];
                          const byteCharacters = atob(base64Data);
                          const byteNumbers = new Array(byteCharacters.length);
                          for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                          }
                          const byteArray = new Uint8Array(byteNumbers);
                          const blob = new Blob([byteArray], { type: 'application/pdf' });
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank');
                          // Clean up after a delay
                          setTimeout(() => URL.revokeObjectURL(url), 100);
                        } else {
                          // If it's a regular URL, open it
                          window.open(proprietario.certificado, '_blank');
                        }
                      }}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span>Ver Certificado (PDF)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Contacto */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">Contacto</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Telefone</label>
                  <p className="text-gray-600">{proprietario.contacto1 ? `+258 ${proprietario.contacto1}` : 'N/A'}</p>
                </div>

                {proprietario.contacto2 && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Telefone Secundário</label>
                    <p className="text-gray-600">+258 {proprietario.contacto2}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Transportes Atribuídos com Paginação */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">
                  Transportes Atribuídos ({totalTransportes})
                </h3>
                <button
                  onClick={() => {
                    setShowAssociarModal(true);
                    fetchAvailableTransportes();
                  }}
                  className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg font-medium flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Associar Transporte</span>
                </button>
              </div>

              {/* Search and Items Per Page */}
              {totalTransportes > 0 && (
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Pesquisar por matrícula, modelo, marca ou código..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600 whitespace-nowrap">Mostrar:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              )}
              
              {filteredTransportes.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {filteredTransportes.map((tp) => (
                      <div key={tp.transporte.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <h4 className="font-bold text-gray-900">{tp.transporte.matricula}</h4>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-900 rounded text-xs font-mono">
                                  #{tp.transporte.codigo}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{tp.transporte.modelo} - {tp.transporte.marca}</p>
                              {tp.transporte.via && (
                                <p className="text-xs text-gray-500">Via: {tp.transporte.via.nome} ({tp.transporte.via.codigo})</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => router.push(`/transportes/${tp.transporte.id}`)}
                              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium"
                            >
                              Ver
                            </button>
                            <button
                              onClick={() => handleDesassociarTransporte(tp.transporte.id)}
                              className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg"
                              title="Desassociar transporte"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        Página {currentPage} de {totalPages}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Anterior
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : totalTransportes > 0 ? (
                <div className="text-center py-6 text-gray-600 border border-gray-200 rounded-lg bg-gray-50">
                  <p className="text-sm font-medium">Nenhum transporte encontrado com "{searchTerm}"</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600 border border-gray-200 rounded-lg bg-gray-50">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <p className="font-medium">Nenhum transporte atribuído</p>
                  <p className="text-sm mt-1">Clique em "Associar Transporte" para adicionar</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
