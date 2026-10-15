"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UserAvatar from "../components/UserAvatar";
import LoadingScreen from "../components/LoadingScreen";

interface Utente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  mISSION: string;
  subscrito: boolean;
  dataSubscricao: string | null;
  createdAt: string;
}

interface Mission {
  id: string;
  codigoParagem: string;
  geoLocationUtente: string;
  geoLocationParagem: string;
  createdAt: string;
  paragemId: string;
  paragem: {
    nome: string;
    codigo: string;
    geoLocation: string;
  };
}

type TabType = "profile" | "missions" | "security";

interface ModalState {
  show: boolean;
  type: 'confirm' | 'alert';
  title: string;
  message: string;
  onConfirm?: () => void;
}

function UserInfoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [utente, setUtente] = useState<Utente | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [modal, setModal] = useState<ModalState>({
    show: false,
    type: 'alert',
    title: '',
    message: '',
  });
  
  // Profile edit states
  const [editingProfile, setEditingProfile] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  
  // Password change states
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    const utenteData = localStorage.getItem("utente");
    if (!utenteData) {
      router.push("/auth");
      return;
    }

    const parsedUtente = JSON.parse(utenteData);
    
    // Check for tab query parameter and set active tab
    const tabParam = searchParams.get('tab');
    if (tabParam === 'missoes') {
      setActiveTab('missions');
    } else if (tabParam === 'perfil') {
      setActiveTab('profile');
    } else if (tabParam === 'seguranca') {
      setActiveTab('security');
    }
    
    // Fetch fresh data from API
    Promise.all([
      fetch(`/api/user/${parsedUtente.id}`).then(res => res.json()),
      fetch(`/api/user/missions?utenteId=${parsedUtente.id}`).then(res => res.json())
    ])
      .then(([userData, missionsData]) => {
        if (userData.error) {
          console.error('Error fetching user:', userData.error);
          setUtente(parsedUtente);
        } else {
          setUtente(userData);
          setNewNome(userData.nome);
          localStorage.setItem("utente", JSON.stringify(userData));
        }
        
        if (!missionsData.error) {
          setMissions(missionsData.missions || []);
        }
        
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        setUtente(parsedUtente);
        setNewNome(parsedUtente.nome);
        setLoading(false);
      });
  }, [router, searchParams]);

  const handleProfileUpdate = async () => {
    if (!utente || !newNome.trim()) return;
    
    setProfileError("");
    setProfileSuccess("");
    setSavingProfile(true);

    try {
      const response = await fetch(`/api/user/${utente.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: newNome.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setProfileError(data.error || "Erro ao atualizar perfil");
        setSavingProfile(false);
        return;
      }

      setUtente(data);
      localStorage.setItem("utente", JSON.stringify(data));
      setProfileSuccess("Perfil atualizado com sucesso!");
      setEditingProfile(false);
      
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setProfileError("Erro ao conectar ao servidor");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!utente) return;
    
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Todos os campos são obrigatórios");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem");
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch(`/api/user/${utente.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.error || "Erro ao alterar senha");
        setChangingPassword(false);
        return;
      }

      setPasswordSuccess("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      setTimeout(() => setPasswordSuccess(""), 3000);
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordError("Erro ao conectar ao servidor");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteMission = async (missionId: string) => {
    setModal({
      show: true,
      type: 'confirm',
      title: 'Remover Missão',
      message: 'Tem certeza que deseja remover esta missão?',
      onConfirm: async () => {
        setModal({ show: false, type: 'alert', title: '', message: '' });
        
        try {
          const response = await fetch(`/api/user/missions/${missionId}`, {
            method: 'DELETE',
          });

          const data = await response.json();

          if (!response.ok) {
            setModal({
              show: true,
              type: 'alert',
              title: 'Erro',
              message: data.error || 'Erro ao remover missão',
            });
            return;
          }

          // Remove mission from state
          setMissions(missions.filter(m => m.id !== missionId));
          setModal({
            show: true,
            type: 'alert',
            title: 'Sucesso',
            message: 'Missão removida com sucesso!',
          });
        } catch (error) {
          console.error('Error deleting mission:', error);
          setModal({
            show: true,
            type: 'alert',
            title: 'Erro',
            message: 'Erro ao remover missão',
          });
        }
      },
    });
  };

  const getInitials = (nome: string) => {
    const names = nome.trim().split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!utente) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-slate-600 hover:text-slate-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-lg font-medium">Voltar</span>
            </button>
            
            {/* User Avatar in top right */}
            <UserAvatar />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Hidden on mobile, shown on large screens */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden sticky top-8">
              {/* User Avatar */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-8">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-3">
                    <span className="text-slate-900 font-bold text-2xl">
                      {getInitials(utente.nome)}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white text-center">{utente.nome}</h2>
                  <p className="text-sm text-slate-300 text-center mt-1">{utente.email}</p>
                  {utente.subscrito && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-3">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Subscrito
                    </span>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <nav className="p-2">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === "profile"
                      ? "bg-slate-800 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-medium">Perfil</span>
                </button>

                <button
                  onClick={() => setActiveTab("missions")}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === "missions"
                      ? "bg-slate-800 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span className="font-medium">Missões</span>
                  {missions.length > 0 && (
                    <span className="ml-auto bg-slate-200 text-slate-800 text-xs font-bold px-2 py-0.5 rounded-full">
                      {missions.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("security")}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === "security"
                      ? "bg-slate-800 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="font-medium">Segurança</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content - Full width on mobile, 3 columns on large screens */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">Informações do Perfil</h1>
                    {!editingProfile && (
                      <button
                        onClick={() => setEditingProfile(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Editar</span>
                      </button>
                    )}
                  </div>

                  {profileSuccess && (
                    <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-start space-x-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-green-800">{profileSuccess}</p>
                    </div>
                  )}

                  {profileError && (
                    <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start space-x-3">
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-800">{profileError}</p>
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Nome */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Nome Completo
                      </label>
                      {editingProfile ? (
                        <input
                          type="text"
                          value={newNome}
                          onChange={(e) => setNewNome(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-slate-800 focus:outline-none transition-colors text-slate-900"
                        />
                      ) : (
                        <p className="text-lg text-slate-900">{utente.nome}</p>
                      )}
                    </div>

                    {/* Email (read-only) */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Email
                      </label>
                      <p className="text-lg text-slate-900">{utente.email}</p>
                      <p className="text-xs text-slate-500 mt-1">O email não pode ser alterado</p>
                    </div>

                    {/* Telefone (read-only) */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Telefone
                      </label>
                      <p className="text-lg text-slate-900">{utente.telefone}</p>
                      <p className="text-xs text-slate-500 mt-1">O telefone não pode ser alterado</p>
                    </div>

                    {/* MISSION ID (read-only) */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        MISSION ID
                      </label>
                      <p className="text-lg text-slate-900 font-mono">{utente.mISSION}</p>
                    </div>

                    {/* Subscription Status */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Estado da Subscrição
                      </label>
                      {utente.subscrito ? (
                        <div>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            Ativo
                          </span>
                          {utente.dataSubscricao && (
                            <p className="text-sm text-slate-600 mt-2">
                              Subscrito desde {new Date(utente.dataSubscricao).toLocaleDateString('pt-PT', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">
                          Inativo
                        </span>
                      )}
                    </div>

                    {/* Member Since */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Membro desde
                      </label>
                      <p className="text-lg text-slate-900">
                        {new Date(utente.createdAt).toLocaleDateString('pt-PT', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    {editingProfile && (
                      <div className="flex space-x-3 pt-4">
                        <button
                          onClick={handleProfileUpdate}
                          disabled={savingProfile}
                          className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingProfile ? "A guardar..." : "Guardar Alterações"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingProfile(false);
                            setNewNome(utente.nome);
                            setProfileError("");
                          }}
                          disabled={savingProfile}
                          className="px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Missions Tab */}
              {activeTab === "missions" && (
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-6">Minhas Missões</h1>
                  
                  {missions.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      <p className="text-slate-600 text-lg">Nenhuma missão guardada</p>
                      <p className="text-slate-500 text-sm mt-2">As suas missões aparecerão aqui</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {missions.map((mission) => (
                        <div key={mission.id} className="border-2 border-slate-200 rounded-lg p-6 hover:border-slate-300 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-slate-900 mb-2">
                                {mission.paragem.nome}
                              </h3>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2 text-sm text-slate-600">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                  </svg>
                                  <span>Código: {mission.paragem.codigo}</span>
                                </div>
                                <div className="flex items-center space-x-2 text-sm text-slate-600">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>
                                    Criada em {new Date(mission.createdAt).toLocaleDateString('pt-PT', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="ml-4 flex flex-col space-y-2">
                              <button
                                onClick={async () => {
                                  // Find a transporte that serves this paragem
                                  try {
                                    // Get all buses
                                    const response = await fetch('/api/buses');
                                    
                                    if (!response.ok) {
                                      throw new Error('Failed to fetch buses');
                                    }
                                    
                                    const data = await response.json();
                                    
                                    if (data.buses && data.buses.length > 0) {
                                      // Find a bus that has this stop
                                      const busWithStop = data.buses.find((bus: any) => 
                                        bus.stops?.some((stop: any) => stop.id === mission.paragemId)
                                      );
                                      
                                      if (busWithStop) {
                                        router.push(`/track/${busWithStop.id}?paragem=${mission.paragem.geoLocation}`);
                                      } else {
                                        setModal({
                                          show: true,
                                          type: 'alert',
                                          title: 'Aviso',
                                          message: 'Nenhum transporte disponível para esta paragem',
                                        });
                                      }
                                    } else {
                                      setModal({
                                        show: true,
                                        type: 'alert',
                                        title: 'Aviso',
                                        message: 'Nenhum transporte disponível',
                                      });
                                    }
                                  } catch (error) {
                                    console.error('Error finding transporte:', error);
                                    setModal({
                                      show: true,
                                      type: 'alert',
                                      title: 'Erro',
                                      message: 'Erro ao buscar transporte',
                                    });
                                  }
                                }}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                Ver Detalhes
                              </button>
                              <button
                                onClick={() => handleDeleteMission(mission.id)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Remover</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-6">Segurança</h1>

                  {passwordSuccess && (
                    <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-start space-x-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-green-800">{passwordSuccess}</p>
                    </div>
                  )}

                  {passwordError && (
                    <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start space-x-3">
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-800">{passwordError}</p>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 mb-4">Alterar Senha</h2>
                      <p className="text-sm text-slate-600 mb-6">
                        Para sua segurança, escolha uma senha forte com pelo menos 6 caracteres.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Senha Atual
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-slate-800 focus:outline-none transition-colors text-slate-900"
                        placeholder="Digite sua senha atual"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Nova Senha
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-slate-800 focus:outline-none transition-colors text-slate-900"
                        placeholder="Digite sua nova senha"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Confirmar Nova Senha
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-slate-800 focus:outline-none transition-colors text-slate-900"
                        placeholder="Confirme sua nova senha"
                      />
                    </div>

                    <button
                      onClick={handlePasswordChange}
                      disabled={changingPassword}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {changingPassword ? "A alterar..." : "Alterar Senha"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => {
              if (modal.type === 'alert') {
                setModal({ show: false, type: 'alert', title: '', message: '' });
              }
            }}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-3">
              {modal.title}
            </h3>
            <p className="text-slate-700 mb-6">
              {modal.message}
            </p>
            
            <div className="flex space-x-3">
              {modal.type === 'confirm' ? (
                <>
                  <button
                    onClick={() => setModal({ show: false, type: 'alert', title: '', message: '' })}
                    className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => modal.onConfirm?.()}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Remover
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setModal({ show: false, type: 'alert', title: '', message: '' })}
                  className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-colors"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserInfoPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <UserInfoContent />
    </Suspense>
  );
}
