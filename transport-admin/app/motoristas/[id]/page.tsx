"use client";
import LoadingScreen from "../../components/LoadingScreen";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Motorista {
  id: string;
  nome: string;
  bi: string;
  cartaConducao: string;
  telefone: string;
  email: string;
  dataNascimento: string;
  endereco: string;
  foto?: string;
  nacionalidade: string;
  genero: string;
  estadoCivil: string;
  numeroEmergencia: string;
  contatoEmergencia: string;
  deficiencia?: string;
  dataEmissaoBI: string;
  dataValidadeBI: string;
  dataEmissaoCarta: string;
  dataValidadeCarta: string;
  categoriaCarta: string;
  experienciaAnos: number;
  observacoes?: string;
  transporte?: {
    id: string;
    matricula: string;
    modelo: string;
    marca: string;
    via?: {
      nome: string;
      codigo: string;
    };
    proprietarios: Array<{
      proprietario: {
        id: string;
        nome: string;
        bi: string;
        nacionalidade: string;
        endereco: string;
        contacto1: number;
        contacto2?: number;
      };
    }>;
  };
  status: string;
  createdAt: string;
}

export default function MotoristaDetalhes() {
  const router = useRouter();
  const params = useParams();
  const [motorista, setMotorista] = useState<Motorista | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hasAssociations, setHasAssociations] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    if (params.id) {
      fetchMotorista(params.id as string);
    }
  }, [params.id]);

  async function fetchMotorista(id: string) {
    try {
      const response = await fetch(`/api/motoristas/${id}`);
      const data = await response.json();
      setMotorista(data);
    } catch (error) {
      console.error('Erro ao carregar motorista:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    setHasAssociations(false);
    
    try {
      const response = await fetch(`/api/motoristas/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Motorista eliminado com sucesso!', 'success');
        setTimeout(() => router.push('/motoristas'), 1500);
      } else {
        const error = await response.json();
        
        // Check if error is about transporte association
        if (error.error && error.error.includes('transporte')) {
          setDeleteError(error.details || error.error);
          setHasAssociations(true);
        } else {
          showNotification(error.error || 'Erro ao eliminar motorista', 'error');
          setShowDeleteModal(false);
        }
      }
    } catch (error) {
      showNotification('Erro ao eliminar motorista', 'error');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemoveAssociationsAndDelete() {
    setDeleting(true);
    
    try {
      // Force delete with associations removal
      const response = await fetch(`/api/motoristas/${params.id}?force=true`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('Motorista eliminado com sucesso!', 'success');
        setTimeout(() => router.push('/motoristas'), 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao eliminar motorista', 'error');
      }
    } catch (error) {
      showNotification('Erro ao eliminar motorista', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  if (!motorista) {
    return (
      <div className="text-center py-12">
        <p className="text-black">Motorista não encontrado</p>
        <button onClick={() => router.push('/motoristas')} className="mt-4 text-black" style={{ transition: 'none' }}>
          Voltar para lista
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/motoristas')}
              className="p-2 rounded-lg"
              style={{ transition: 'none' }}
            >
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-black">{motorista.nome}</h2>
              <p className="text-black mt-1">Detalhes do motorista</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/motoristas/editar/${params.id}`)}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium flex items-center space-x-2"
              style={{ transition: 'none' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Editar</span>
            </button>
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium flex items-center space-x-2" 
              style={{ transition: 'none' }}
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
          {/* Foto e Info Rápida - Coluna Esquerda */}
          <div className="lg:col-span-1 space-y-6">
            {/* Foto */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col items-center">
                <div className="w-40 h-40 bg-slate-100 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                  {motorista.foto ? (
                    <img src={motorista.foto} alt={motorista.nome} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-24 h-24 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-xl font-bold text-black text-center mb-2">{motorista.nome}</h3>
                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-black mb-4">
                  {motorista.status}
                </span>
                <div className="w-full space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-black font-medium">Experiência</span>
                    <span className="text-black">{motorista.experienciaAnos} anos</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-black font-medium">Categoria</span>
                    <span className="text-black">{motorista.categoriaCarta}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-black mb-4 pb-3 border-b border-slate-200">Status</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-black font-semibold mb-1">Estado</label>
                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-black">
                    {motorista.status}
                  </span>
                </div>
                <div>
                  <label className="block text-black font-semibold mb-1">Registado em</label>
                  <p className="text-black">{new Date(motorista.createdAt).toLocaleDateString('pt-PT')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Informações Detalhadas - Colunas Direita */}
          <div className="lg:col-span-3 space-y-6">
            {/* Informações Pessoais */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Informações Pessoais</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Nome Completo</label>
                  <p className="text-black">{motorista.nome}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Data de Nascimento</label>
                  <p className="text-black">{new Date(motorista.dataNascimento).toLocaleDateString('pt-PT')}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Nacionalidade</label>
                  <p className="text-black">{motorista.nacionalidade}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Género</label>
                  <p className="text-black">{motorista.genero}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Estado Civil</label>
                  <p className="text-black">{motorista.estadoCivil}</p>
                </div>

                {motorista.deficiencia && (
                  <div>
                    <label className="block text-sm font-semibold text-black mb-1">Deficiência</label>
                    <p className="text-black">{motorista.deficiencia}</p>
                  </div>
                )}

                <div className="md:col-span-3">
                  <label className="block text-sm font-semibold text-black mb-1">Endereço</label>
                  <p className="text-black">{motorista.endereco}</p>
                </div>
              </div>
            </div>

            {/* Documentos */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Documentos</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* BI */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-black">Bilhete de Identidade</h4>
                  <div>
                    <label className="block text-sm font-semibold text-black mb-1">Número</label>
                    <p className="text-black">{motorista.bi}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-black mb-1">Data de Emissão</label>
                    <p className="text-black">
                      {new Date(motorista.dataEmissaoBI).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-black mb-1">Data de Validade</label>
                    <p className="text-black">
                      {new Date(motorista.dataValidadeBI).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                </div>

                {/* Carta de Condução */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-black">Carta de Condução</h4>
                  <div>
                    <label className="block text-sm font-semibold text-black mb-1">Número</label>
                    <p className="text-black">{motorista.cartaConducao}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-black mb-1">Categoria</label>
                    <p className="text-black">{motorista.categoriaCarta}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-black mb-1">Data de Emissão</label>
                    <p className="text-black">
                      {new Date(motorista.dataEmissaoCarta).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-black mb-1">Data de Validade</label>
                    <p className="text-black">
                      {new Date(motorista.dataValidadeCarta).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Contacto</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Telefone</label>
                  <p className="text-black">{motorista.telefone}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Email</label>
                  <p className="text-black">{motorista.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Contacto de Emergência</label>
                  <p className="text-black">{motorista.contatoEmergencia}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Telefone de Emergência</label>
                  <p className="text-black">{motorista.numeroEmergencia}</p>
                </div>
              </div>
            </div>

            {/* Experiência Profissional */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Experiência Profissional</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Anos de Experiência</label>
                  <p className="text-black">{motorista.experienciaAnos} anos</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">Categoria da Carta</label>
                  <p className="text-black">{motorista.categoriaCarta}</p>
                </div>
              </div>
            </div>

            {/* Observações */}
            {motorista.observacoes && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Observações</h3>
                <p className="text-black whitespace-pre-wrap">{motorista.observacoes}</p>
              </div>
            )}

            {/* Transporte Atribuído */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-black mb-6 pb-3 border-b border-slate-200">Transporte Atribuído</h3>
              
              {motorista.transporte ? (
                <div className="space-y-4">
                  <div className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-bold text-black">{motorista.transporte.matricula}</h4>
                          <p className="text-sm text-black">{motorista.transporte.modelo} - {motorista.transporte.marca}</p>
                          {motorista.transporte.via && (
                            <p className="text-xs text-black">Via: {motorista.transporte.via.nome} ({motorista.transporte.via.codigo})</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/transportes/${motorista.transporte?.id}`)}
                        className="px-4 py-2 bg-slate-100 text-black rounded-lg font-medium"
                        style={{ transition: 'none' }}
                      >
                        Ver Transporte
                      </button>
                    </div>
                  </div>

                  {/* Empresa/Proprietário */}
                  {motorista.transporte.proprietarios && motorista.transporte.proprietarios.length > 0 && (
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <h4 className="font-bold text-black mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Empresa Proprietária
                      </h4>
                      {motorista.transporte.proprietarios.map((tp, index) => (
                        <div key={index} className="space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-black mb-1">Nome da Empresa</label>
                              <p className="text-sm text-black">{tp.proprietario.nome}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-black mb-1">BI/NUIT</label>
                              <p className="text-sm text-black">{tp.proprietario.bi}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-black mb-1">Nacionalidade</label>
                              <p className="text-sm text-black">{tp.proprietario.nacionalidade}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-black mb-1">Contacto</label>
                              <p className="text-sm text-black">{tp.proprietario.contacto1}</p>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-black mb-1">Endereço</label>
                              <p className="text-sm text-black">{tp.proprietario.endereco}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => router.push(`/proprietarios/${tp.proprietario.id}`)}
                            className="mt-2 px-3 py-1.5 bg-slate-100 text-black rounded text-xs font-medium"
                            style={{ transition: 'none' }}
                          >
                            Ver Detalhes da Empresa
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-black border border-slate-200 rounded-lg bg-slate-50">
                  <svg className="w-10 h-10 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <p className="text-sm font-medium">Nenhum transporte atribuído</p>
                </div>
              )}
            </div>
          </div>
        </div>

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
                  {hasAssociations ? 'Remover Associações' : 'Eliminar Motorista'}
                </h3>
                
                {hasAssociations ? (
                  <div className="space-y-4">
                    <p className="text-gray-600 text-center">
                      {deleteError}
                    </p>
                    <div className="bg-white rounded-lg p-4">
                      <p className="text-sm text-red-600 text-center font-medium">
                        Clique em <strong>"Remover e Eliminar"</strong> para remover as associações e eliminar o motorista.
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
                      Tem certeza que deseja eliminar o motorista <strong className="text-gray-900">"{motorista?.nome}"</strong>?
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
      </div>
    </div>
  );
}
