"use client";

import LoadingScreen from "../components/LoadingScreen";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "../hooks/useDebounce";

interface Provincia {
  id: string;
  nome: string;
  codigo: string;
  municipios?: number;
  vias?: number;
  transportes?: number;
}

export default function Provincias() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [provincias, setProvincias] = useState<Provincia[]>([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [provinciaToDelete, setProvinciaToDelete] = useState<{id: string, nome: string} | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{message: string, details?: string, canRemove?: boolean} | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Fetch províncias from API
  useEffect(() => {
    const fetchProvincias = async () => {
      setListLoading(true);
      try {
        const response = await fetch('/api/provincias?limit=1000');
        if (response.ok) {
          const result = await response.json();
          setProvincias(result.data || []);
        } else {
          showNotification('Erro ao carregar províncias', 'error');
        }
      } catch (error) {
        showNotification('Erro ao carregar províncias', 'error');
      } finally {
        setListLoading(false);
      }
    };

    fetchProvincias();
  }, []);

  const filteredProvincias = provincias.filter((p) =>
    p.nome?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredProvincias.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProvincias = filteredProvincias.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, itemsPerPage]);

  const confirmDelete = (id: string, nome: string) => {
    setProvinciaToDelete({ id, nome });
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/provincias/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Província eliminada com sucesso!', 'success');
        setShowDeleteModal(false);
        setProvinciaToDelete(null);
        setDeleteError(null);
        setProvincias(prev => prev.filter(p => p.id !== id));
      } else {
        const error = await response.json();
        const hasDependencies = error.details?.includes('municípios') || 
                               error.error?.includes('municípios');
        setDeleteError({
          message: error.error || 'Erro ao eliminar província',
          details: error.details || 'Esta província pode ter municípios associados.',
          canRemove: hasDependencies
        });
      }
    } catch (error) {
      setDeleteError({
        message: 'Erro ao eliminar província',
        details: 'Ocorreu um erro inesperado. Tente novamente.',
        canRemove: false
      });
    } finally {
      setDeleting(false);
    }
  };

  async function handleRemoveAssignments(id: string) {
    setDeleting(true);
    try {
      // Fetch all data at once
      const [municipiosRes, viasRes, transportesRes] = await Promise.all([
        fetch('/api/municipios?limit=1000'),
        fetch('/api/vias?limit=1000'),
        fetch('/api/transportes?limit=1000')
      ]);

      if (!municipiosRes.ok || !viasRes.ok || !transportesRes.ok) {
        throw new Error('Erro ao buscar dados');
      }

      const municipiosData = await municipiosRes.json();
      const viasData = await viasRes.json();
      const transportesData = await transportesRes.json();

      const allMunicipios = Array.isArray(municipiosData) ? municipiosData : (municipiosData.data || []);
      const allVias = Array.isArray(viasData) ? viasData : (viasData.data || []);
      const allTransportes = Array.isArray(transportesData) ? transportesData : (transportesData.data || []);

      // Filter by provincia
      const municipiosToUpdate = allMunicipios.filter((m: any) => m.provinciaId === id);
      const municipioIds = municipiosToUpdate.map((m: any) => m.id);
      
      // Filter vias by municipios
      const viasToUpdate = allVias.filter((v: any) => municipioIds.includes(v.municipioId));
      const viaIds = viasToUpdate.map((v: any) => v.id);
      
      // Filter transportes by vias
      const transportesToUpdate = allTransportes.filter((t: any) => viaIds.includes(t.viaId));

      // Remove associations (don't delete entities)
      
      // 1. Remove transporte associations (motorista, proprietarios, via)
      for (const transporte of transportesToUpdate) {
        try {
          // Remove motorista (set to null)
          await fetch(`/api/transportes/${transporte.id}/atribuir-motorista`, {
            method: 'DELETE',
          }).catch(() => {});
          
          // Remove proprietarios associations
          await fetch(`/api/transportes/${transporte.id}/proprietario`, {
            method: 'DELETE',
          }).catch(() => {});
          
          // Remove via association (set viaId to null)
          await fetch(`/api/transportes/${transporte.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ viaId: null })
          }).catch(() => {});
        } catch (error) {
          console.error(`Erro ao remover associações do transporte ${transporte.id}:`, error);
        }
      }

      // 2. Remove via associations (set municipioId to null)
      for (const via of viasToUpdate) {
        try {
          await fetch(`/api/vias/${via.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ municipioId: null })
          });
        } catch (error) {
          console.error(`Erro ao remover associação da via ${via.id}:`, error);
        }
      }

      // 3. Remove municipio associations (set provinciaId to null)
      for (const municipio of municipiosToUpdate) {
        try {
          await fetch(`/api/municipios/${municipio.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provinciaId: null })
          });
        } catch (error) {
          console.error(`Erro ao remover associação do município ${municipio.id}:`, error);
        }
      }

      // 4. Delete provincia
      const deleteResponse = await fetch(`/api/provincias/${id}`, {
        method: 'DELETE',
      });

      if (deleteResponse.ok) {
        showNotification('Província e todas as associações removidas com sucesso!', 'success');
        setDeleteError(null);
        setShowDeleteModal(false);
        setProvinciaToDelete(null);
        setProvincias(prev => prev.filter(p => p.id !== id));
      } else {
        const error = await deleteResponse.json();
        showNotification(error.details || error.error || 'Erro ao eliminar província', 'error');
      }
    } catch (error) {
      console.error('Erro ao remover associações:', error);
      showNotification('Erro ao remover associações e eliminar província', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const handleView = (id: string, nome: string) => {
    router.push(`/provincias/${id}`);
  };

  const handleEdit = (id: string, nome: string) => {
    router.push(`/provincias/${id}/editar`);
  };

  const handleCreate = () => {
    router.push('/provincias/novo');
  };

  const totalMunicipios = provincias.reduce((sum, p) => sum + (p.municipios || 0), 0);
  const totalVias = provincias.reduce((sum, p) => sum + (p.vias || 0), 0);
  const totalTransportes = provincias.reduce((sum, p) => sum + (p.transportes || 0), 0);

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
      {showDeleteModal && provinciaToDelete && (
        <div 
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm min-h-screen" 
          style={{ minHeight: '100vh', height: '100%' }}
          onClick={() => {
            setShowDeleteModal(false);
            setProvinciaToDelete(null);
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
                      onClick={() => provinciaToDelete && handleRemoveAssignments(provinciaToDelete.id)}
                      disabled={deleting}
                      className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Removendo e Eliminando...</span>
                        </>
                      ) : (
                        <span>Remover Municípios e Eliminar</span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setProvinciaToDelete(null);
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
                  Eliminar Província
                </h3>
                
                <p className="text-gray-600 text-center mb-6">
                  Tem certeza que deseja eliminar a província <strong className="text-gray-900">"{provinciaToDelete.nome}"</strong>?
                  <br />
                  <span className="text-sm text-red-600 font-medium">Esta ação não pode ser desfeita.</span>
                </p>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setProvinciaToDelete(null);
                    }}
                    disabled={deleting}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => provinciaToDelete && handleDelete(provinciaToDelete.id)}
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
              <h2 className="text-3xl font-bold text-gray-900">Províncias</h2>
              <p className="hidden lg:block text-gray-600 mt-1">Gestão de todas as províncias do sistema</p>
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
            <span>Nova Província</span>
          </button>
        </div>

        {/* Stats Cards - Smaller and More Compact */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={() => router.push('/provincias')}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Províncias</p>
                <p className="text-2xl font-bold text-gray-900">{provincias.length}</p>
              </div>
            </div>
          </button>
          <button 
            onClick={() => router.push('/municipios')}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Municípios</p>
                <p className="text-2xl font-bold text-gray-900">{totalMunicipios}</p>
              </div>
            </div>
          </button>
          <button 
            onClick={() => router.push('/vias')}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-900 hover:shadow-md transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Vias</p>
                <p className="text-2xl font-bold text-gray-900">{totalVias}</p>
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
                <p className="text-xs text-gray-600 font-medium">Total Transportes</p>
                <p className="text-2xl font-bold text-gray-900">{totalTransportes}</p>
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
              <LoadingScreen size="compact" />
            ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Municípios
                  </th>
                  <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Vias
                  </th>
                  <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Transportes
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Acções
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedProvincias.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-lg font-medium">Nenhuma província encontrada</p>
                        <p className="text-sm mt-1">Tente ajustar os filtros de pesquisa</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedProvincias.map((provincia) => (
                    <tr 
                      key={provincia.id} 
                      onClick={() => handleView(provincia.id, provincia.nome)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="text-sm font-bold text-gray-900">{provincia.codigo}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{provincia.nome}</div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{provincia.municipios || 0}</div>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{provincia.vias || 0}</div>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{provincia.transportes || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-3">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleView(provincia.id, provincia.nome);
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
                              handleEdit(provincia.id, provincia.nome);
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
                              confirmDelete(provincia.id, provincia.nome);
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
                  ))
                )}
              </tbody>
            </table>
            )}
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Mostrando <span className="font-medium">{startIndex + 1}</span> a <span className="font-medium">{Math.min(endIndex, filteredProvincias.length)}</span> de <span className="font-medium">{filteredProvincias.length}</span> províncias
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Itens por página:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-900"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
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
                            : 'border border-gray-300 text-gray-900 hover:bg-gray-100'
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
                  className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-900"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
