"use client";
import LoadingScreen from "../../components/LoadingScreen";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Missao {
  id: string;
  mISSIONUtente: string;
  codigoParagem: string;
  geoLocationUtente: string;
  geoLocationParagem: string;
  createdAt: string;
  paragem: {
    id: string;
    nome: string;
    codigo: string;
    geoLocation: string;
  };
}

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
  missoes: Missao[];
  _count: {
    missoes: number;
  };
}

export default function UtenteDetalhes() {
  const router = useRouter();
  const params = useParams();
  const [utente, setUtente] = useState<Utente | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hasAssociations, setHasAssociations] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchUtente(params.id as string);
    }
  }, [params.id]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  async function fetchUtente(id: string) {
    try {
      const response = await fetch(`/api/utentes/${id}`);
      const data = await response.json();
      setUtente(data);
    } catch (error) {
      console.error('Erro ao carregar utente:', error);
      showNotification('Erro ao carregar utente', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    setHasAssociations(false);
    
    try {
      const response = await fetch(`/api/utentes/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Utente eliminado com sucesso!', 'success');
        setTimeout(() => router.push('/utentes'), 1500);
      } else {
        const error = await response.json();
        
        // Check if error is about missoes associations
        if (error.error && error.error.includes('missões')) {
          setDeleteError(error.details || error.error);
          setHasAssociations(true);
        } else {
          showNotification(error.error || 'Erro ao eliminar utente', 'error');
          setShowDeleteModal(false);
        }
      }
    } catch (error) {
      showNotification('Erro ao eliminar utente', 'error');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemoveAssociationsAndDelete() {
    setDeleting(true);
    
    try {
      const response = await fetch(`/api/utentes/${params.id}?force=true`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Utente eliminado com sucesso!', 'success');
        setTimeout(() => router.push('/utentes'), 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao eliminar utente', 'error');
      }
    } catch (error) {
      showNotification('Erro ao eliminar utente', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  if (!utente) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-[1600px] mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-gray-900 text-lg">Utente não encontrado</p>
            <button 
              onClick={() => router.push('/utentes')} 
              className="mt-4 px-6 py-3 bg-gray-900 text-white rounded-lg font-medium"
            >
              Voltar para lista
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalMissoes = utente._count?.missoes || 0;

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
                {hasAssociations ? 'Remover Associações' : 'Eliminar Utente'}
              </h3>
              
              {hasAssociations ? (
                <div className="space-y-4">
                  <p className="text-gray-600 text-center">
                    {deleteError}
                  </p>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-red-600 text-center font-medium">
                      Clique em <strong>"Remover e Eliminar"</strong> para remover as associações e eliminar o utente.
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
                    Tem certeza que deseja eliminar o utente <strong className="text-gray-900">"{utente?.nome}"</strong>?
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

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/utentes')}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{utente.nome}</h2>
              <p className="text-gray-600 mt-1">Detalhes do utente</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/utentes/${params.id}/editar`)}
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
          {/* Profile Card - Left Column (1/4) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Avatar */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex flex-col items-center">
                <div className="w-40 h-40 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-20 h-20 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">{utente.nome}</h3>
                {utente.subscrito ? (
                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 mb-4">
                    Subscrito
                  </span>
                ) : (
                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-900 mb-4">
                    Não Subscrito
                  </span>
                )}
                <div className="w-full space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-900 font-medium">Missões</span>
                    <span className="text-gray-900 font-bold">{totalMissoes}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-900 font-medium">MISSION ID</span>
                    <span className="text-gray-600 text-xs font-mono">{utente.mISSION}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">Status</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-gray-900 font-semibold mb-1">Subscrição</label>
                  {utente.subscrito ? (
                    <div>
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Ativo
                      </span>
                      {utente.dataSubscricao && (
                        <p className="text-xs text-gray-600 mt-2">
                          Desde {new Date(utente.dataSubscricao).toLocaleDateString('pt-PT')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-900">
                      Inativo
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-gray-900 font-semibold mb-1">Registado em</label>
                  <p className="text-gray-600">
                    {new Date(utente.createdAt).toLocaleDateString('pt-PT')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Details - Right Columns (3/4) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">Informações Pessoais</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Nome Completo</label>
                  <p className="text-gray-600">{utente.nome}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Email</label>
                  <p className="text-gray-600">{utente.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Telefone</label>
                  <p className="text-gray-600">{utente.telefone}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">MISSION ID</label>
                  <p className="text-gray-600 font-mono text-sm">{utente.mISSION}</p>
                </div>

                {utente.geoLocation && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Localização Atual</label>
                    <p className="text-gray-600 font-mono text-sm">{utente.geoLocation}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Missões */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">
                  Missões ({totalMissoes})
                </h3>
              </div>

              {utente.missoes && utente.missoes.length > 0 ? (
                <div className="space-y-3">
                  {utente.missoes.map((missao) => (
                    <div key={missao.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <h4 className="font-bold text-gray-900">{missao.paragem.nome}</h4>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-900 rounded text-xs font-mono">
                              {missao.paragem.codigo}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-900 mb-1">Localização Utente</label>
                              <p className="text-gray-600 font-mono text-xs">{missao.geoLocationUtente}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-900 mb-1">Localização Paragem</label>
                              <p className="text-gray-600 font-mono text-xs">{missao.geoLocationParagem}</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Criada em {new Date(missao.createdAt).toLocaleString('pt-PT')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600 border border-gray-200 rounded-lg bg-gray-50">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="font-medium">Nenhuma missão registada</p>
                  <p className="text-sm mt-1">Este utente ainda não criou missões</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
