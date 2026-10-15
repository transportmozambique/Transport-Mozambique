"use client";
import LoadingScreen from "../../components/LoadingScreen";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Administrador {
  id: string;
  nome: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    provincias: number;
    municipios: number;
    vias: number;
    paragens: number;
  };
}

export default function AdministradorDetalhes() {
  const router = useRouter();
  const params = useParams();
  const [administrador, setAdministrador] = useState<Administrador | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchAdministrador(params.id as string);
    }
  }, [params.id]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  async function fetchAdministrador(id: string) {
    try {
      const response = await fetch(`/api/administradores/${id}`, {
        cache: 'no-store',
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Administrador não encontrado');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar administrador');
      }
      
      const data = await response.json();
      setAdministrador(data);
    } catch (error: any) {
      console.error('Erro ao carregar administrador:', error);
      showNotification(error.message || 'Erro ao carregar administrador', 'error');
      // If it's not a 404, we might still want to show the error message in the UI
      if (error.message !== 'Administrador não encontrado') {
        setAdministrador(null); // Ensure UI shows error state
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    
    try {
      const response = await fetch(`/api/administradores/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Administrador eliminado com sucesso!', 'success');
        setTimeout(() => router.push('/administradores'), 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao eliminar administrador', 'error');
        setShowDeleteModal(false);
      }
    } catch (error) {
      showNotification('Erro ao eliminar administrador', 'error');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  if (!administrador) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-[1600px] mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-gray-900 text-lg">Administrador não encontrado</p>
            <button 
              onClick={() => router.push('/administradores')} 
              className="mt-4 px-6 py-3 bg-gray-900 text-white rounded-lg font-medium"
            >
              Voltar para lista
            </button>
          </div>
        </div>
      </div>
    );
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
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Eliminar Administrador
              </h3>
              
              <p className="text-gray-600 text-center mb-6">
                Tem certeza que deseja eliminar o administrador <strong className="text-gray-900">"{administrador?.nome}"</strong>?
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
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/administradores')}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{administrador.nome}</h2>
              <p className="text-gray-600 mt-1">Detalhes do administrador</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/administradores/${params.id}/editar`)}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 bg-gray-900 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">{administrador.nome}</h3>
                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 mb-4">
                  Administrador
                </span>
                <div className="w-full space-y-2 text-sm mt-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Províncias</span>
                    <span className="text-gray-900 font-bold">{administrador._count.provincias}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Municípios</span>
                    <span className="text-gray-900 font-bold">{administrador._count.municipios}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Vias</span>
                    <span className="text-gray-900 font-bold">{administrador._count.vias}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">Paragens</span>
                    <span className="text-gray-900 font-bold">{administrador._count.paragens}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">Informações Pessoais</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Nome Completo</label>
                  <p className="text-gray-600">{administrador.nome}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Email</label>
                  <p className="text-gray-600">{administrador.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Registado em</label>
                  <p className="text-gray-600">
                    {new Date(administrador.createdAt).toLocaleDateString('pt-PT', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Última Atualização</label>
                  <p className="text-gray-600">
                    {new Date(administrador.updatedAt).toLocaleDateString('pt-PT', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Activity Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">Resumo de Atividade</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-1">{administrador._count.provincias}</div>
                  <div className="text-sm text-gray-600">Províncias</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-1">{administrador._count.municipios}</div>
                  <div className="text-sm text-gray-600">Municípios</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-1">{administrador._count.vias}</div>
                  <div className="text-sm text-gray-600">Vias</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-1">{administrador._count.paragens}</div>
                  <div className="text-sm text-gray-600">Paragens</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
